/**
 * 均匀网格空间索引（多叉分桶）。
 *
 * 用途：给「光圈悬停触发」和「点击命中」做邻域剪枝 —— 把每帧 O(n) 的全量遍历
 * 降到「只扫查询点附近的几格」。
 *
 * ★ 为什么是均匀网格，不是四叉树 / 八叉树
 *   （用户问过「能不能用最精致的多叉树去划区域」，结论是网格更适合这个场景）：
 *   · 被检对象是**同一种瓶子**：尺寸一致（本地 38.4×96）、分布近均匀、边界是固定矩形。
 *     在这种分布下四叉树会退化成「网格 + 一层递归指针」，反而多出指针跳转与递归开销；
 *     均匀网格的格子下标是直接算出来的（O(1)），没有树遍历。
 *   · 瓶子每次翻转落位都会改位置，四叉树重建要 new 一批节点对象（GC 压力）；
 *     网格重建只是「把 n 个对象按中心点写回桶」，O(n) 且**全程零分配**（桶与槽位数组复用）。
 *   · 本结构仍然是「多叉」的：每格挂任意多个对象，格子数由 cell 决定（本场约 11×15 格）。
 *
 * ★ 使用范式（脏标记 + 按需重建，**不要每帧重建**）
 *      if (dirty) { grid.reset(x0, y0, x1, y1); for (b of all) grid.insert(b, x, y); }
 *      const n = grid.queryCircle(cx, cy, r, out);
 *   重建本身要遍历全部对象，和原来的全量遍历同价 —— 每帧重建等于白做。
 *   本项目的重建时机：「瓶子增删（sync）」与「翻转落位（onLanded）」。
 *
 * ★ 正确性前提：对象按**中心点**只落 1 格，查询时把查询区域按 r 外扩到格边界。
 *   因此只要对象中心落在查询范围内，它所在的格必然与查询区域相交 → 不会被漏掉。
 */
export class SpatialGrid<T> {
    /**
     * 每格边长（本地单位）。
     * 瓶子中心平均间距 ≈ 40（500×695 的活动区放 200 只 → sqrt(area/n)≈41），
     * 取 1.2 倍 → 平均每格 1~2 只，一次查询扫 3×3 ~ 5×5 格即可。
     */
    cell = 48;

    private _minX = 0;
    private _minY = 0;
    private _cols = 0;
    private _rows = 0;
    /** 每格一组「槽位下标」；槽位 → 对象/坐标存在平行的 _obj/_px/_py（全程复用，零分配） */
    private _buckets: number[][] = [];
    private _obj: any[] = [];
    private _px: number[] = [];
    private _py: number[] = [];
    private _n = 0;

    /**
     * 设定边界并清空。
     *
     * 边界取「所有待插对象**中心点**的外包矩形」（可再留一点余量）。
     * 尺寸不变时只把每个桶的 length 归零（复用数组），不重新分配。
     */
    reset(minX: number, minY: number, maxX: number, maxY: number) {
        const cols = Math.max(1, Math.ceil((maxX - minX) / this.cell));
        const rows = Math.max(1, Math.ceil((maxY - minY) / this.cell));
        if (cols !== this._cols || rows !== this._rows) {
            this._cols = cols;
            this._rows = rows;
            const total = cols * rows;
            this._buckets.length = total;
            for (let i = 0; i < total; i++) { this._buckets[i] = []; }
        } else {
            const b = this._buckets;
            for (let i = 0; i < b.length; i++) { b[i].length = 0; }
        }
        this._minX = minX;
        this._minY = minY;
        this._n = 0;
    }

    /**
     * 插入一个对象（按中心点落 1 格）。
     * 界外的对象会被丢弃 —— 调用方应让 reset 的边界覆盖所有对象的中心点。
     */
    insert(obj: T, x: number, y: number) {
        const cx = Math.floor((x - this._minX) / this.cell);
        const cy = Math.floor((y - this._minY) / this.cell);
        if (cx < 0 || cy < 0 || cx >= this._cols || cy >= this._rows) { return; }
        const i = this._n++;
        this._obj[i] = obj;
        this._px[i] = x;
        this._py[i] = y;
        this._buckets[cy * this._cols + cx].push(i);
    }

    /**
     * 圆查询：把「中心距 (cx,cy) ≤ r」的对象写进 out，返回个数。
     * 先按查询圆的外接方收集候选（通常 3×3 ~ 5×5 格），再逐点做精确距离过滤。
     */
    queryCircle(cx: number, cy: number, r: number, out: T[]): number {
        return this._scan(cx - r, cy - r, cx + r, cy + r, out, cx, cy, r * r);
    }

    /**
     * 矩形查询（AABB）：把「中心点落进 [x0,y0,x1,y1]」的对象写进 out。
     * 不做精确过滤（调用方自己判矩形/旋转），只为把候选缩小到附近几格。
     */
    queryRect(x0: number, y0: number, x1: number, y1: number, out: T[]): number {
        return this._scan(x0, y0, x1, y1, out, 0, 0, -1);
    }

    /** 公共扫描；r2 < 0 表示不做距离过滤（矩形查询） */
    private _scan(l: number, b: number, rr: number, t: number,
        out: T[], cx: number, cy: number, r2: number): number {
        out.length = 0;
        let c0 = Math.floor((l - this._minX) / this.cell);
        let c1 = Math.floor((rr - this._minX) / this.cell);
        let r0 = Math.floor((b - this._minY) / this.cell);
        let r1 = Math.floor((t - this._minY) / this.cell);
        if (c0 < 0) { c0 = 0; }
        if (r0 < 0) { r0 = 0; }
        if (c1 > this._cols - 1) { c1 = this._cols - 1; }
        if (r1 > this._rows - 1) { r1 = this._rows - 1; }
        for (let gy = r0; gy <= r1; gy++) {
            const base = gy * this._cols;
            for (let gx = c0; gx <= c1; gx++) {
                const bucket = this._buckets[base + gx];
                for (let k = 0; k < bucket.length; k++) {
                    const i = bucket[k];
                    if (r2 >= 0) {
                        const dx = this._px[i] - cx;
                        const dy = this._py[i] - cy;
                        if (dx * dx + dy * dy > r2) { continue; }
                    }
                    out.push(this._obj[i]);
                }
            }
        }
        return out.length;
    }

    /** 本次已插入对象数（验收/调试用） */
    get size(): number { return this._n; }
}

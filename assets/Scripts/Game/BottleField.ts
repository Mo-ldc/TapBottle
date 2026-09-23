import { _decorator, Component, Node, Sprite, Vec2, Vec3, UIOpacity, UITransform, input, Input, EventTouch, EventMouse, tween } from 'cc';
import { LAYOUT, PLAY_AREA, TIERS, VISIBLE_BOTTLES } from '../Core/GameConfig';
import { G } from '../Core/State';
import { chance, fmt } from '../Core/Util';
import { FlipResult } from '../Core/State';
import { Res } from '../Core/Res';
import { BOTTLE_ART, BOTTLE_SCALE, Bottle } from './Bottle';
import { CapMachine } from './CapMachine';
import { FxLayer } from './Fx';
import { label, nd, setFrame, setSize } from '../UI/UIKit';
import { Modal } from '../UI/Modal';

const { ccclass } = _decorator;

const VISIBLE_MAX = VISIBLE_BOTTLES;

/** 玩家点击音效（用户口径：pop3 才是瓶子被触发的声音） */
const TAP_SFX = ['pop3'];
const DW = 720, DH = 1280;

/* ---------------- 光标（解锁「玩家科技·光标」后出现） ----------------
 * 拆成两个**独立**节点，因为它们的层级需求正好相反：
 *   cursorRing = 范围圈，是地面落点指示 → setSiblingIndex(0)，压在影子/瓶子之下
 *   cursorPin  = 手指指针，必须在**所有东西之上** → 追加到子节点末尾
 * 原来两者共用一个容器、容器整体 setSiblingIndex(0)，手指跟着一起沉到瓶层下面，
 * 被桌子和瓶子挡得看不见（用户反馈「图片不在上层，被挡住了」）。
 */
const CURSOR_PIN_H = 60;                                     // 指针高度（设计像素）
const CURSOR_PIN_W = Math.round(CURSOR_PIN_H * 73 / 78);     // 贴图 73×78，按比例给宽
/** env/cursor.png 的指尖在贴图内的比例偏移（+x 右 / +y 上），用 PIL 量的 = (−0.048, +0.487) */
const TIP_RX = -0.048, TIP_RY = 0.487;
/** 让「指尖」正好落在 pointer 上 → 贴图中心要往右下各让这么多 */
const PIN_DX = -TIP_RX * CURSOR_PIN_W;
const PIN_DY = -TIP_RY * CURSOR_PIN_H;

export type Outcome = 'crit' | 'ok' | 'fail';

/** 瓶子阵：布局、点击/悬停翻转、冲击波 */
@ccclass('BottleField')
export class BottleField extends Component {
    static I: BottleField = null!;

    bottles: Bottle[] = [];
    private overflowLb: Node = null!;
    /** 范围圈（地面贴片，压在瓶子之下） */
    private cursorRing: Node = null!;
    /** 手指指针（顶层，盖过瓶子） */
    private cursorPin: Node = null!;
    private pointer = new Vec2(0, 0);
    /**
     * 首次可用时把指针摆到桌面活动区中心。
     * 否则它停在节点原点（= 桌面下沿/边缘），会给人「光标出现了但不在该在的地方」的错觉；
     * 之后任何一次按下/拖动都会立刻把它带到手指下。
     */
    private pointerSeeded = false;
    private hitLock: Record<string, number> = {};

    /** 瓶子层（可排序遮挡）/ 影子层（永远在所有瓶子之下） */
    private bottleHolder: Node = null!;
    private shadowHolder: Node = null!;

    /* ---------------- 买瓶飞入 ---------------- */

    /**
     * 飞行精灵挂的层（由 GameRoot 注入 panelLayer）。
     * ★ 必须在**底部商店面板之上**：精灵从商店按钮起飞，挂在世界层会被整块底部 UI 盖住，
     *   起飞那半程等于看不见（用户口径：瓶子要在商店模块上层）。
     */
    flyLayer: Node | null = null;
    /** 待消费的购买登记 { 阶, 按钮世界坐标, 登记时刻 } */
    private flyReq: { tier: number; src: Vec3; born: number } | null = null;

    /**
     * 登记一次「买瓶飞入」。
     *
     * ⚠️ 必须在 `G.buyBottle()` **之前**调用：buyBottle 内部同步 notify → sync 立刻建出这只新瓶子，
     *    登记信息只有在那一次 sync 里被消费才能对应上（留在下一帧就全错位了）。
     * ⚠️ 只记**世界坐标**、不记按钮节点：点完按钮列表会整块 refresh()，节点当场被销毁。
     * ⚠️ 登记**不能**在 sync 里无条件作废：buyBottle 里 spendMoney() 会先 notify 一次，
     *    那次 sync 时瓶子还没 ++、不走新建分支 —— 无条件清掉的话飞入永远对不上。
     *    所以改成 2 秒超时作废（正常路径由 startFlyIn 消费）。
     */
    queueFlyIn(tier: number, btn: Node | null) {
        if (btn && btn.isValid) {
            // getWorldPosition() 不传 out 时返回的是内部临时向量 → 必须 clone
            this.flyReq = { tier, src: btn.getWorldPosition().clone(), born: performance.now() };
            return;
        }
        // ★ 用户口径：飞入动画「都得有」—— 没有按钮锚点（如广告补足购买）也从屏幕底部中央起飞，
        //   不能静默放弃动画。
        const ut = this.node.getComponent(UITransform);
        if (!ut) { return; }
        this.flyReq = { tier, src: ut.convertToWorldSpaceAR(new Vec3(0, -600, 0)), born: performance.now() };
    }

    /** 购买失败（钱不够 / 已满仓）时撤销登记 */
    cancelFlyIn() { this.flyReq = null; }

    /**
     * 飞入动画：临时瓶身精灵（**全程真实瓶高**，用户口径：不从格子图标大小长起来）
     * 从商店按钮抛到桌面落点，边飞边自旋；落地后销毁精灵、真瓶子显形并**直接判定正反结算**，
     * 不再原地起跳重翻一次（用户口径：飞进去落地就能判断正反）。
     */
    private startFlyIn(b: Bottle, srcWorld: Vec3) {
        this.flyReq = null;
        const layer = (this.flyLayer && this.flyLayer.isValid) ? this.flyLayer : this.node;
        const lut = layer.getComponent(UITransform);
        const but = this.node.getComponent(UITransform);
        if (!lut || !but) { return; }

        // 起点：按钮世界坐标 → 飞行层局部；终点：落点再抬半个瓶高（对齐瓶身视觉中心）
        const p0 = lut.convertToNodeSpaceAR(srcWorld);
        const dstWorld = but.convertToWorldSpaceAR(
            new Vec3(b.node.position.x, b.node.position.y + LAYOUT.bottleH * 0.3, 0));
        const p1 = lut.convertToNodeSpaceAR(dstWorld);

        // 真瓶子先藏起来，落地才显形 —— 否则桌上会先冒出一只、天上又飞一只
        b.node.active = false;
        if (b.shadowNode && b.shadowNode.isValid) { b.shadowNode.active = false; }

        const n = nd(layer, 'flyBottle', BOTTLE_ART.w, BOTTLE_ART.h, p0.x, p0.y);
        setFrame(n.addComponent(Sprite), 'bottle/body_' + TIERS[b.tier].art, BOTTLE_ART.w, BOTTLE_ART.h);
        n.setSiblingIndex(layer.children.length - 1);
        n.setScale(BOTTLE_SCALE, BOTTLE_SCALE, 1);    // ★ 用户口径：全程真实瓶高，不从格子图标大小长起
        n.angle = 180;                                // 与桌面静置姿态一致（贴图 0° 是瓶口朝下）
        n.addComponent(UIOpacity).opacity = 255;

        const dur = 0.44;
        const midY = Math.max(p0.y, p1.y) + 90;       // 抛物线拱顶
        tween(n)
            .to(dur * 0.5, { position: new Vec3((p0.x + p1.x) / 2, midY, 0) }, { easing: 'quadOut' })
            .to(dur * 0.5, { position: new Vec3(p1.x, p1.y, 0) }, { easing: 'quadIn' })
            // ⚠️ 显形/销毁放到下一帧：让自旋那条 tween 也自然跑完，别在它还没结束时把节点删掉
            .call(() => this.scheduleOnce(() => {
                if (n.isValid) { n.destroy(); }
                if (!b || !b.node || !b.node.isValid) { return; }
                b.node.active = true;
                if (b.shadowNode && b.shadowNode.isValid) { b.shadowNode.active = true; }
                b.node.setScale(BOTTLE_SCALE, BOTTLE_SCALE, 1);
                b.node.angle = 180;
                this.sortDepth();
                // ★ 用户口径（第十七轮）：飞入落地直接判定正反并结算，不再原地起跳重翻一次
                b.settle(G.rollOutcome(b.tier));
            }, 0))
            .start();
        // 自旋：180 → 540（整一圈，落回 180，接得上静置姿态）
        tween(n).to(dur, { angle: 540 }, { easing: 'quadInOut' }).start();
    }

    onLoad() {
        BottleField.I = this;
        // 先建影子层、再建瓶子层 —— 同父节点下索引小的先渲染，影子因此永远在最底层
        this.shadowHolder = nd(this.node, 'shadows', DW, DH, 0, 0);
        this.bottleHolder = nd(this.node, 'bottles', DW, DH, 0, 0);
    }

    start() {
        // 光标区域：按下即定位 + 命中判定翻瓶（GDD §3.1-2）
        //
        // ⚠️ 点击**不再**走「瓶子的节点事件」，而是统一在这里自己做命中判定（见 tapAt）：
        //   节点自带的 hitTest 用的是 UITransform 矩形，和可见瓶身对不上（原来小一半多），
        //   于是点瓶口/瓶底会打空；打空后事件回落到场地的「空白处随机翻一只」，
        //   玩家看到的就是「点 A 结果 B 翻了」。重叠的瓶子也只有最上面那只收得到事件。
        //
        // ⚠️ 两种输入源要分别接：桌面浏览器鼠标**按下**派发的是 MOUSE_DOWN（不是 TOUCH_START），
        //   只接 TOUCH_MOVE 会「拖动才动、只点不拖完全不动」。
        const onDownTouch = (e: EventTouch) => { const p = e.getUILocation(); this.pointerDown(p.x, p.y); };
        const onMoveTouch = (e: EventTouch) => { const p = e.getUILocation(); this.aim(p.x, p.y); };
        const onDownMouse = (e: EventMouse) => { const p = e.getUILocation(); this.pointerDown(p.x, p.y); };
        const onMoveMouse = (e: EventMouse) => { const p = e.getUILocation(); this.aim(p.x, p.y); };
        input.on(Input.EventType.TOUCH_START, onDownTouch, this);
        input.on(Input.EventType.TOUCH_MOVE, onMoveTouch, this);
        input.on(Input.EventType.MOUSE_DOWN, onDownMouse, this);
        input.on(Input.EventType.MOUSE_MOVE, onMoveMouse, this);

        const lb = label(this.node, '', 0, PLAY_AREA.y1 - 14, 320, 44, {
            size: 26, color: '#FFE9A8', outline: '#20160A', outlineWidth: 3,
        });
        this.overflowLb = lb.node;
        this.overflowLb.active = false;

        this.rebuild();
        G.addListener(() => this.sync());
    }

    update(dt: number) {
        // 层级重排节流
        if (this.depthDirty) {
            this.depthAcc += dt;
            if (this.depthAcc >= 0.12) {
                this.depthAcc = 0;
                this.depthDirty = false;
                this.doSort();
            }
        }
        // 光标圈 = 「玩家科技·光标」解锁后才有（初始没有圈）。
        // 圈只是**触发范围指示**，圈内的瓶子会不会自动翻，取决于那阶有没有买「悬停翻转」——
        // 所以这里不再要求「至少有一阶买过悬停」。
        // ★ 用户反馈：只买某阶「悬停翻转」（没点光标天赋 p_cursor）时，扫过该阶瓶子也要能翻 ——
        //   悬停触发判定不能被「光标圈视觉」的门控挡住（原来 !cursorOn 直接 return，触发循环永不跑）。
        //   触发半径用 G.cursorRadius（p_cursorsize 有 base=55 的默认值，没天赋也有合理半径）。
        const cursorOn = G.hasCursor && !Modal.open;
        if (!cursorOn) {
            if (this.cursorRing && this.cursorRing.isValid) { this.cursorRing.active = false; }
            if (this.cursorPin && this.cursorPin.isValid) { this.cursorPin.active = false; }
        }
        if (Modal.open) { return; }   // 模态开着只藏圈，不做悬停触发
        if (!this.pointerSeeded) {
            this.pointerSeeded = true;
            this.pointer.set((PLAY_AREA.x0 + PLAY_AREA.x1) / 2, (PLAY_AREA.y0 + PLAY_AREA.y1) / 2);
        }
        if (cursorOn && (!this.cursorRing || !this.cursorRing.isValid)) {
            // ① 范围圈：地面贴片 —— setSiblingIndex(0) 让它排在影子层/瓶子层之下，
            //    当「落点范围」看，不会盖住任何瓶子。
            this.cursorRing = nd(this.node, 'cursorRing', 10, 10, 0, -999);
            this.cursorRing.setSiblingIndex(0);
            setFrame(this.cursorRing.addComponent(Sprite), 'env/areacircle', 10, 10, '#FFD75E');
            this.cursorRing.addComponent(UIOpacity).opacity = 55;
        }
        if (cursorOn && (!this.cursorPin || !this.cursorPin.isValid)) {
            // ② 手指指针：顶层 —— 追加到子节点末尾，永远盖在瓶子之上（用户要求「要在上层」）；
            //    贴图中心按指尖偏移让位，保证**指尖**精准落在触摸点上。
            //
            // ⚠️ 投影必须是 pin 的**子节点**且排在手指前面：Cocos 的 UI 渲染是深度优先，
            //    同一个节点自己的 Sprite 先画、子节点后画 —— 把投影做成 pin 自身 Sprite 的
            //    兄弟会盖在手指上面（实测手指被染成灰色）。所以这里是「无渲染的容器 + 两个子节点」。
            this.cursorPin = nd(this.node, 'cursorPin', CURSOR_PIN_W, CURSOR_PIN_H, 0, -999);
            // 投影：同一张贴图染黑、往右下偏几像素。瓶子也是粗黑描边，手指直接叠上去会糊成一团，
            // 有这层黑影手指才读得出「浮在桌面上」而不是「被瓶子挡住」。
            const shadow = nd(this.cursorPin, 'shadow', CURSOR_PIN_W, CURSOR_PIN_H, 3, -4);
            setFrame(shadow.addComponent(Sprite), 'env/cursor', CURSOR_PIN_W, CURSOR_PIN_H, '#101010');
            shadow.addComponent(UIOpacity).opacity = 95;

            const hand = nd(this.cursorPin, 'hand', CURSOR_PIN_W, CURSOR_PIN_H, 0, 0);
            setFrame(hand.addComponent(Sprite), 'env/cursor', CURSOR_PIN_W, CURSOR_PIN_H);
            hand.addComponent(UIOpacity).opacity = 235;
            this.cursorPin.setSiblingIndex(this.node.children.length - 1);
        }
        // 吸附半径 = 0.55m × (1 + 0.05L)（§5.1 分支 2），单位 px
        const r = G.cursorRadius;
        if (cursorOn) {
            setSize(this.cursorRing, r * 2, r * 2);
            this.cursorRing.setPosition(this.pointer.x, this.pointer.y, 0);
            this.cursorRing.active = true;
            this.cursorPin.setPosition(this.pointer.x + PIN_DX, this.pointer.y + PIN_DY, 0);
            this.cursorPin.active = true;
        }

        for (const b of this.bottles) {
            if (!b.idle) { continue; }
            // 买瓶飞入期间真瓶子是藏起来的（node.active=false），别让它被光标扫到
            if (!b.node.activeInHierarchy) { continue; }
            // ★ 圈内只触发「该阶已解锁悬停翻转」的瓶子；没解锁的该阶瓶子只能点击（原版操作流）
            if (!G.hoverable(b.tier)) { continue; }
            const dx = b.node.position.x - this.pointer.x;
            const dy = b.node.position.y + LAYOUT.bottleH * 0.30 - this.pointer.y;
            if (dx * dx + dy * dy < r * r) {
                const key = b.node.uuid;
                const now = performance.now();
                if (!this.hitLock[key] || now - this.hitLock[key] > 150) {   // GDD §10 防狂点节流 0.15s
                    this.hitLock[key] = now;
                    this.flip(b);
                }
            }
        }
        void dt;
    }

    /* ---------------- 布局 ---------------- */

    /**
     * 把 UI 坐标（touch / mouse 的 getUILocation）换算成 field 的本地坐标。
     * 世界层会随屏幕自适应缩放/平移，**不能**直接减半屏，必须用节点变换反算。
     * （本工程的 UI 世界原点 = 可见设计区左下角，所以 getUILocation 与
     *   convertToNodeSpaceAR 期望的入参是同一个空间，实测 localOf(worldOrigin) = (0,0)。）
     *
     * ⚠️ 这里**不**检查 `G.hasCursor`：pointer 同时承担「点击命中判定」，
     *    而开局是没解锁光标的 —— 之前加了这道门槛，导致没光标时 pointer 永远不更新，
     *    点击瓶子直接失效（实测 flips 恒为 0）。光标**显示**与否由 update() 单独控制。
     */
    private aim(uiX: number, uiY: number) {
        if (Modal.open) { return; }
        const ut = this.node.getComponent(UITransform);
        if (!ut) { return; }
        const v = ut.convertToNodeSpaceAR(new Vec3(uiX, uiY, 0));
        this.pointer.set(v.x, v.y);
    }

    /** 按下：先定位光标，再做点击命中判定 */
    private pointerDown(uiX: number, uiY: number) {
        this.aim(uiX, uiY);
        if (Modal.open) { return; }
        this.tapAt(this.pointer.x, this.pointer.y);
    }

    /**
     * 点击命中：一次按下命中的**所有**瓶子各自触发一次翻转判定。
     *
     * 为什么自己算命中、不用节点自带事件：
     *  · 命中框与可见瓶身严格一致（点瓶口/瓶底也算中，点旁边空白不算中）；
     *  · **瓶子之间互不阻挡** —— 两只瓶子视觉上重叠时，重叠处按下两只都会翻，
     *    而不是只有渲染在上面的那只吃掉事件；
     *  · 点在空白处**不会**再「随机翻一只」（原来点 A 打空就翻 B，手感完全错）。
     *
     * ⚠️ 入参 x/y 是 field 本地坐标，但 `Bottle.hitTest` 内部用 `convertToNodeSpaceAR`，
     *    它要的是**世界坐标** —— 两者差着 field 节点自身的位移/缩放，必须先换算。
     */
    private tapAt(x: number, y: number) {
        const ut = this.node.getComponent(UITransform);
        if (!ut) { return; }
        const tmp = this.node.getWorldPosition().clone();
        tmp.x = x; tmp.y = y; tmp.z = 0;
        const w = ut.convertToWorldSpaceAR(tmp);
        for (const b of this.bottles) {
            if (!b.idle) { continue; }
            if (!b.node.activeInHierarchy) { continue; }   // 飞入途中（真瓶子藏起来）不参与命中
            if (b.hitTest(w.x, w.y)) { this.flip(b); }
        }
    }

    sync() {
        if (!this.node || !this.node.isValid) { return; }
        const want = G.data.bottles.slice();
        const total = want.reduce((a, b) => a + b, 0);
        const visTotal = Math.min(total, VISIBLE_MAX);

        while (this.bottles.length > visTotal) {
            const b = this.bottles.pop()!;
            if (b.shadowNode && b.shadowNode.isValid) { b.shadowNode.destroy(); }
            b.node.destroy();
        }
        // ★ 按阶数量对账（用户反馈：加第二种瓶子没飞入动画、场上瓶子还换位置）——
        //   原来按 seq（高阶在前）逐位比对，新阶瓶子插队首时会把**已有旧瓶就地换皮**：
        //   没有飞入动画、还占着旧位置，看起来就是「瓶子自己换了/挪了」。
        //   现在已有的瓶子一个不动，缺哪阶补建哪阶，新建的正好接上飞入动画。
        const wantVis = [0, 0, 0, 0, 0, 0, 0];
        let left = visTotal;
        for (let t = 6; t >= 0; t--) {
            wantVis[t] = Math.min(want[t], left);
            left -= wantVis[t];
        }
        const have = [0, 0, 0, 0, 0, 0, 0];
        for (const b of this.bottles) { have[b.tier]++; }

        // ① 删多余的（一般不会发生：各阶数量只增不减）
        for (let i = this.bottles.length - 1; i >= 0; i--) {
            const b = this.bottles[i];
            if (have[b.tier] > wantVis[b.tier]) {
                have[b.tier]--;
                this.bottles.splice(i, 1);
                if (b.shadowNode && b.shadowNode.isValid) { b.shadowNode.destroy(); }
                b.node.destroy();
            }
        }

        // ② 缺的按阶补建（从高阶到低阶，与 seq 口径一致）
        for (let t = 6; t >= 0; t--) {
            while (have[t] < wantVis[t]) {
                // ★ 用户口径：买瓶飞到**场地中间**（带 ±40px 抖动防完全重叠）；非购买路径仍随机散布
                const fly = !!this.flyReq && this.flyReq.tier === t;
                const spot = fly
                    ? { x: (PLAY_AREA.x0 + PLAY_AREA.x1) / 2 + (Math.random() - 0.5) * 80,
                        y: (PLAY_AREA.y0 + PLAY_AREA.y1) / 2 + (Math.random() - 0.5) * 80 }
                    : this.pickSpot();
                const b = Bottle.create(this.bottleHolder, this.shadowHolder, t, spot.x, spot.y);
                // 不再挂 b.enableTouch：点击命中统一由 tapAt() 自己判定（见那里的注释）
                b.onLanded = (bb, oc) => this.onLanded(bb, oc);
                this.bottles.push(b);
                have[t]++;
                // 买瓶飞入：这次新建的正是玩家刚买的那阶 → 交给飞行动画（它会先把瓶子藏起来）
                if (fly) { this.startFlyIn(b, this.flyReq!.src); }
            }
        }
        // 登记超时作废（正常在 startFlyIn 里消费；一直没建出瓶子 = 桌子满了 / 数据没变）
        if (this.flyReq && performance.now() - this.flyReq.born > 2000) { this.flyReq = null; }
        this.doSort();

        const extra = total - visTotal;
        if (extra > 0) {
            this.overflowLb.active = true;
            (this.overflowLb.getComponent('cc.Label') as any).string = '+' + extra;
        } else {
            this.overflowLb.active = false;
        }
    }

    rebuild() { this.sync(); }

    /**
     * 在桌面活动区里随机取一个落点。
     * best-of-6 候选里挑「离其他瓶子最远」的那个 —— 允许堆叠，但不会完全重合。
     */
    pickSpot(avoid?: Bottle): { x: number, y: number } {
        let bx = PLAY_AREA.x0, by = PLAY_AREA.y0, best = -1;
        const w = PLAY_AREA.x1 - PLAY_AREA.x0;
        const h = PLAY_AREA.y1 - PLAY_AREA.y0;
        for (let k = 0; k < 6; k++) {
            const x = PLAY_AREA.x0 + Math.random() * w;
            const y = PLAY_AREA.y0 + Math.random() * h;
            let d = Infinity;
            for (let i = 0; i < this.bottles.length; i++) {
                const o = this.bottles[i];
                if (o === avoid || !o.node.isValid) { continue; }
                const dx = o.posX - x;
                const dy = (o.posY - y) * 1.7;     // 纵向更占地方，权重更高
                const dd = dx * dx + dy * dy;
                if (dd < d) { d = dd; }
            }
            if (d > best) { best = d; bx = x; by = y; }
        }
        return { x: bx, y: by };
    }

    /**
     * 请求重排渲染层级。
     * 位置变化时标记脏，由 update 以 ~0.12s 节流真正执行 —— 每次重排要动 2N 个子节点索引，
     * 高频落地时（10 只助手）全量重排会明显吃 CPU。
     */
    private sortOrder: number[] = [];
    private scratch: number[] = [];
    private depthDirty = false;
    private depthAcc = 0;
    sortDepth() { this.depthDirty = true; }

    /** 真正重排：y 越大（越靠后）层级越低；顺序没变就不动，省掉 setSiblingIndex */
    private doSort() {
        const arr = this.bottles;
        const n = arr.length;
        const order = this.scratch;
        order.length = n;
        for (let i = 0; i < n; i++) { order[i] = i; }
        order.sort((a, b) => arr[b].posY - arr[a].posY);

        let same = this.sortOrder.length === n;
        if (same) {
            for (let i = 0; i < n; i++) { if (this.sortOrder[i] !== order[i]) { same = false; break; } }
        }
        if (same) { return; }
        this.sortOrder.length = n;
        for (let i = 0; i < n; i++) { this.sortOrder[i] = order[i]; }
        for (let k = 0; k < n; k++) { arr[order[k]].setDepth(k); }
    }
    layout() { this.doSort(); }

    /* ---------------- 翻转 ---------------- */
    pickIdle(): Bottle | null {
        const idle = this.bottles.filter(b => b.idle);
        if (idle.length === 0) { return null; }
        return idle[Math.floor(Math.random() * idle.length)];
    }

    flip(b: Bottle): boolean {
        if (!b || !b.idle) { return false; }
        const speed = G.tierFlipSpeed(b.tier);
        // 玩家点击音效（节流：连点时不会糊成一片）
        Res.I?.playThrottledRand(TAP_SFX, 'tap', 38, 0.55);
        if (G.samuraiActive) {
            b.hover(150, 0.30, () => b.executeLand(speed, () => this.onLanded(b, 'crit')));
            return true;
        }
        const outcome = G.rollOutcome(b.tier);
        return b.flip(outcome, speed, false, this.pickSpot(b));
    }

    /** 飞天可乐冲击波：全屏瓶子同时腾空，100% 落地（GDD §5.1-1） */
    flipAllByShock() {
        FxLayer.I?.shockwave(0, 40, 560, 0.5, '#FFD86B');
        FxLayer.I?.shake(10, 0.3);
        let i = 0;
        for (const b of this.bottles) {
            if (!b.idle) { continue; }
            const d = i * 0.03;
            i++;
            this.scheduleOnce(() => {
                if (!b.isValid || !b.idle) { return; }
                b.forceFlip(G.tierFlipSpeed(b.tier), () => {
                    const r = G.doFlipResult(b.tier, 'crit');
                    this.spawnCaps(b, r);
                    this.showGain(b, r.amount, true, false);
                });
            }, d);
        }
    }

    private onLanded(b: Bottle, outcome: Outcome) {
        if (outcome === 'fail') {
            // ★ 用户口径（第十六轮）：翻倒**不再**弹 MISS 评价飘字 ——
            //   负反馈文案在放置类里只会添堵；瓶子躺下本身就是最清楚的反馈。
            G.doFlipResult(b.tier, 'fail');
            return;
        }
        const r = G.doFlipResult(b.tier, outcome);
        this.spawnCaps(b, r);
        this.showGain(b, r.amount, r.crit, G.samuraiActive);
        this.sortDepth();

        // 连环二次翻转（FlipAgainUpgrade：每级 +2%）
        if (chance(G.tierAgainChance(b.tier))) {
            this.scheduleOnce(() => { if (b.isValid && b.idle) { this.flip(b); } }, 0.10);
        }
        // 随机连锁翻转（RandomFlipUpgrade：每级 +2%，点燃另一只正立静止的瓶子）
        if (chance(G.tierRandomChance(b.tier))) {
            const other = this.pickIdle();
            if (other && other !== b) {
                this.scheduleOnce(() => { if (other.isValid && other.idle) { this.flip(other); } }, 0.14);
            }
        }
    }

    /**
     * 瓶盖产出：把瓶盖抛射进桌底履带。
     *
     * ★ 用户口径（第十四轮）：**树立（ok）或倒立（crit）落地都获得 1 枚对应品质的瓶盖**。
     *   两道门槛仍然有效，任何一条不满足都**既没有瓶盖也没有瓶盖特效**：
     *   ① `r.deferred` —— State.doFlipResult 里没装瓶盖机器时 caps 被直接清零；
     *   ② `r.caps > 0` —— 翻倒（fail）不给瓶盖。
     *   CapMachine.spawnChips 内部还会再兜一道 `G.hasMachine`。
     */
    private spawnCaps(b: Bottle, r: FlipResult) {
        if (!r.deferred || r.caps <= 0) { return; }
        // 瓶盖直接从瓶身中心飞出（不再区分姿态）
        const p = b.node.position;
        CapMachine.I?.spawnChips(r.caps, b.tier, p.x, p.y);
    }

    private showGain(b: Bottle, amount: number, crit: boolean, samurai: boolean) {
        const p = b.node.position;
        const y = p.y + LAYOUT.bottleH * 0.78;
        if (!G.data.settings.hideIncome) {
            // ★ 用户口径（第十七轮）：不显示「扣盖」前缀，只显示钱数；正立/扣盖都是**绿色**钱数
            //   （Fx.floatText 池化 Label 自带深色描边，之前的浅绿 #B7F7A6 在奶油底上看不清）
            const txt = '$' + fmt(amount);
            FxLayer.I?.floatText(p.x, y, txt, '#3ED34F', crit ? 42 : 30, 82, 0.85);
        }
        if (crit) {
            // ★ 星星已在 Bottle.land 里画在瓶身正中间；这里原来又画一颗（在瓶子上方 75px）+
            //   一层金色闪屏 —— 用户口径「倒立显示一个光效星星即可」，所以重复的星去掉。
            //   全屏闪屏是「命中的整体反馈」，和星星不是一回事，保留。
            FxLayer.I?.flash('#FFC85A', 42, 0.22);
        }
        if (samurai) {
            FxLayer.I?.floatText(p.x, y + 46, '处决 +600%', '#FF9E7A', 24, 60, 0.8);
        }
    }

    /** 助手翻转 */
    helperFlip(b: Bottle): boolean {
        if (!b || !b.idle) { return false; }
        const outcome = G.rollOutcome(b.tier);
        return b.flip(outcome, G.tierFlipSpeed(b.tier) * 0.5, true, this.pickSpot(b));
    }

    positionOf(b: Bottle): Vec3 { return b.node.position; }
}

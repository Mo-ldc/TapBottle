import { _decorator, Component, Node, Sprite, Vec2, Vec3, UIOpacity, UITransform, input, Input, EventTouch, EventMouse } from 'cc';
import { LAYOUT, PLAY_AREA, VISIBLE_BOTTLES } from '../Core/GameConfig';
import { G } from '../Core/State';
import { chance, fmt } from '../Core/Util';
import { FlipResult } from '../Core/State';
import { Res } from '../Core/Res';
import { Bottle } from './Bottle';
import { CapMachine } from './CapMachine';
import { FxLayer } from './Fx';
import { label, nd, setFrame, setSize } from '../UI/UIKit';
import { Modal } from '../UI/Modal';

const { ccclass } = _decorator;

const VISIBLE_MAX = VISIBLE_BOTTLES;

/** 玩家点击音效候选 */
const TAP_SFX = ['click', 'click2'];
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

        const lb = label(this.node, '', 0, LAYOUT.rowBaseline[0] + 150, 320, 44, {
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
        const cursorOn = G.hasCursor && !Modal.open;
        if (!cursorOn) {
            if (this.cursorRing && this.cursorRing.isValid) { this.cursorRing.active = false; }
            if (this.cursorPin && this.cursorPin.isValid) { this.cursorPin.active = false; }
            return;
        }
        if (!this.pointerSeeded) {
            this.pointerSeeded = true;
            this.pointer.set((PLAY_AREA.x0 + PLAY_AREA.x1) / 2, (PLAY_AREA.y0 + PLAY_AREA.y1) / 2);
        }
        if (!this.cursorRing || !this.cursorRing.isValid) {
            // ① 范围圈：地面贴片 —— setSiblingIndex(0) 让它排在影子层/瓶子层之下，
            //    当「落点范围」看，不会盖住任何瓶子。
            this.cursorRing = nd(this.node, 'cursorRing', 10, 10, 0, -999);
            this.cursorRing.setSiblingIndex(0);
            setFrame(this.cursorRing.addComponent(Sprite), 'env/areacircle', 10, 10, '#FFD75E');
            this.cursorRing.addComponent(UIOpacity).opacity = 55;
        }
        if (!this.cursorPin || !this.cursorPin.isValid) {
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
        setSize(this.cursorRing, r * 2, r * 2);
        this.cursorRing.setPosition(this.pointer.x, this.pointer.y, 0);
        this.cursorRing.active = true;
        this.cursorPin.setPosition(this.pointer.x + PIN_DX, this.pointer.y + PIN_DY, 0);
        this.cursorPin.active = true;

        for (const b of this.bottles) {
            if (!b.idle) { continue; }
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
        const seq: number[] = [];
        for (let t = 6; t >= 0; t--) {
            for (let i = 0; i < want[t] && seq.length < visTotal; i++) { seq.push(t); }
        }
        for (let i = 0; i < seq.length; i++) {
            if (i < this.bottles.length) {
                if (this.bottles[i].tier !== seq[i]) {
                    this.bottles[i].tier = seq[i];
                    this.bottles[i].refresh();
                }
            } else {
                const spot = this.pickSpot();
                const b = Bottle.create(this.bottleHolder, this.shadowHolder, seq[i], spot.x, spot.y);
                // 不再挂 b.enableTouch：点击命中统一由 tapAt() 自己判定（见那里的注释）
                b.onLanded = (bb, oc) => this.onLanded(bb, oc);
                this.bottles.push(b);
            }
        }
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
            G.doFlipResult(b.tier, 'fail');
            FxLayer.I?.floatText(b.node.position.x, b.node.position.y + 130, 'MISS', '#FF8A8A', 26, 50, 0.5);
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

    /** 扣盖产出：把瓶盖投进左侧履带（未解锁履带时 State 已直接入账） */
    private spawnCaps(b: Bottle, r: FlipResult) {
        if (!r.deferred || r.caps <= 0) { return; }
        // 扣盖姿态是倒立的，瓶口在下 → 瓶盖从瓶子下沿喷出
        const p = b.node.position;
        CapMachine.I?.spawnChips(r.caps, b.tier, p.x, p.y - LAYOUT.bottleH * 0.34);
    }

    private showGain(b: Bottle, amount: number, crit: boolean, samurai: boolean) {
        const p = b.node.position;
        const y = p.y + LAYOUT.bottleH * 0.78;
        if (!G.data.settings.hideIncome) {
            const txt = (crit ? '扣盖 ' : '') + '$' + fmt(amount);
            FxLayer.I?.floatText(p.x, y, txt, crit ? '#FFD75E' : '#B7F7A6', crit ? 42 : 30, 82, 0.85);
        }
        if (crit) {
            FxLayer.I?.sparkle(p.x, y + 20, 120, '#FFE9A0');
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

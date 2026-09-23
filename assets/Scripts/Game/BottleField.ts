import { _decorator, Component, Node, Sprite, Vec2, Vec3, UIOpacity, UITransform, input, Input, EventTouch } from 'cc';
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

export type Outcome = 'crit' | 'ok' | 'fail';

/** 瓶子阵：布局、点击/悬停翻转、冲击波 */
@ccclass('BottleField')
export class BottleField extends Component {
    static I: BottleField = null!;

    bottles: Bottle[] = [];
    private overflowLb: Node = null!;
    private cursor: Node = null!;
    private pointer = new Vec2(0, 0);
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
        // 空白处点击 -> 翻转随机瓶子
        this.node.on(Node.EventType.TOUCH_END, () => {
            if (Modal.open) { return; }
            const b = this.pickIdle();
            if (b) { this.flip(b); }
        }, this);

        // 光标区域：拖动手指连续翻转（GDD §3.1-2）
        input.on(Input.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!G.hasCursor || Modal.open) { return; }
            const p = e.getUILocation();
            // 世界层会随屏幕自适应缩放/平移，必须用节点变换反算，不能直接减半屏
            const ut = this.node.getComponent(UITransform);
            if (!ut) { return; }
            const v = ut.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
            this.pointer.set(v.x, v.y);
        }, this);
        input.on(Input.EventType.TOUCH_END, () => {
            if (this.cursor && this.cursor.isValid) { this.cursor.active = false; }
        }, this);

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
        if (!G.hasCursor) {
            if (this.cursor && this.cursor.isValid) { this.cursor.active = false; }
            return;
        }
        if (!this.cursor || !this.cursor.isValid) {
            this.cursor = nd(this.node, 'cursor', 76, 76, 0, -999);
            const sp = this.cursor.addComponent(Sprite);
            setFrame(sp, 'env/cursor', 76, 76);
            this.cursor.setScale(1.2, 1.2, 1);
            this.cursor.addComponent(UIOpacity).opacity = 200;
        }
        const r = 70 * G.cursorSize;
        setSize(this.cursor, r * 2, r * 2);
        this.cursor.setPosition(this.pointer.x, this.pointer.y, 0);
        this.cursor.active = true;

        for (const b of this.bottles) {
            if (!b.idle) { continue; }
            const dx = b.node.position.x - this.pointer.x;
            const dy = b.node.position.y + LAYOUT.bottleH * 0.30 - this.pointer.y;
            if (dx * dx + dy * dy < r * r * 0.40) {
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
                b.enableTouch((bb) => { if (!Modal.open) { this.flip(bb); } });
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

        if (chance(G.tierAgainChance(b.tier))) {
            this.scheduleOnce(() => { if (b.isValid && b.idle) { this.flip(b); } }, 0.10);
        }
        if (chance(G.tierAgainChance(b.tier) * 0.5)) {
            const other = this.pickIdle();
            if (other && other !== b) {
                this.scheduleOnce(() => { if (other.isValid && other.idle) { this.flip(other); } }, 0.06);
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

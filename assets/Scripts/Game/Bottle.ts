import { _decorator, Component, Node, Sprite, tween, Tween, Vec3, Color, UIOpacity, Enum } from 'cc';
import { LAYOUT, TIERS } from '../Core/GameConfig';
import { Res } from '../Core/Res';
import { hex } from '../Core/Util';
import { G } from '../Core/State';
import { FxLayer } from './Fx';
import { img, nd, setFrame, setSize } from '../UI/UIKit';

const { ccclass } = _decorator;

export const BOTTLE_SCALE = LAYOUT.bottleH / 375;

/** 影子相对「瓶身静止基准点」的下移量：贴在瓶底、再往上一点（值越小越贴近瓶子） */
const SHADOW_DY = LAYOUT.bottleH * 0.375;

/** 落地姿态：瓶口朝上(ok) / 瓶口朝下·扣盖(crit) / 平放(fail) */
export type Pose = { angle: number; dx: number; dy: number };

@ccclass('Bottle')
export class Bottle extends Component {
    tier = 0;
    busy = false;
    /** 落地回调：参数为落地姿态 */
    onLanded: ((b: Bottle, outcome: 'crit' | 'ok' | 'fail') => void) | null = null;

    private body: Sprite = null!;
    private shadow: Node = null!;
    private shadowSp: Sprite = null!;
    private homeX = 0;
    private homeY = 0;
    /** 当前静止姿态相对格子中心的偏移（平放会横向滑出、倒立要抬高） */
    private restDx = 0;
    private restDy = 0;
    private angleTween: Tween<Node> | null = null;

    static create(parent: Node, shadowParent: Node, tier: number, x: number, y: number): Bottle {
        const n = nd(parent, 'bottle' + tier, 100, 200, x, y);
        const b = n.addComponent(Bottle);
        b.build(shadowParent, tier, x, y);
        return b;
    }

    private build(shadowParent: Node, tier: number, x: number, y: number) {
        this.tier = tier;
        this.homeX = x; this.homeY = y;
        this.node.setScale(BOTTLE_SCALE, BOTTLE_SCALE, 1);

        // 影子：统一挂在「影子层」（位于所有瓶子之下），位置贴在瓶底再往上一点
        this.shadow = nd(shadowParent, 'shadow', 64, 24, x, y - SHADOW_DY);
        this.shadowSp = this.shadow.addComponent(Sprite);
        setFrame(this.shadowSp, 'env/disc', 64, 24, new Color(0, 0, 0, 118));
        this.shadow.setScale(1, 1, 1);

        // 瓶身（锚点在瓶底偏上，便于绕“瓶底”翻转）
        const bn = nd(this.node, 'art', 150, 375, 0, 0, 0.5, 0.34);
        this.body = bn.addComponent(Sprite);
        setFrame(this.body, 'bottle/body_' + TIERS[tier].art, 150, 375);

        // 贴图本身画的是「瓶口朝下」，所以静置默认要转 180° 才是瓶口朝上
        this.node.angle = 180;
        this.restDy = LAYOUT.bottleH * 0.32;
        this.applyRest(false);
    }

    /** 让节点可点 */
    enableTouch(cb: (b: Bottle) => void) {
        this.node.on(Node.EventType.TOUCH_START, (e: any) => {
            e.propagationStopped = true;
            cb(this);
        });
    }

    /** 刷新外观（换档时） */
    refresh() {
        setFrame(this.body, 'bottle/body_' + TIERS[this.tier].art, 150, 375);
    }

    /** 是否处于可翻转的静止状态 */
    get idle(): boolean { return !this.busy; }

    /** 当前格子中心（世界层设计坐标），供撒点算法避让 */
    get posX(): number { return this.homeX + this.restDx; }
    get posY(): number { return this.homeY + this.restDy; }

    /** 影子节点（供回收时清理） */
    get shadowNode(): Node { return this.shadow; }

    /** 影子基准缩放（躺平时更宽更扁） */
    private shadowSX = 1;
    private shadowSY = 1;

    /** 渲染层级：前排（y 小）应盖住后排。影子在独立影子层，不参与排序 */
    setDepth(order: number) {
        this.node.setSiblingIndex(order);
    }

    /* ---------------- 姿态 ---------------- */

    /** 从 from 到 to 的最短角度差（-180,180] */
    private static angDelta(from: number, to: number): number {
        let d = (to - from) % 360;
        if (d > 180) { d -= 360; }
        if (d < -180) { d += 360; }
        return d;
    }

    /**
     * 三态落地姿态（GDD §3.1）：
     *  - ok   瓶口朝上：正立，得基础金币
     *  - crit 瓶口朝下：倒扣在瓶口上（“扣盖”），金币最多 + 掉瓶盖
     *  - fail 平放：随机倒向左侧或右侧躺平，不得钱
     */
    private static poseOf(outcome: 'crit' | 'ok' | 'fail'): Pose {
        // 关键：贴图 bottle/body_*.png 画的是「瓶口朝下」（原版 water-bottle-flip 的立瓶姿态），
        // 所以 0° = 瓶口朝下，180° = 瓶口朝上。
        if (outcome === 'ok') {
            // 瓶口朝上：翻正后原本的最低点变成瓶底，整体上抬，避免插进桌面
            return { angle: 180, dx: 0, dy: LAYOUT.bottleH * 0.32 };
        }
        if (outcome === 'crit') {
            // 瓶口朝下（扣盖）：贴图原姿态即可
            return { angle: 0, dx: 0, dy: 0 };
        }
        // 平放：绕瓶底偏上 0.34 处转 ±93°，瓶身最低点是节点原点下方 0.234*bottleH，
        // 贴图锚点在瓶底上方 0.34*bottleH —— 两者之差即让「躺瓶」正好落在桌面线上。
        return { angle: Math.random() < 0.5 ? -93 : 93, dx: 0, dy: -LAYOUT.bottleH * 0.106 };
    }

    /** 把节点摆到当前静止姿态（可选动画） */
    private applyRest(animate: boolean) {
        const tx = this.homeX + this.restDx;
        const ty = this.homeY + this.restDy;
        // 影子的 y 只跟 homeY（地面线）走，不能带 restDy：
        // 贴图锚点在瓶底上方 0.34 处，restDy 正是为「180° 翻转后瓶底重新落到地面线」而设的补偿量，
        // 若影子跟着 restDy 一起抬，正立(ok)时影子会浮到瓶身中段、被瓶子完全盖住。
        const shPos = new Vec3(tx, this.homeY - SHADOW_DY, 0);
        if (animate) {
            tween(this.node).to(0.16, { position: new Vec3(tx, ty, 0) }, { easing: 'quadOut' }).start();
            tween(this.shadow).to(0.16, {
                position: shPos,
                scale: new Vec3(this.shadowSX, this.shadowSY, 1),
            }).start();
        } else {
            this.node.setPosition(tx, ty, 0);
            this.shadow.setPosition(shPos);
            this.shadow.setScale(this.shadowSX, this.shadowSY, 1);
        }
    }

    /**
     * 开始翻转动画（GDD §3.1 三态）
     * @param target 落地目标点（不传则落回原位）——桌面即「随机落点集合」，瓶子允许互相堆叠
     */
    flip(outcome: 'crit' | 'ok' | 'fail', speedMul: number, silent = false, target?: { x: number, y: number }): boolean {
        if (this.busy) { return false; }
        this.busy = true;

        const dur = Math.max(0.13, 0.30 / (1 + speedMul));
        const sx = this.homeX + this.restDx;
        const sy = this.homeY + this.restDy;
        const jump = (outcome === 'crit' ? 210 : 150) + Math.random() * 90;
        const s = BOTTLE_SCALE;

        // 先定好落点姿态，保证旋转结束时正好朝向目标
        const pose = Bottle.poseOf(outcome);
        const landX = target ? target.x : this.homeX;
        const landY = target ? target.y : this.homeY;
        const endX = landX + (outcome === 'fail' ? (pose.angle < 0 ? -42 : 42) : 0);
        const endY = landY + pose.dy;

        const start = this.node.angle;
        const spins = (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 2));
        const endAngle = start + spins + Bottle.angDelta(start, pose.angle);

        // 影子：起跳时收缩（躺平的影子更宽更扁）
        this.shadowSX = outcome === 'fail' ? 1.45 : 1;
        this.shadowSY = outcome === 'fail' ? 0.70 : 1;
        tween(this.shadow)
            .to(dur * 0.5, { scale: new Vec3(this.shadowSX * 0.55, this.shadowSY * 0.55, 1) })
            .to(dur * 0.5, { scale: new Vec3(this.shadowSX, this.shadowSY, 1) }).start();

        // 旋转（从当前角度起转，躺着的瓶子会先“翻身”再落地）
        this.angleTween = tween(this.node).to(dur * 2, { angle: endAngle }, { easing: 'sineInOut' });
        this.angleTween.start();

        // 位移：从当前点抛到随机落点（两段近似抛物线）
        tween(this.node)
            .to(dur, { position: new Vec3(sx + (endX - sx) * 0.5, Math.max(sy, endY) + jump, 0) }, { easing: 'quadOut' })
            .to(dur, { position: new Vec3(endX, endY, 0) }, { easing: 'quadIn' })
            .call(() => this.land(outcome, s, silent, pose, landX, landY))
            .start();

        return true;
    }

    private land(outcome: 'crit' | 'ok' | 'fail', s: number, silent: boolean, pose: Pose, landX: number, landY: number) {
        if (this.angleTween) { this.angleTween.stop(); this.angleTween = null; }
        this.node.angle = pose.angle;
        this.homeX = landX;
        this.homeY = landY;
        this.restDy = pose.dy;

        // 落地音效：只有玩家亲手翻的才响（助手/冲击波是 silent），并做节流防糊
        if (!silent) {
            Res.I?.playThrottled(
                outcome === 'crit' ? 'win' : (outcome === 'fail' ? 'pop1' : 'hit'),
                'land_' + outcome,
                outcome === 'crit' ? 90 : 55,
                outcome === 'crit' ? 0.75 : (outcome === 'fail' ? 0.42 : 0.5));
        }

        if (outcome === 'fail') {
            // 平放：向随机一侧滑倒并保持躺姿
            const dir = pose.angle < 0 ? -1 : 1;
            this.restDx = dir * 42;
            this.applyRest(true);
            const op = this.node.getComponent(UIOpacity);
            void op;
            this.scheduleOnce(() => { this.busy = false; }, 0.12);
            if (this.onLanded) { this.onLanded(this, outcome); }
            return;
        }

        this.restDx = 0;
        this.applyRest(false);

        const crit = outcome === 'crit';
        const pop = crit ? 1.30 : 1.18;
        const squash = crit ? 0.70 : 0.80;
        tween(this.node)
            .to(0.06, { scale: new Vec3(s * pop, s * squash, 1) })
            .to(0.10, { scale: new Vec3(s * 0.94, s * 1.06, 1) })
            .to(0.09, { scale: new Vec3(s, s, 1) })
            .call(() => { this.busy = false; })
            .start();

        if (!silent && FxLayer.I) {
            if (!G.data.settings.hideCaps) { FxLayer.I.burst(this.homeX, this.homeY + 10, crit ? 7 : 3, this.tier); }
            // 扣盖是倒立姿态（瓶口贴地），星光压低；正立则往上放
            FxLayer.I.sparkle(this.homeX, this.homeY + (crit ? 30 : 96), crit ? 130 : 60,
                crit ? '#FFD75E' : '#FFF6C0');
            if (crit) { FxLayer.I.shockwave(this.homeX, this.homeY + 10, 190, 0.36, '#FFD75E'); }
        }

        if (this.onLanded) { this.onLanded(this, outcome); }
    }

    /** 被冲击波掀翻：必定落到「瓶口朝下」的最优姿态 */
    forceFlip(speedMul: number, onDone: () => void) {
        if (this.busy) { return; }
        this.busy = true;
        const dur = Math.max(0.10, 0.22 / (1 + speedMul));
        const s = BOTTLE_SCALE;
        const jump = 130 + Math.random() * 70;
        const start = this.node.angle;
        const end = start + 360 + Bottle.angDelta(start, 0);
        const sy = this.homeY + this.restDy;

        tween(this.node).to(dur * 2, { angle: end }, { easing: 'sineInOut' }).start();
        tween(this.node)
            .to(dur, { position: new Vec3(this.homeX, sy + jump, 0) }, { easing: 'quadOut' })
            .to(dur, { position: new Vec3(this.homeX, this.homeY, 0) }, { easing: 'quadIn' })
            .call(() => {
                this.node.angle = 0;
                this.restDx = 0;
                this.restDy = 0;
                tween(this.node).to(0.05, { scale: new Vec3(s * 1.16, s * 0.82, 1) })
                    .to(0.09, { scale: new Vec3(s, s, 1) })
                    .call(() => { this.busy = false; onDone(); }).start();
            }).start();
    }

    /** 武士处决：悬停在空中 */
    hover(elevate: number, dur: number, onArrive: () => void) {
        this.busy = true;
        const from = new Vec3(this.homeX + this.restDx, this.homeY + this.restDy, 0);
        tween(this.node).to(dur, { position: new Vec3(from.x, from.y + elevate, 0) }, { easing: 'sineOut' })
            .call(onArrive).start();
    }

    /** 处决落地：同样是「瓶口朝下」的最优姿态 */
    executeLand(speedMul: number, onDone: () => void) {
        const dur = Math.max(0.12, 0.26 / (1 + speedMul));
        const s = BOTTLE_SCALE;
        const start = this.node.angle;
        const end = start + 360 + Bottle.angDelta(start, 0);

        tween(this.node).to(dur * 2, { angle: end }, { easing: 'sineInOut' }).start();
        tween(this.node).to(dur, { position: new Vec3(this.homeX, this.homeY, 0) }, { easing: 'quadIn' })
            .call(() => {
                this.node.angle = 0;
                this.restDx = 0;
                this.restDy = 0;
                tween(this.node).to(0.06, { scale: new Vec3(s * 1.22, s * 0.76, 1) })
                    .to(0.10, { scale: new Vec3(s, s, 1) })
                    .call(() => { this.busy = false; onDone(); }).start();
            }).start();
    }

    /** 光标悬停高亮 */
    highlight(on: boolean) {
        const s = BOTTLE_SCALE * (on ? 1.08 : 1);
        tween(this.node).to(0.08, { scale: new Vec3(s, s, 1) }).start();
    }

    moveHome(x: number, y: number, animate = true) {
        this.homeX = x; this.homeY = y;
        this.applyRest(animate);
    }

    onDestroy() {
        if (this.shadow && this.shadow.isValid) { this.shadow.destroy(); }
        void img; void Color; void UIOpacity; void Enum; void TIERS; void hex; void setSize;
    }
}

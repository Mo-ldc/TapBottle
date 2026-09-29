import { _decorator, Component, Node, Sprite, tween, Tween, Vec3, Color, UIOpacity, Enum, UITransform } from 'cc';
import { LAYOUT, TIERS } from '../Core/GameConfig';
import { Res } from '../Core/Res';
import { hex } from '../Core/Util';
import { G } from '../Core/State';
import { Pool } from '../Core/Pool';
import { FxLayer } from './Fx';
import { img, nd, setFrame, setSize } from '../UI/Base/UIKit';

const { ccclass, property } = _decorator;

/** 预制体 key（assets/resources/Prefabs/ 下的相对路径） */
const PF_BOTTLE = 'Game/Bottle';
const PF_SHADOW = 'Game/BottleShadow';

/** 瓶身贴图尺寸与锚点（build() 的 setFrame 与 hitTest 共用这一组，别再写魔数） */
const ART_W = 150, ART_H = 375, ART_AY = 0.34;

export const BOTTLE_SCALE = LAYOUT.bottleH / ART_H;

/* ---------------- 瓶身几何（贴图矩形 150×375，锚点在瓶底上方 0.34H，整图铺满无留白） ---------------- */

/** 正立（0°）时贴图矩形最低点相对锚点的下移（design px） */
const ART_DOWN = ART_H * ART_AY * BOTTLE_SCALE;               // 32.64
/** 倒立（180°）时最低点相对锚点的下移 = 原矩形上半段 */
const ART_UP = ART_H * (1 - ART_AY) * BOTTLE_SCALE;           // 63.36
/** 平放（±93°）时最低点相对锚点的下移 = 矩形四角旋转后取最小 y */
const ART_LIE = (ART_W / 2 * Math.sin(93 * Math.PI / 180)
    + ART_H * (1 - ART_AY) * Math.abs(Math.cos(93 * Math.PI / 180))) * BOTTLE_SCALE;  // ≈22.49

/** 桌面线 = homeY - GROUND_CLEAR（沿用正立瓶底现状：贴在格子基准线上方 1.92px） */
const GROUND_CLEAR = 1.92;

/**
 * ★ 用户口径（第五十轮）：**影子固定在桌面线，瓶子三态的剪影最低点统一落到桌面线**。
 *  旧行为：crit dy=0 / fail dy=-0.106H —— 倒立、平放瓶的剪影整体沉到桌面线以下 61/31px，
 *  而影子（只跟 homeY）还在桌面线上，看起来「影子在瓶子中间」。
 *  现在三种姿态的静止 y 补偿 = 本姿态最低点延伸 - GROUND_CLEAR，瓶底全部贴回同一条线。
 */
function restDyOf(angle: number): number {
    return (angle === 0 ? ART_DOWN : angle === 180 ? ART_UP : ART_LIE) - GROUND_CLEAR;
}

/** 影子中心相对桌面上移量：椭圆一半藏进瓶后、一半露出贴在瓶底正下（原 -7 显得「太靠下」） */
const SHADOW_LIFT = 2;

/**
 * 瓶身视觉中心相对节点原点的上移量。
 * 贴图锚点在瓶底上方 ART_AY=0.34 处 → 中心 = (0.66H − 0.34H)/2 = 0.16H（贴图单位）× 缩放。
 * ★ 落地星光就画在这里（用户口径：光效要在瓶子中间，不是瓶子上面）。
 */
const BODY_CENTER_DY = (ART_H * (1 - 2 * ART_AY) / 2) * BOTTLE_SCALE;

/** 供买瓶飞入动画复用（BottleField 里建临时精灵用同一套贴图尺寸与中心偏移） */
export const BOTTLE_ART = { w: ART_W, h: ART_H, centerDy: BODY_CENTER_DY };

/** 落地姿态：瓶口朝上(ok) / 瓶口朝下·扣盖(crit) / 平放(fail) */
export type Pose = { angle: number; dx: number; dy: number };

@ccclass('Bottle')
export class Bottle extends Component {
    /** 瓶身贴图节点 —— 在 Bottle.prefab 里建好并绑定；为空时运行时兜底创建 */
    @property({ type: Node, tooltip: '瓶身贴图节点（Bottle.prefab 内）' })
    art: Node = null!;

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

    /**
     * 从预制体实例化（走对象池，稳态零分配）。
     * 预制体缺失时兜底走旧的代码建节点路径，保证编辑器里直接跑也不崩。
     */
    static create(parent: Node, shadowParent: Node, tier: number, x: number, y: number): Bottle {
        let n: Node | null = Pool.acquire(PF_BOTTLE, parent);
        if (!n) { n = nd(parent, 'bottle' + tier, 100, 200, x, y); }
        n.name = 'bottle' + tier;
        n.setPosition(x, y, 0);
        const b = n.getComponent(Bottle) || n.addComponent(Bottle);
        b.build(shadowParent, tier, x, y);
        return b;
    }

    /** 回收：瓶身与影子一起归还对象池（不 destroy） */
    despawn() {
        try { Tween.stopAllByTarget(this.node); } catch (e) { /* ignore */ }
        if (this.shadow && this.shadow.isValid) { Pool.release(PF_SHADOW, this.shadow); }
        this.shadow = null!;
        this.shadowSp = null!;
        this.onLanded = null;
        this.busy = false;
        Pool.release(PF_BOTTLE, this.node);
    }

    private build(shadowParent: Node, tier: number, x: number, y: number) {
        this.tier = tier;
        this.homeX = x; this.homeY = y;
        this.node.setScale(BOTTLE_SCALE, BOTTLE_SCALE, 1);

        // 影子：统一挂在「影子层」（位于所有瓶子之下），中心贴在桌面线（瓶底）上
        let sh: Node | null = Pool.acquire(PF_SHADOW, shadowParent);
        if (!sh) { sh = nd(shadowParent, 'shadow', 64, 24, x, y - GROUND_CLEAR + SHADOW_LIFT); }
        this.shadow = sh;
        sh.setPosition(x, y - GROUND_CLEAR + SHADOW_LIFT, 0);
        sh.setScale(1, 1, 1);
        this.shadowSp = sh.getComponent(Sprite) || sh.addComponent(Sprite);
        // 第五十五轮：disc 重生成为硬边椭圆（AA 带 1~2px），浓度由着色 alpha 承担 ——
        // 旧有效 alpha≈(118/255)²≈21%，故 255 内芯 × 55 ≈ 原视觉浓度
        setFrame(this.shadowSp, 'env/disc', 64, 24, new Color(0, 0, 0, 55));

        // 瓶身（锚点在瓶底偏上，便于绕“瓶底”翻转）—— 预制体里已建好，只换贴图
        let bn = this.art;
        if (!bn || !bn.isValid) { bn = nd(this.node, 'art', ART_W, ART_H, 0, 0, 0.5, ART_AY); this.art = bn; }
        this.body = bn.getComponent(Sprite) || bn.addComponent(Sprite);
        setFrame(this.body, 'bottle/body_' + TIERS[tier].art, ART_W, ART_H);

        // ★ 用户口径（第三十三轮）：贴图已转正（bottle/body_*.png 瓶口朝上），
        //   静置默认 0° 就是正立；倒立/平放姿态全部由这张正立图旋转复用，无第二套资源。
        this.node.angle = 0;
        this.restDy = restDyOf(0);
        this.applyRest(false);
    }

    /**
     * 点是否落在**这只瓶子的瓶身**上（参数为世界层局部坐标）。
     *
     * 为什么要自己算、不用节点自带的 touch：
     *  ① 节点 UITransform 原来是 100×200（再乘 BOTTLE_SCALE≈0.53 → 世界只有 53×107），
     *     而可见瓶身贴图是 150×375（世界 80×200）—— 命中框比看得见的瓶子小一半多，
     *     点瓶口/瓶底经常打空，事件回落到场地被「空白处」逻辑接住 → 玩家点 A 结果 B 翻了；
     *  ② 瓶子矩形互相重叠时节点事件只有最上面那只收得到，被压住的那只永远点不到。
     * 所以统一改成「把点逆变换到节点本地，再判瓶身贴图矩形」，姿态旋转（180°/0°/±93°）也被正确考虑。
     */
    hitTest(wx: number, wy: number): boolean {
        if (!this.node || !this.node.isValid) { return false; }
        const ut = this.node.getComponent(UITransform);
        if (!ut) { return false; }
        const p = ut.convertToNodeSpaceAR(new Vec3(wx, wy, 0));
        // art 子节点：ART_W×ART_H、锚点 (0.5, ART_AY)，且固定在节点本地原点
        return p.x >= -ART_W * 0.5 && p.x <= ART_W * 0.5
            && p.y >= -ART_H * ART_AY && p.y <= ART_H * (1 - ART_AY);
    }

    /** 刷新外观（换档时） */
    refresh() {
        setFrame(this.body, 'bottle/body_' + TIERS[this.tier].art, ART_W, ART_H);
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

    /**
     * 把落点夹回活动区（第一百一十二轮：窗口比例变化 → 适配层收缩活动区后调用）。
     * 只动 homeX/homeY 并按当前姿态重新贴地；翻转途中（busy）只改落点数据、
     * 不打断 tween（落地时 land() 会用它自己的 landX/landY 覆盖，极小概率落在外面，可接受）。
     * @returns 是否真的移动过（供调用方决定要不要重排层级/重建索引）
     */
    clampToArea(x0: number, x1: number, y0: number, y1: number): boolean {
        const nx = Math.min(x1, Math.max(x0, this.homeX));
        const ny = Math.min(y1, Math.max(y0, this.homeY));
        if (nx === this.homeX && ny === this.homeY) { return false; }
        this.homeX = nx;
        this.homeY = ny;
        if (!this.busy) { this.applyRest(false); }
        return true;
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
        // ★ 用户口径（第三十三轮）：贴图已转正（瓶口朝上），所以 0° = 正立，180° = 瓶口朝下。
        //   倒立没有单独资源 —— 全部是正立贴图的旋转复用。
        //   ★ 第五十轮：dy 改由 restDyOf(angle) 统一推导 —— 三态剪影最低点都贴回桌面线。
        if (outcome === 'ok') {
            // 瓶口朝上：贴图原姿态即可
            return { angle: 0, dx: 0, dy: restDyOf(0) };
        }
        if (outcome === 'crit') {
            // 瓶口朝下（扣盖）：正立图旋转 180°
            return { angle: 180, dx: 0, dy: restDyOf(180) };
        }
        // 平放：绕瓶底偏上 0.34 处转 ±93°，瓶身最低点正好压在桌面线上（restDyOf 统一推导）。
        // ⚠️ 方向语义（换正立图后反了）：+93° = 视觉向**左**倒，-93° = 向**右**倒 ——
        //    滑倒方向 dir 在 land()/flip() 里按这个新语义取 sign。
        return { angle: Math.random() < 0.5 ? -93 : 93, dx: 0, dy: restDyOf(93) };
    }

    /** 把节点摆到当前静止姿态（可选动画） */
    private applyRest(animate: boolean) {
        const tx = this.homeX + this.restDx;
        const ty = this.homeY + this.restDy;
        // 影子的 y 只跟 homeY（桌面线）走，不随姿态变（★ 第五十轮：三态瓶底都贴回这条线）：
        // 贴图锚点在瓶底上方 0.34 处，restDy 已把每种姿态的剪影最低点补偿到桌面线，
        // 影子中心再相对桌面上抬 SHADOW_LIFT —— 椭圆一半藏在瓶后、一半露出贴住瓶底。
        const shPos = new Vec3(tx, this.homeY - GROUND_CLEAR + SHADOW_LIFT, 0);
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
        const endX = landX + (outcome === 'fail' ? (pose.angle < 0 ? 42 : -42) : 0);
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

        // 落地音效：只有玩家亲手翻的才响（助手/冲击波是 silent），并做节流防糊。
        // ★ 用户口径（第十七轮）：正立（ok）落地**不响**——只有倒立扣盖的 win 和翻倒的 pop1。
        if (!silent && outcome !== 'ok') {
            Res.I?.playThrottled(
                outcome === 'crit' ? 'win' : 'pop1',
                'land_' + outcome,
                outcome === 'crit' ? 90 : 55,
                outcome === 'crit' ? 0.75 : 0.42);
        }

        if (outcome === 'fail') {
            // 平放：向随机一侧滑倒并保持躺姿
            // ⚠️ 换正立图后方向语义反转：+93° = 视觉左倒（dir -1），-93° = 右倒（dir +1）
            const dir = pose.angle < 0 ? 1 : -1;
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

        // ★ 用户口径（第十六轮）：**只有倒立扣盖**给一颗星光，且画在**瓶身正中间**。
        //   倒立时瓶身视觉中心在锚点**下方** BODY_CENTER_DY（矩形绕锚点转了 180°）。
        //   正立（ok）不再有任何星光 —— 原来 ok 的星画在瓶子上方 96px（bottleH 全高），
        //   看起来就是「一颗飘在半空的光」，和瓶子没关系。
        //   瓶盖实体粒子只有一个出口：`CapMachine.spawnChips`。
        if (!silent && crit && FxLayer.I) {
            FxLayer.I.sparkle(this.homeX, this.node.position.y - BODY_CENTER_DY, 110, '#FFD75E');
        }

        if (this.onLanded) { this.onLanded(this, outcome); }
    }

    /**
     * 买瓶飞入落地的「直接判定」：不做抛跳、不再起跳重翻，直接摆出该次判定的落地姿态并结算
     * （BottleField.startFlyIn 用 —— 用户口径：飞进来了落地就能判断正反）。
     */
    settle(outcome: 'crit' | 'ok' | 'fail', silent = false) {
        const pose = Bottle.poseOf(outcome);
        this.land(outcome, BOTTLE_SCALE, silent, pose, this.homeX, this.homeY);
    }

    /** 被冲击波掀翻：必定落到「瓶口朝下」的最优姿态 */
    forceFlip(speedMul: number, onDone: () => void) {
        if (this.busy) { return; }
        this.busy = true;
        const dur = Math.max(0.10, 0.22 / (1 + speedMul));
        const s = BOTTLE_SCALE;
        const jump = 130 + Math.random() * 70;
        const start = this.node.angle;
        const end = start + 360 + Bottle.angDelta(start, 180);
        const sy = this.homeY + this.restDy;
        const dyCrit = restDyOf(180);

        tween(this.node).to(dur * 2, { angle: end }, { easing: 'sineInOut' }).start();
        tween(this.node)
            .to(dur, { position: new Vec3(this.homeX, sy + jump, 0) }, { easing: 'quadOut' })
            .to(dur, { position: new Vec3(this.homeX, this.homeY + dyCrit, 0) }, { easing: 'quadIn' })
            .call(() => {
                this.node.angle = 180;
                this.restDx = 0;
                this.restDy = dyCrit;
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
        const end = start + 360 + Bottle.angDelta(start, 180);

        tween(this.node).to(dur * 2, { angle: end }, { easing: 'sineInOut' }).start();
        tween(this.node).to(dur, { position: new Vec3(this.homeX, this.homeY, 0) }, { easing: 'quadIn' })
            .call(() => {
                this.node.angle = 180;
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

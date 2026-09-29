import { _decorator, BlockInputEvents, Color, Component, Label, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { label, nd, rect, setFrame, sizeOf, stretch } from '../UI/Base/UIKit';

const { ccclass } = _decorator;

/* ------------------------------------------------------------------ *
 * 新手引导（第七十五轮）—— 黑幕挖洞 + 手指，只引导「真正的第一次」。
 *
 * 流程（用户口径）：
 *   ① 游戏开始的第一个瓶子默认在屏幕中间（BottleField.sync 里落点特判）；
 *   ② 黑幕挖洞罩住瓶子 + 手指悬停弹跳 → 引导玩家**点击 2 次**瓶子；
 *   ③ 再挖洞罩住商城列表第一格（买 T1 塑料瓶）→ 引导点击购买；
 *   ④ 引导结束时开局送的钱正好够买这只瓶子（maybeBegin 里把初始金币
 *      抬到 `G.bottleCost(0)`，新档 money=0 → $7）。
 *
 * 实现要点：
 *   · 引导层 = GameRoot 节点下最末位的独立节点（在 gameRoot/uiRoot 之上），
 *     Widget 铺满可见区；黑幕用 **4 块 rect 围出矩形洞**（比 cc.Mask 少一层
 *     模板缓冲依赖，四块各挂 BlockInputEvents，洞外一律吃掉触摸）。
 *   · 洞的位置**每帧**跟随目标（瓶子会翻飞换位 / 商城格子会重建），世界坐标
 *     经 UITransform 双重换算到本层 —— 不写死任何屏幕数值。
 *   · 瓶子点击走 BottleField 的**全局输入**（不受 BlockInputEvents 约束），
 *     所以第③步用 `Tutorial.locked` 让 BottleField.pointerDown 直接 return；
 *     第②步不锁（洞里就是瓶子，点哪儿都该有效）。
 *   · 依赖全部由 GameRoot 注入（deps 四个闭包），本文件不 import
 *     BottleField/BottomPanel —— 避免形成 ESM 循环依赖（见 Guidance.ts 注释）。
 * ------------------------------------------------------------------ */

/** 黑幕不透明度（对齐 modalMask 的 200 口径，略薄一档让桌子隐约可见） */
const CURTAIN_A = 188;
/** 手指贴图显示尺寸（本层设计单位；shou.png 69×86 ≈ 0.8 比例） */
const HAND_W = 108, HAND_H = 135;
/** 手指弹跳下压幅度 */
const HAND_DIP = 30;

/** 引导依赖（GameRoot 注入，全部惰性取值） */
export interface TutorialDeps {
    /** 瓶子场节点（BottleField 宿主，坐标换算基准） */
    field: () => Node | null;
    /** 桌上第一只瓶子的节点（点击引导目标） */
    bottle: () => Node | null;
    /** 商城列表第一格（整格即按钮，322×78） */
    buyCell: () => Node | null;
    /** 把底栏切回「商店」页签 */
    showShop: () => void;
}

type Step = 'tap' | 'buy';

@ccclass('Tutorial')
export class Tutorial extends Component {
    static I: Tutorial = null!;

    /** 引导是否进行中（第②③步都算） */
    static get active(): boolean { return !!Tutorial.I && Tutorial.I.step !== null; }
    /** 购买阶段锁死桌面点击（BottleField.pointerDown 检查后直接 return） */
    static get locked(): boolean { return !!Tutorial.I && Tutorial.I.step === 'buy'; }

    /** BottleField.tapWorld 命中瓶子时回调：计数玩家的点击 */
    static notifyTap() {
        const i = Tutorial.I;
        if (i && i.step === 'tap') { i.taps++; }
    }

    /** 无头验收断言入口（__tb.tut.debug()） */
    static debug() {
        const i = Tutorial.I;
        return {
            active: Tutorial.active,
            step: i ? i.step : null,
            taps: i ? i.taps : 0,
            done: G.data.tut > 0,
            money: Math.floor(G.data.money),
            bottles0: G.data.bottles[0],
        };
    }

    private deps: TutorialDeps = null!;
    private step: Step | null = null;
    private taps = 0;
    private readonly needTaps = 2;

    /* ---- 视觉件（begin 里建） ---- */
    private mT: Node = null!;
    private mB: Node = null!;
    private mL: Node = null!;
    private mR: Node = null!;
    /** 手指容器（每帧摆到洞中心）；子节点 img 做弹跳 */
    private hand: Node = null!;
    private handImg: Node = null!;
    private tipLb: Label = null!;
    private tipText = '';

    /**
     * 入口：满足「真·新档」才播（从没翻过瓶 + 桌上只有开局自带那只）。
     * 老档静默补标 tut=1，从此不再检查。
     */
    static maybeBegin(parent: Node, deps: TutorialDeps) {
        if (G.data.tut) { return; }
        let total = 0;
        for (const n of G.data.bottles) { total += n; }
        const fresh = G.data.stats.flips === 0 && total === 1 && G.data.bottles[0] === 1;
        if (!fresh) {
            G.data.tut = 1;
            G.save();
            return;
        }
        // ★ 用户口径：引导结束时玩家手里的钱正好买得起第一只瓶子 ——
        //   干脆开局就给（T1 第二只 $7，商店行直接是绿色「可买」）。
        const cost = G.bottleCost(0);
        if (G.data.money < cost) {
            G.data.money = cost;
            G.save();
            G.notify();
        }
        // 引导层挂 GameRoot 最末位：盖过 gameRoot（世界+底栏）与 uiRoot（页面/弹窗）
        const n = nd(parent, 'tutorial', 10, 10, 0, 0);
        const t = n.addComponent(Tutorial);
        t.deps = deps;
        Tutorial.I = t;
    }

    start() {
        if (!this.deps) { return; }
        stretch(this.node);   // 铺满可见区（GameRoot 节点尺寸 = 可见区设计尺寸）
        const parent = this.node.parent;
        if (parent) { this.node.setSiblingIndex(parent.children.length - 1); }

        // 四块黑幕围出矩形洞（位置每帧在 update 里重排）
        const mk = (name: string) => {
            const n = rect(this.node, 10, 10, 0, 0, new Color(0, 0, 0, CURTAIN_A), name);
            n.addComponent(BlockInputEvents);
            return n;
        };
        this.mT = mk('mT');
        this.mB = mk('mB');
        this.mL = mk('mL');
        this.mR = mk('mR');

        // 手指：容器跟洞走，子节点做「下压-抬起」循环
        this.hand = nd(this.node, 'hand', 10, 10, 0, 0);
        this.handImg = nd(this.hand, 'img', HAND_W, HAND_H, 0, 0);
        setFrame(this.handImg.addComponent(Sprite), 'env/shou', HAND_W, HAND_H);
        tween(this.handImg).repeatForever(
            tween(this.handImg)
                .to(0.42, { position: new Vec3(0, -HAND_DIP, 0) }, { easing: 'sineIn' })
                .to(0.30, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
                .delay(0.22),
        ).start();

        // 提示字（白字深描边，压在黑幕上）
        const lb = label(this.node, '', 0, 0, 640, 70, {
            size: 44, color: '#FFFFFF', outline: '#1B1006', outlineWidth: 3,
        });
        this.tipLb = lb;

        // 买中 T1 瓶（bottles[0] 1 → 2）= 引导终点
        G.addListener(() => {
            if (this.step === 'buy' && G.data.bottles[0] >= 2) { this.finish(); }
        });

        this.step = 'tap';
        this.setTip(t('tut_tap', G.lang));
        // 黑幕淡入，别一进游戏就「啪」一层黑
        const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.28, { opacity: 255 }).start();
    }

    protected onDestroy() {
        if (Tutorial.I === this) { Tutorial.I = null as any; }
    }

    /* ---------------- 每帧：洞跟随目标 + 步进检测 ---------------- */
    protected update() {
        if (!this.step) { return; }
        // 点满 2 次 → 等最后一次翻瓶落地（含失败平躺/Q 弹）再切「购买」引导
        if (this.step === 'tap' && this.taps >= this.needTaps && !this.advancing) {
            this.advancing = true;
            this.scheduleOnce(() => this.toBuy(), 0.9);
        }
        const myUt = sizeOf(this.node);
        if (!myUt) { return; }
        const W = myUt.width, H = myUt.height;

        let hole: { x: number; y: number; hw: number; hh: number } | null = null;
        if (this.step === 'tap') {
            const b = this.deps.bottle();
            if (b && b.isValid) {
                // 瓶身贴图矩形：锚点在瓶底上方 0.34H → 视觉中心 ≈ 节点 +16（作者单位）
                // 洞放宽到 ±74/±84：瓶子翻飞落成「平放」姿态时横向伸出也不被裁
                hole = this.fieldRect(b.position.x, b.position.y + 16, 74, 84);
            }
        } else {
            const cell = this.deps.buyCell();
            if (cell && cell.isValid) { hole = this.nodeRect(cell, 12); }
        }

        const show = !!hole;
        for (const m of [this.mT, this.mB, this.mL, this.mR]) { m.active = show; }
        this.hand.active = show;
        this.tipLb.node.active = show;
        if (!hole) { return; }

        // 洞不出屏
        hole.x = Math.max(-W / 2 + hole.hw, Math.min(W / 2 - hole.hw, hole.x));
        hole.y = Math.max(-H / 2 + hole.hh, Math.min(H / 2 - hole.hh, hole.y));

        this.place(this.mT, 0, (hole.y + hole.hh + H / 2) / 2, W, Math.max(0, H / 2 - (hole.y + hole.hh)));
        this.place(this.mB, 0, (hole.y - hole.hh - H / 2) / 2, W, Math.max(0, (hole.y - hole.hh) + H / 2));
        this.place(this.mL, (hole.x - hole.hw - W / 2) / 2, hole.y, Math.max(0, (hole.x - hole.hw) + W / 2), hole.hh * 2);
        this.place(this.mR, (hole.x + hole.hw + W / 2) / 2, hole.y, Math.max(0, W / 2 - (hole.x + hole.hw)), hole.hh * 2);

        // 手指悬在洞中心；提示字在洞上沿之外（贴顶则改到下方）。
        // ★ 买瓶步的字要再抬高：洞的正上方是底栏页签（商店/升级/技能树），
        //   +64 会把字压在页签上，像在给页签做标注 —— 抬过页签落到履带区的黑幕上。
        const tipGap = this.step === 'buy' ? 136 : 64;
        const above = hole.y + hole.hh + tipGap + 40 < H / 2;
        this.hand.setPosition(hole.x, hole.y, 0);
        this.tipLb.node.setPosition(hole.x, above ? hole.y + hole.hh + tipGap : hole.y - hole.hh - 64, 0);
    }

    private place(n: Node, x: number, y: number, w: number, h: number) {
        n.setPosition(x, y, 0);
        const ut = sizeOf(n);
        if (ut && (ut.width !== w || ut.height !== h)) { ut.setContentSize(w, h); }
    }

    /** 瓶子场局部（作者单位）矩形 → 本层局部矩形 */
    private fieldRect(cx: number, cy: number, hw: number, hh: number) {
        const f = this.deps.field();
        const c = this.toLocal(f, new Vec3(cx, cy, 0));
        const fs = this.fieldScale();
        return { x: c.x, y: c.y, hw: hw * fs, hh: hh * fs };
    }

    /** 任意 UI 节点的世界矩形 → 本层局部矩形（pad 外扩） */
    private nodeRect(n: Node, pad: number) {
        const ut = n.getComponent(UITransform);
        if (!ut) { return null; }
        const w = ut.width / 2 + pad, h = ut.height / 2 + pad;
        const c1 = this.toLocal(ut, new Vec3(-w, -h, 0));
        const c2 = this.toLocal(ut, new Vec3(w, h, 0));
        return {
            x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2,
            hw: Math.abs(c2.x - c1.x) / 2, hh: Math.abs(c2.y - c1.y) / 2,
        };
    }

    /** src（节点或其 UITransform）局部 → 本层局部（src 为空 = 已是世界坐标） */
    private toLocal(src: Node | UITransform | null, p: Vec3): Vec3 {
        let ut: UITransform | null = null;
        if (src instanceof UITransform) { ut = src; }
        else if (src && src.isValid) { ut = src.getComponent(UITransform); }
        const world = ut ? ut.convertToWorldSpaceAR(p) : p;
        return sizeOf(this.node).convertToNodeSpaceAR(world);
    }

    /** 瓶子场 1 单位 = 本层多少单位（横向量测） */
    private fieldScale(): number {
        const f = this.deps.field();
        if (!f || !f.isValid) { return 1; }
        const a = this.toLocal(f, new Vec3(0, 0, 0));
        const b = this.toLocal(f, new Vec3(100, 0, 0));
        const d = Math.abs(b.x - a.x) / 100;
        return d > 0.001 ? d : 1;
    }

    /* ---------------- 步进 ---------------- */
    private advancing = false;
    private toBuy() {
        if (this.step !== 'tap') { return; }
        this.step = 'buy';
        Res.I?.play('click', 0.6);
        this.deps.showShop();
        this.setTip(t('tut_buy', G.lang));
    }

    private setTip(s: string) {
        if (this.tipText === s) { return; }
        this.tipText = s;
        this.tipLb.string = s;
    }

    private finish() {
        if (!this.step) { return; }
        this.step = null;
        G.data.tut = 1;
        G.save();
        Tween.stopAllByTarget(this.handImg);
        Res.I?.play('buy', 0.8);
        const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        tween(op).to(0.3, { opacity: 0 }).call(() => {
            if (this.node && this.node.isValid) { this.node.destroy(); }
        }).start();
    }
}

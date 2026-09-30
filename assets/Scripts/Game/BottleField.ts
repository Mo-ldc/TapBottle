import { _decorator, Component, Node, Sprite, Vec2, Vec3, UIOpacity, UITransform, input, Input, EventTouch, EventMouse, tween, view } from 'cc';
import { LAYOUT, PLAY_AREA, TIERS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { chance, fmt } from '../Core/Util';
import { FlipResult } from '../Core/State';
import { Res } from '../Core/Res';
import { BOTTLE_ART, BOTTLE_SCALE, Bottle } from './Bottle';
import { CapMachine } from './CapMachine';
import { FxLayer } from './Fx';
import { label, nd, setFrame, setSize } from '../UI/Base/UIKit';
import { Modal } from '../UI/Base/Modal';
import { Tutorial } from './Tutorial';
import { UIHitBlocks } from '../Core/UIHit';
import { SpatialGrid } from '../Core/SpatialGrid';

const { ccclass } = _decorator;

/** 玩家点击音效（用户口径：pop3 才是瓶子被触发的声音） */
const TAP_SFX = ['pop3'];
const DW = 720, DH = 1280;

/* ---------------- 空间索引参数（第九十六轮） ----------------
 * 悬停/点击都不再用「遍历所有瓶子」，改成先问 SpatialGrid 要候选。
 */
/** 悬停判定点相对 node 位置的 y 偏移（原逻辑 LAYOUT.bottleH * 0.30，语义=瓶身视觉中心） */
const HOVER_DY = LAYOUT.bottleH * 0.30;
/**
 * 点击命中的外接方半径（本地单位）。
 * 瓶子命中框 = 贴图矩形 150×375 × BOTTLE_SCALE，相对 node 位置 y∈[-32.64, +63.36]；
 * 平放（±93°）时宽高互换 → 取 max(38.4, 96)/2 = 48，再留一点余量 → 64。
 * 覆盖 0°/180°/±93° 三态且对锚点偏移保守，保证候选不会漏。
 */
const HIT_R = 64;

/* ---------------- 光圈（★ 第四十八轮起**开局常显**，不再需要解锁） ----------------
 * 拆成两个**独立**节点，因为它们的层级需求正好相反：
 *   cursorRing = 范围圈，是地面落点指示 → setSiblingIndex(0)，压在影子/瓶子之下
 *   cursorPin  = 指针（gqiun 光圈贴图），必须在**所有东西之上** → 追加到子节点末尾
 * 原来两者共用一个容器、容器整体 setSiblingIndex(0)，手指跟着一起沉到瓶层下面，
 * 被桌子和瓶子挡得看不见（用户反馈「图片不在上层，被挡住了」）。
 */
const CURSOR_PIN_H = 60;                                     // 指针高度（设计像素）
const CURSOR_PIN_W = CURSOR_PIN_H;                           // 贴图 gqiun 光圈 209×209，1:1 正方形
/** env/cursor.png（gqiun 光圈）圆形对称 → 热点就是贴图中心，无偏移 */
const TIP_RX = 0, TIP_RY = 0;
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
    /** 指针（gqiun 光圈贴图；顶层，盖过瓶子） */
    private cursorPin: Node = null!;
    private pointer = new Vec2(0, 0);

    /* ---- 空间索引（第九十六轮）：悬停/点击的邻域剪枝，见 Core/SpatialGrid ---- */
    private grid = new SpatialGrid<Bottle>();
    /** 查询结果缓冲（复用，避免每次查询 new 数组 → GC） */
    private gridOut: Bottle[] = [];
    /** 点击命中的独立缓冲（与悬停查询分开，避免将来有人把两者嵌套调用时互相踩） */
    private tapOut: Bottle[] = [];
    /**
     * 索引脏标记。**只在瓶子增删 / 翻转落位时置位**，由 update 每帧最多重建一次。
     * ⚠️ 不能每帧重建：重建要遍历全部瓶子，跟原来的全量遍历同价，那就白做了。
     */
    private gridDirty = true;
    /**
     * 首次可用时把指针摆到桌面活动区中心。
     * 否则它停在节点原点（= 桌面下沿/边缘），会给人「光标出现了但不在该在的地方」的错觉；
     * 之后任何一次按下/拖动都会立刻把它带到手指下。
     */
    private pointerSeeded = false;
    private hitLock: Record<string, number> = {};
    /** 面包屑去重：上次上报过的瓶子总数 */
    private lastBreadTotal = -1;

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
        n.angle = 0;                                  // 与桌面静置姿态一致（贴图已转正，0° = 瓶口朝上）
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
                b.node.angle = 0;
                this.sortDepth();
                // ★ 用户口径（第十七轮）：飞入落地直接判定正反并结算，不再原地起跳重翻一次
                b.settle(G.rollOutcome(b.tier));
            }, 0))
            .start();
        // 自旋：0 → 360（整一圈，落回 0，接得上静置姿态）
        tween(n).to(dur, { angle: 360 }, { easing: 'quadInOut' }).start();
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
        // ⚠️ 点击**不再**走「瓶子的节点事件」，而是统一在这里自己做命中判定（见 tapWorld）：
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

        // ★ 第九十四轮：+N 角标夹到 300 —— y1 上探到 375 后 `y1 - 14 = 361` 会压顶栏
        //   （顶栏底边本地 ≈358）。它只在「同屏超出上限」时显示（现在上限已取消，基本不出现）。
        const lb = label(this.node, '', 0, Math.min(PLAY_AREA.y1 - 14, 300), 320, 44, {
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
        // 光圈**开局常显**（★ 第四十八轮：「解锁光圈」模块已移除，不再有 hasCursor 门控）。
        // 圈只是**触发范围指示**，圈内的瓶子会不会自动翻，取决于那阶有没有买「悬停翻转」：
        //   · 一阶都没买 → G.haloTriggerOn=false → 触发半径只是一个小点（第 78 轮起贴图
        //     3 倍大纯视觉引导，但范围不变大），视觉上「跟手但不触发」；
        //   · 买了任一阶 → 半径恢复 G.haloRadius（p_cursorsize，base 55），该阶瓶子拖过即翻。
        // 所以触发循环本身不需要任何额外门控 —— `G.hoverable(tier)` 天然只放行已解锁的阶。
        const cursorOn = !Modal.open;
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
            // ② 指针：顶层 —— 追加到子节点末尾，永远盖在瓶子之上（用户要求「要在上层」）；
            //    贴图已由「手指」换成 gqiun 光圈（2026-09-28），圆形对称热点居中，直接叠在 pointer 上。
            //
            // ⚠️ 投影必须是 pin 的**子节点**且排在光圈前面：Cocos 的 UI 渲染是深度优先，
            //    同一个节点自己的 Sprite 先画、子节点后画 —— 把投影做成 pin 自身 Sprite 的
            //    兄弟会盖在光圈上面。所以这里是「无渲染的容器 + 两个子节点」。
            this.cursorPin = nd(this.node, 'cursorPin', CURSOR_PIN_W, CURSOR_PIN_H, 0, -999);
            // 投影：同一张贴图染黑、往右下偏几像素。瓶子是粗黑描边，光圈直接叠上去会糊成一团，
            // 有这层黑影手指才读得出「浮在桌面上」而不是「被瓶子挡住」。
            const shadow = nd(this.cursorPin, 'shadow', CURSOR_PIN_W, CURSOR_PIN_H, 3, -4);
            setFrame(shadow.addComponent(Sprite), 'env/cursor', CURSOR_PIN_W, CURSOR_PIN_H, '#101010');
            shadow.addComponent(UIOpacity).opacity = 95;

            const hand = nd(this.cursorPin, 'hand', CURSOR_PIN_W, CURSOR_PIN_H, 0, 0);
            setFrame(hand.addComponent(Sprite), 'env/cursor', CURSOR_PIN_W, CURSOR_PIN_H);
            hand.addComponent(UIOpacity).opacity = 235;
            this.cursorPin.setSiblingIndex(this.node.children.length - 1);
        }
        // 吸附半径 = 0.55m × (1 + 0.05L)（§5.1 分支 2），单位 px；
        // 未解锁触发时只有一个小点（贴图仍 3 倍纯视觉），广告「2 倍光圈」期间整体 ×2（State.haloRadius / haloScale）
        const r = G.haloRadius;
        if (cursorOn) {
            setSize(this.cursorRing, r * 2, r * 2);
            this.cursorRing.setPosition(this.pointer.x, this.pointer.y, 0);
            this.cursorRing.active = true;
            // 光圈贴图本身也跟着缩放（小点 ↔ 正常 ↔ 广告 2 倍）：
            // ⚠️ 必须 setScale 整体赋值，子节点（shadow/hand）自动继承父缩放。
            const hs = G.haloScale;
            if (Math.abs(this.cursorPin.scale.x - hs) > 1e-3) { this.cursorPin.setScale(hs, hs, 1); }
            this.cursorPin.setPosition(this.pointer.x + PIN_DX, this.pointer.y + PIN_DY, 0);
            this.cursorPin.active = true;
        }

        // ★ 第九十六轮：悬停触发从「遍历所有瓶子」改成「问空间索引要候选」。
        //   原来每帧无条件遍历全部瓶子（跟手指动不动无关），300 只就是 300 次迭代；
        //   现在只重建一次邻域（脏时才重建），每帧扫查询圆外接方覆盖的几格。
        //   ⚠️ 精确判定（距离 < r）与门控顺序保持原样，候选外扩用 r + HOVER_DY
        //   （因为"判定点"相对 node.position 上移了 HOVER_DY，外扩这么多才不会漏）。
        // ★ 第121轮：悬停翻转默认解锁后，新手引导期间必须**整段停用**悬停触发 ——
        //   否则玩家手指/光标一停进引导洞（洞正罩着瓶子），瓶子就每 150ms 自我翻飞；
        //   瓶子在空中时 b.idle=false，点击命中落空 → Tutorial.notifyTap 不计数 →
        //   「点击 2 次」永远凑不满，引导卡死在第一步。引导教的就是点击，引导结束
        //   （Tutorial.active=false）后悬停自动恢复。
        if (!Tutorial.active) {
        if (this.gridDirty) { this.rebuildGrid(); }
        const cand = this.gridOut;
        const cn = this.grid.queryCircle(this.pointer.x, this.pointer.y, r + HOVER_DY, cand);
        for (let ci = 0; ci < cn; ci++) {
            const b = cand[ci];
            if (!b.idle) { continue; }
            // 买瓶飞入期间真瓶子是藏起来的（node.active=false），别让它被光标扫到
            if (!b.node.activeInHierarchy) { continue; }
            // ★ 圈内只触发「该阶已解锁悬停翻转」的瓶子；没解锁的该阶瓶子只能点击（原版操作流）
            if (!G.hoverable(b.tier)) { continue; }
            const dx = b.node.position.x - this.pointer.x;
            const dy = b.node.position.y + HOVER_DY - this.pointer.y;
            if (dx * dx + dy * dy < r * r) {
                const key = b.node.uuid;
                const now = performance.now();
                if (!this.hitLock[key] || now - this.hitLock[key] > 150) {   // GDD §10 防狂点节流 0.15s
                    this.hitLock[key] = now;
                    this.flip(b);
                }
            }
        }
        }   // end !Tutorial.active（悬停触发整段门控）
        void dt;
    }

    /**
     * 重建空间索引（第九十六轮）。
     *
     * 把所有瓶子按 **node.position** 落格（悬停/点击的判定点都在这个基准上加固定偏移，
     * 偏移量在查询侧并进外扩范围，见 update 与 hitBottles）。
     * 连 busy / 隐藏的瓶子一起插入 —— 查询时再按状态过滤，省掉重建期的状态判断。
     */
    private rebuildGrid() {
        this.gridDirty = false;
        const arr = this.bottles;
        this.grid.reset(PLAY_AREA.x0 - HIT_R, PLAY_AREA.y0 - HIT_R,
            PLAY_AREA.x1 + HIT_R, PLAY_AREA.y1 + HIT_R);
        for (let i = 0; i < arr.length; i++) {
            const b = arr[i];
            if (!b.node || !b.node.isValid) { continue; }
            this.grid.insert(b, b.node.position.x, b.node.position.y);
        }
    }

    /** 标记索引需要重建（瓶子增删 / 位置变化时调用） */
    markGridDirty() { this.gridDirty = true; }

    /* ---------------- 布局 ---------------- */

    /**
     * 把 UI 坐标（touch / mouse 的 getUILocation）换算成**世界坐标**。
     *
     * ★ getUILocation() 返回的是 UI 坐标系（原点=**视口**左下角），而
     *   convertToNodeSpaceAR / hitTest 要的是世界坐标 —— 两者恒差一个
     *   view.getVisibleOrigin()。旧代码假设它恒为 (0,0)，屏幕比例一偏离
     *   9:16 就整片错位（超宽屏 +34px、超长屏 ±160px）→ 「点 A 翻 B」。
     *   统一走这一个换算入口（用户口径：判定一律用世界坐标）。
     */
    private uiToWorld(uiX: number, uiY: number): Vec3 {
        const vo = view.getVisibleOrigin();
        return new Vec3(uiX + vo.x, uiY + vo.y, 0);
    }

    /**
     * 光标定位（field 本地坐标，供光标圈/悬停触发用）。
     *
     * ⚠️ 这里**不**做任何解锁门控：pointer 同时承担「点击命中判定」，
     *    之前挂过「有没有解锁光标」的门槛，导致门槛未过时 pointer 永远不更新、
     *    点击瓶子直接失效（实测 flips 恒为 0）。光圈是否显示、是大是小，全部由 update() 决定。
     */
    private aim(uiX: number, uiY: number) {
        if (Modal.open) { return; }
        const ut = this.node.getComponent(UITransform);
        if (!ut) { return; }
        const v = ut.convertToNodeSpaceAR(this.uiToWorld(uiX, uiY));
        this.pointer.set(v.x, v.y);
    }

    /** 按下：先定位光标，再做点击命中判定（直接用世界坐标） */
    private pointerDown(uiX: number, uiY: number) {
        this.aim(uiX, uiY);
        if (Modal.open) { return; }
        // ★ 新手引导第③步（买瓶）：黑幕挖洞罩着商城格子，桌面点击一律不响应 ——
        //   否则手指隔着黑幕按到瓶子会把瓶子翻飞，挖洞引导就形同虚设。
        if (Tutorial.locked) { return; }
        const w = this.uiToWorld(uiX, uiY);
        // ★ 第七十七轮：活动区下探到履带上沿后，能力按钮（狂暴/可乐/处决）正后方
        //   可能站着瓶子 —— 点按钮不应连带把身后的瓶子翻飞，先问登记过的 UI 矩形。
        for (const hit of UIHitBlocks) { if (hit(w)) { return; } }
        this.lastWorld.set(w.x, w.y);
        this.tapWorld(w.x, w.y);
    }

    /**
     * 点击命中：一次按下命中的**所有**瓶子各自触发一次翻转判定（入参=世界坐标）。
     *
     * 为什么自己算命中、不用节点自带事件：
     *  · 命中框与可见瓶身严格一致（点瓶口/瓶底也算中，点旁边空白不算中）；
     *  · **瓶子之间互不阻挡** —— 两只瓶子视觉上重叠时，重叠处按下两只都会翻，
     *    而不是只有渲染在上面的那只吃掉事件；
     *  · 点在空白处**不会**再「随机翻一只」（原来点 A 打空就翻 B，手感完全错）。
     * Bottle.hitTest 内部就是 convertToNodeSpaceAR（世界→本地）+ 瓶身矩形，
     * 世界坐标直接喂给它，中间不再经过任何手写坐标换算。
     */
    private tapWorld(wx: number, wy: number) {
        const out = this.tapOut;
        const n = this.hitBottles(wx, wy, out);
        let hit = false;
        for (let i = 0; i < n; i++) {
            this.flip(out[i]);
            hit = true;
        }
        // ★ 新手引导：只统计「玩家亲手点到瓶子」的次数（悬停触发/助手/冲击波都不算）
        if (hit) { Tutorial.notifyTap(); }
    }

    /**
     * 命中查询（只判命中、不翻转）—— tapWorld 与无头验收共用同一份逻辑，
     * 保证「验收测到的命中集合」就是「玩家点击真的会翻的集合」。
     *
     * ★ 第九十六轮：候选从空间索引取（AABB 外接方半径 HIT_R 覆盖正立/倒立/平放三态
     *   以及锚点偏移），不再遍历所有瓶子。界内中心点闭包在 grid 的边界里，
     *   所以「点在某只瓶子身上」它一定在候选里，不会漏。
     */
    hitBottles(wx: number, wy: number, out: Bottle[]): number {
        if (this.gridDirty) { this.rebuildGrid(); }
        const ut = this.node.getComponent(UITransform);
        if (!ut) { return 0; }
        // ⚠️ 坐标空间：网格是按**本地坐标**（b.node.position）建的，而入参是世界坐标
        //   （tapWorld 的口径 = uiToWorld 的结果）→ 必须先换算。
        //   漏掉这一次换算的后果是「所有瓶子都查不到」（命中恒为 0），
        //   且不会报错 —— 已由 _q96 的等价性校验实测抓到过一次。
        const v = this._hitTmp;
        v.set(wx, wy, 0);
        ut.convertToNodeSpaceAR(v, v);
        const cn = this.grid.queryRect(v.x - HIT_R, v.y - HIT_R, v.x + HIT_R, v.y + HIT_R, out);
        let m = 0;
        for (let i = 0; i < cn; i++) {
            const b = out[i];
            if (!b.node || !b.node.isValid) { continue; }
            if (!b.idle) { continue; }
            if (!b.node.activeInHierarchy) { continue; }   // 飞入途中（真瓶子藏起来）不参与命中
            if (!b.hitTest(wx, wy)) { continue; }
            out[m++] = b;                                   // m ≤ i，原地压紧安全
        }
        out.length = m;
        return m;
    }
    /** hitBottles 的临时向量（避免每次查询 new Vec3） */
    private _hitTmp = new Vec3();
    /** 最近一次按下判定的世界坐标（调试/无头验收用） */
    lastWorld = new Vec2(0, 0);

    sync() {
        if (!this.node || !this.node.isValid) { return; }
        const want = G.data.bottles.slice();
        const total = want.reduce((a, b) => a + b, 0);
        // ErrorGuard 面包屑：瓶子总数变化才上报（排查「瓶子多时返回卡死」的现场）
        if (total !== this.lastBreadTotal) {
            this.lastBreadTotal = total;
            try { (globalThis as any).__tb_breadPush?.('bottles=' + total); } catch (e) { /* ignore */ }
        }

        // ★ 用户口径（第五十一轮）：**同屏显示上限彻底取消** —— 桌面上只认玩家「能买到的上限」
        //   （`State.tierCap`：默认 30，可由「上限提升」词条 +5/级、`p_sizelimit` 科技 +5/级 抬高）。
        //   买到多少就摆多少。原来的逐阶显示配额 [24,12,8,6,4,3,3] 会在买到第 5 只红瓶时
        //   静默截断 —— 购买成功、箱子计数 ++、但桌上既不出现新瓶子也没有飞入动画
        //   （用户实测「高级瓶子买到一定数量后再买没反应」的根因）。
        //   现在「买不了」只会发生在真正的购买上限：`buyBottle` 拒绝 + 弹出「已到上限」提示，
        //   商店行同时显示「已满」。
        const wantVis = want;
        let visTotal = 0;
        for (let t = 0; t < 7; t++) { visTotal += wantVis[t]; }
        const have = [0, 0, 0, 0, 0, 0, 0];
        for (const b of this.bottles) { have[b.tier]++; }

        // ① 删多余的（一般不会发生：各阶数量只增不减）
        for (let i = this.bottles.length - 1; i >= 0; i--) {
            const b = this.bottles[i];
            if (have[b.tier] > wantVis[b.tier]) {
                have[b.tier]--;
                this.bottles.splice(i, 1);
                // 走对象池回收（瓶身 + 影子一起归还），不再 destroy —— 稳态零分配
                b.despawn();
            }
        }

        // ② 缺的按阶补建（从高阶到低阶，与 seq 口径一致）
        for (let t = 6; t >= 0; t--) {
            while (have[t] < wantVis[t]) {
                // ★ 用户口径（第五十一轮）：买瓶落点**与其它瓶子一样随机**（原来固定飞向场地正中）。
                //   `pickSpot` 的 best-of-N 会挑「离现有瓶子最远」的候选点 → 既随机又不会完全重叠。
                const fly = !!this.flyReq && this.flyReq.tier === t;
                // ★ 新手引导（第七十五轮）：「游戏开始的第一个瓶子」固定落在活动区正中 ——
                //   本局还没建出任何瓶子且存档里总共就这一只时生效（重开/读档后同样成立）。
                const firstCenter = this.bottles.length === 0 && total === 1;
                const spot = firstCenter
                    ? { x: (PLAY_AREA.x0 + PLAY_AREA.x1) / 2, y: (PLAY_AREA.y0 + PLAY_AREA.y1) / 2 }
                    : this.pickSpot();
                const b = Bottle.create(this.bottleHolder, this.shadowHolder, t, spot.x, spot.y);
                // 不再挂 b.enableTouch：点击命中统一由 tapWorld() 自己判定（见那里的注释）
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
            // ★ 第四十三轮：先比对再写（Label 改字 = 重排 + 重绘 + 纹理上传）
            const olb = this.overflowLb.getComponent('cc.Label') as any;
            const otxt = '+' + extra;
            if (olb && olb.string !== otxt) { olb.string = otxt; }
        } else {
            this.overflowLb.active = false;
        }

        // ★ 第九十六轮：瓶子增删过 → 空间索引必须重建（否则新瓶子点不到、卖掉的还留着）
        this.gridDirty = true;
    }

    rebuild() { this.sync(); }

    /**
     * 活动区被适配层改动后调用（第一百一十二轮）：
     * 窗口比例变化 → GameRoot.applySafeLayout 重算 UI 可用带并收缩 PLAY_AREA，
     * 这里把存量瓶子夹回新范围（夹不动的翻转途中瓶子落地后自然落在新界内）、
     * 顺带把 +N 角标挪到新上界之下，最后重建空间索引。
     */
    onPlayAreaChanged() {
        let moved = false;
        for (const b of this.bottles) {
            if (!b.node || !b.node.isValid) { continue; }
            if (b.clampToArea(PLAY_AREA.x0, PLAY_AREA.x1, PLAY_AREA.y0, PLAY_AREA.y1)) { moved = true; }
        }
        if (this.overflowLb && this.overflowLb.isValid) {
            this.overflowLb.setPosition(0, Math.min(PLAY_AREA.y1 - 14, 300), 0);
        }
        if (moved) { this.sortDepth(); }
        this.gridDirty = true;
    }

    /**
     * 在桌面活动区里随机取一个落点。
     * best-of-6 候选里挑「离其他瓶子最远」的那个 —— 允许堆叠，但不会完全重合。
     */
    pickSpot(avoid?: Bottle): { x: number, y: number } {
        let bx = PLAY_AREA.x0, by = PLAY_AREA.y0, best = -1;
        const w = PLAY_AREA.x1 - PLAY_AREA.x0;
        const h = PLAY_AREA.y1 - PLAY_AREA.y0;
        // ★ 第五十一轮：取消同屏显示上限后桌面可以很挤（每阶上限 30）→ 候选点数随瓶子数自适应，
        //   瓶子越多越要多采几个点才找得到「相对最空」的位置（上限 20 次，避免建瓶时明显卡顿）。
        const tries = Math.min(20, 6 + (this.bottles.length >> 2));
        for (let k = 0; k < tries; k++) {
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
    sortDepth() { this.depthDirty = true; this.gridDirty = true; }

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
        // ★ 第九十六轮：落位 = 位置变了 → 空间索引要重建。
        //   放在最前面：fail 分支会提前 return（下面 sortDepth 走不到），漏标会让索引留着旧位置。
        this.gridDirty = true;
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
        // ★ 第九十八轮（用户口径「翻瓶子的时候会在屏幕有一瞬间泛光，黄色的……先移除这个泛光」）：
        //   移除倒立（crit）落地时的全屏黄闪 `FxLayer.flash('#FFC85A', 42, 0.22)`。
        //   完美落地出现频率很高，每出一只就整屏闪一下，翻得快时非常刺眼。
        //   倒立的反馈保留两处，足够表达「这一下是完美落地」：
        //     ① 瓶身正中间的星星（Bottle.land 里画）
        //     ② 上面那行金币数字放大（crit ? 42 : 30）
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

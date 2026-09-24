import { _decorator, Canvas, Component, Node, UITransform, Sprite, Vec3, tween, UIOpacity, input, Input, view, ResolutionPolicy, director, profiler, sys, Widget } from 'cc';
import { BOTTLE_STATS, AUTHOR_H, AUTHOR_W, DESIGN_H, DESIGN_W, DS, LAYOUT, MILESTONES, SAFE_BLOCKS, WORLD_ENV, WORLD_XFORM } from './Core/GameConfig';
import { AutoNodeScale } from './Core/AutoNodeScale';
import { G } from './Core/State';
import { Res } from './Core/Res';
import { t } from './Core/Locale';
import { button, img, label, MASK_SIZE, nd, rect, setFrame, setSize } from './UI/Base/UIKit';
import { Toast } from './UI/Base/Toast';
import { Hud } from './UI/Hud/Hud';
import { BottomPanel } from './UI/Hud/BottomPanel';
import { debugGoal, registerNav } from './UI/Hud/Guidance';
import { Modal } from './UI/Base/Modal';
import { Ads } from './UI/Base/Ads';
import { AdButtons } from './UI/Widgets/AdButtons';
import { UIMgr, UIName } from './Core/UIMgr';
import { BottleField } from './Game/BottleField';
import { HelperHands } from './Game/HelperHands';
import { CapMachine } from './Game/CapMachine';
import { Abilities } from './Game/Abilities';
import { FxLayer } from './Game/Fx';

const { ccclass, property } = _decorator;

/** 游戏主控：装配整个竖屏场景（创作空间 720×1280，设计区 1440×2560）。
 *  层级节点在 Main.scene 里实体化、@property 绑定；未绑定时运行时兜底创建。
 *
 *  ★ 分层（用户口径）：gameRoot（游戏层）/ uiRoot（UI 层）彻底分离 ——
 *    游戏层震屏（shakeHolder）不再连带 HUD 一起晃，UI 全部收进 uiRoot 一棵子树。
 *  ★ 适配（用户口径）：背景拉伸铺满可见区；游戏内容整体等比缩小居中（比例不变）。
 *    两个根统一 scale = sA×DS（sA 按 720 创作空间算），见 applySafeLayout。 */
@ccclass('GameRoot')
export class GameRoot extends Component {
    @property({ type: Node, tooltip: '游戏层：背景 + 震屏 + 世界（瓶子/手/特效）' })
    gameRoot: Node = null!;
    @property({ type: Node, tooltip: 'UI 层：HUD/底栏/广告按钮/面板/页面/弹窗/Toast' })
    uiRoot: Node = null!;
    @property(Node) bgLayer: Node = null!;
    @property(Node) shakeHolder: Node = null!;
    @property(Node) worldLayer: Node = null!;
    @property(Node) fxLayer: Node = null!;
    @property(Node) hudRoot: Node = null!;
    @property(Node) navRoot: Node = null!;
    @property(Node) panelLayer: Node = null!;
    @property(Node) toastLayer: Node = null!;
    @property({ type: Node, tooltip: '瓶子场（BottleField）' })
    bottlesNode: Node = null!;
    @property({ type: Node, tooltip: '助手手（HelperHands）' })
    handsNode: Node = null!;
    @property({ type: Node, tooltip: '履带（CapMachine，横置挂 navRoot）' })
    beltNode: Node = null!;
    @property({ type: Node, tooltip: '底栏+内嵌面板（BottomPanel）' })
    bottomNode: Node = null!;
    @property({ type: Node, tooltip: '资源/音频节点（Res 组件；Boot 场景常驻后可为空）' })
    resRoot: Node = null!;
    @property({ type: Node, tooltip: '广告增益按钮层（固定在中层，不盖弹窗）' })
    adRoot: Node = null!;
    @property({ type: Node, tooltip: '界面层：页面（StartPage/GamePage）' })
    pageRoot: Node = null!;
    @property({ type: Node, tooltip: '界面层：弹窗（设置/统计/成就/离线/确认）' })
    dialogRoot: Node = null!;
    @property({ type: Node, tooltip: '界面层：最上层（Toast/加载遮罩）' })
    tipRoot: Node = null!;

    private hud: Hud = null!;
    private bottom: BottomPanel = null!;
    private abilities: Abilities = null!;
    private saveT = 0;
    private started = false;

    /** 场景未实体化的层用运行时兜底（与旧行为一致）。
     *  游戏层全部是**创作空间 720×1280** 的 UT；×DS×sA 的整体缩放挂在 gameRoot 上。
     *  uiRoot 不做整体缩放（applySafeLayout 把它铺满可见区），只当页面/弹窗挂载点。 */
    private ensureLayers() {
        if (!this.gameRoot) { this.gameRoot = nd(this.node, 'gameRoot', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.bgLayer) { this.bgLayer = nd(this.gameRoot, 'bgLayer', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.shakeHolder) { this.shakeHolder = nd(this.gameRoot, 'shakeHolder', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.worldLayer) { this.worldLayer = nd(this.shakeHolder, 'worldLayer', AUTHOR_W, AUTHOR_H, 0, 0); }
        // fx 层挂进世界层：两者一起缩放/平移，特效坐标才能和世界坐标严格对齐
        if (!this.fxLayer) { this.fxLayer = nd(this.worldLayer, 'fxLayer', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.hudRoot) { this.hudRoot = nd(this.gameRoot, 'hudRoot', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.navRoot) { this.navRoot = nd(this.gameRoot, 'navRoot', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.adRoot) { this.adRoot = nd(this.gameRoot, 'adRoot', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.panelLayer) { this.panelLayer = nd(this.gameRoot, 'panelLayer', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.toastLayer) { this.toastLayer = nd(this.gameRoot, 'toastLayer', AUTHOR_W, AUTHOR_H, 0, 0); }
        if (!this.uiRoot) { this.uiRoot = nd(this.node, 'uiRoot', AUTHOR_W, AUTHOR_H, 0, 0); }
        // ★ gameRoot 的等比缩放统一由 AutoNodeScale 组件（编辑器里挂）承担；
        //   场景没实体化 / 组件漏挂时这里补上，保证任何路径都走同一套适配。
        if (this.gameRoot.isValid && !this.gameRoot.getComponent(AutoNodeScale)) {
            this.gameRoot.addComponent(AutoNodeScale);
        }
    }

    /** 资源/音频单例：优先复用 Boot 场景的常驻节点，否则就地创建 */
    private ensureRes(): Res {
        let res: Res | null = (Res.I && Res.I.node && Res.I.node.isValid) ? Res.I : null;
        if (!res) {
            const resNode = this.resRoot || nd(this.node, 'Res', 1, 1, 0, 0);
            if (!resNode.getChildByName('BgmSource')) { nd(resNode, 'BgmSource', 1, 1, 0, 0); }
            res = resNode.getComponent(Res) || resNode.addComponent(Res);
        }
        return res;
    }

    onLoad() {
        // ★ 模块级单例在「重载场景」后仍然存在：如果重载那会儿正好有模态面板开着，
        //   Modal.count 会残留 >0 → BottleField 的 aim()/pointerDown() 永远 return
        //   → 整局再也点不动瓶子。所以每次进场景都要清一次。
        Modal.reset();
        G.clearListeners();
        // 关掉 debug 构建默认打开的性能面板（发布版也会顺带静默）
        try { if (profiler && profiler.hideStats) { profiler.hideStats(); } } catch (e) { /* ignore */ }
        // FIXED_WIDTH：设计宽 1440 恒等于屏幕宽；屏幕比 9:16 更「宽」时（横屏/桌面），
        // 由 gameRoot/uiRoot 整体等比缩小居中 —— 创作区完整可见、比例不变。
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
        // ★ Canvas 必须跟着「可见区」重新对齐（见 alignCanvas 注释），否则点击/布局全错位
        this.alignCanvas();
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        // 场景里 GameRoot 节点挂了 cc.Widget(45)（平铺可见区），尺寸交给它；
        // 只有没挂时才硬写设计尺寸兜底。
        if (!this.getComponent(Widget)) { ut.setContentSize(DESIGN_W, DESIGN_H); }

        // 层级：Main.scene 实体化 + @property 绑定；未绑定的层运行时兜底
        this.ensureLayers();

        // 资源与音频：优先复用 Boot 场景的常驻 Res 节点
        const res = this.ensureRes();

        const fx = this.fxLayer.getComponent(FxLayer) || this.fxLayer.addComponent(FxLayer);
        fx.bindRoot(this.shakeHolder);
        if (!this.toastLayer.getComponent(Toast)) { this.toastLayer.addComponent(Toast); }

        G.onAch = (id) => Toast.I?.achievement(id);
        G.onBerserk = () => {
            Toast.I?.show(t('berserk_active', G.lang) + '  ×' + G.berserkMult.toFixed(1), '#FF9E7A');
            FxLayer.I?.flash('#FF7A3A', 70, 0.4);
        };
        // 里程碑达成（GDD §7 的 24 阶）：提示阶段 + 本阶解锁掉哪条瓶子词条
        G.onMilestone = (n) => {
            const m = MILESTONES[n - 1];
            if (!m) { return; }
            const unlocked = BOTTLE_STATS.filter((s) => s.ms === n).map((s) => t(s.name, G.lang));
            let txt = t('ms_reached', G.lang)
                .replace('{n}', String(n))
                .replace('{t}', G.lang === 'zh' ? m.zh : m.en);
            if (unlocked.length) { txt += '  ·  ' + t('ms_unlock_stat', G.lang) + ' ' + unlocked.join(' / '); }
            Toast.I?.show(txt, '#FFE9A8');
            FxLayer.I?.flash('#FFD75E', 60, 0.35);
        };
        // 读档：把「已播报」阶段直接对齐到当前进度，避免进游戏一次性弹十几条
        G.syncMilestones(true);
        (globalThis as any).__tb_reload = () => { director.loadScene('Game'); };
        // 调试/自动化测试入口
        // 调试/自动化测试入口（panels/ui 两个是为了无头验收能直接开面板截图，不必靠盲点坐标）
        (globalThis as any).__tb = {
            G, res: Res, director, field: BottleField, abil: Abilities, bottom: BottomPanel,
            cap: CapMachine, hud: Hud, ads: Ads,
            panels: this.panelLayer,
            /** 购买引导：无头验收直接断言「下一步」文案与差额提示 */
            goal: debugGoal,
            // ⚠️ 必须 boot() 而不是 I：`__tb` 在同步阶段建好，而 UIMgr.I 要到
            //    buildUI() 才赋值，写 `UIMgr.I` 会捕获到 null。
            uiMgr: UIMgr.boot(),
            ui: {
                settings: () => UIMgr.I.showDialog(UIName.SettingDialog),
                ach: () => UIMgr.I.showDialog(UIName.AchDialog),
                stats: () => UIMgr.I.showDialog(UIName.StatsDialog),
                offline: () => UIMgr.I.showDialog(UIName.OfflineDialog, undefined,
                    { money: 1234, caps: 56, seconds: 3600 }),
                confirm: () => UIMgr.I.showDialog(UIName.ConfirmDialog),
            },
        };

        res.loadAll((ok) => {
            if (!ok) { console.warn('[GameRoot] resource load incomplete'); }
            // ⚠️ 背景必须在**贴图加载完之后**才建：buildBackground 里是 img()/rect()，
            //    setFrame 依赖 Res.I.sf()，在 onLoad 里同步调用会拿到 null frame →
            //    整个背景层静默空白（屏幕上只剩相机清屏色，看着就像「背景是深蓝」）。
            this.buildBackground();
            this.buildWorld();
            this.buildUI();
            this.afterReady();
        });   // 资源由 Load 场景预载完毕；独立预览本场景时这里会现加载（无进度条）
    }

    /* ---------------- 背景：整屏木桌 ---------------- */
    /**
     * 参考图里没有「带桌腿的木板」——木桌纹理铺满整屏，UI 全部浮在木纹上。
     * 所以这里退化成「一层深棕兜底 + 一整张木桌纹理」，桌腿/桌面板节点都取消了。
     */
    private buildBackground() {
        // ★ 场景实体化优先：bgLayer 下已摆好「dark + env/wood_table」→ 只绑引用
        //   （applySafeLayout 会按可见区重设尺寸）；否则运行时现建。
        const dark = this.bgLayer.getChildByName('dark');
        const wood = this.bgLayer.getChildByName('env/wood_table');
        if (dark && wood) {
            this.bgDark = dark;
            this.bgWood = wood.getComponent(Sprite)!;
            return;
        }
        // 初始就按创作空间建；applySafeLayout 会立刻按可见区重设（背景拉伸铺满）
        this.bgDark = rect(this.bgLayer, AUTHOR_W + 80, AUTHOR_H + 80, 0, 0, '#6B3A1A', 'dark');
        this.bgWood = img(this.bgLayer, 'env/wood_table', AUTHOR_W + 4, AUTHOR_H + 4, 0, 0);
    }
    private bgDark: Node = null!;
    private bgWood: Sprite = null!;
    private bgVinH = AUTHOR_H * 0.86;

    /* ---------------- 木桌装饰 ---------------- */
    /**
     * ★ 用户口径（第十四轮）：背景左上/右上的猫爪挂牌和枝条绿叶全部移除，
     *   木桌只保留整屏木纹。函数保留为空壳以兼容旧调用点。
     */
    private buildDecor(root: Node) { void root; }

    /* ---------------- 世界：只剩瓶子与特效（履带已移到 UI 层） ---------------- */
    private buildWorld() {
        const fieldNode = this.bottlesNode || nd(this.worldLayer, 'bottles', AUTHOR_W, AUTHOR_H, 0, 0);
        const field = fieldNode.getComponent(BottleField) || fieldNode.addComponent(BottleField);
        // ★ 买瓶飞入的临时精灵要挂在 panelLayer（在 navRoot **之上**）：
        //   起飞点是底栏商店面板里的价格按钮，挂世界层的话这半程会被底部 UI 整块盖住
        //   （用户口径：瓶子要在下面商店模块的上层）。
        field.flyLayer = this.panelLayer;
        const handsNode = this.handsNode || nd(this.worldLayer, 'hands', AUTHOR_W, AUTHOR_H, 0, 0);
        handsNode.getComponent(HelperHands) || handsNode.addComponent(HelperHands);

        // ★ fxLayer 必须排到世界层**末尾**（场景里它在 bottles/hands 之前），
        //   否则所有飘字都被后建的节点盖住，桌面上战斗时一个字都看不到。
        this.fxLayer.setSiblingIndex(this.worldLayer.children.length - 1);
    }

    /* ---------------- UI ---------------- */
    private buildUI() {
        this.buildDecor(this.hudRoot);

        // 广告统一入口：确认弹窗挂在 toastLayer（盖在一切 UI 之上）；
        // 接真实 SDK 时在进场景前 Ads.setProvider(...) 即可，业务层不用改。
        Ads.I.uiRoot = this.toastLayer;

        // ★ 场景里 hudRoot 已挂 Hud 组件（@property 绑好顶栏引用）就复用；
        //   旧场景没挂才补挂（组件内部再做「场景绑定优先 / 运行时现建」分流）。
        this.hud = this.hudRoot.getComponent(Hud) || this.hudRoot.addComponent(Hud);
        const ui = UIMgr.I;
        this.hud.build({
            onSettings: () => ui.showDialog(UIName.SettingDialog),
            onAch: () => ui.showDialog(UIName.AchDialog),
            onStats: () => ui.showDialog(UIName.StatsDialog),
            onLang: () => {
                G.data.settings.lang = G.lang === 'zh' ? 'en' : 'zh';
                G.notify();
            },
        });

        // ★ 桌上那两张「快捷购买卡」（普通塑料瓶 / 助手之手）已按用户要求删除：
        //   它们和底栏的「商城」按钮功能重复，且浮在木桌中间挡瓶子。
        //   买瓶子 / 雇助手统一走底栏「商城」→ 升级面板。

        // 履带：横置、挂在底部块上（能力条与底栏之间）。放 UI 层是为了通栏不变形，
        // 同时把宽阔屏多出来的高度全部让给瓶子活动区。位置/尺寸在场景里编辑。
        const beltNode = this.beltNode || nd(this.navRoot, 'belt', AUTHOR_W, LAYOUT.beltH, 0, LAYOUT.beltY);
        beltNode.getComponent(CapMachine) || beltNode.addComponent(CapMachine);

        // ★ 底栏 + 内嵌升级面板（同一个组件）：商城 / 技能树 两个页签 + 瓶子种类下拉框，
        //   列表直接铺在底栏下方 —— 不再是二级弹窗（用户要求，见 BottomPanel 顶部注释）。
        const bpNode = this.bottomNode || nd(this.navRoot, 'bottomPanel', AUTHOR_W, AUTHOR_H, 0, 0);
        this.bottom = bpNode.getComponent(BottomPanel) || bpNode.addComponent(BottomPanel);
        this.bottom.build();

        // ★ 界面管理器：所有弹窗/页面预制体按需 instantiate 到这三层的某一层。
        //   以前是 `openSettings(panelLayer)` 这类函数用 UIKit 现画一棵节点树，
        //   编辑器里场景永远是空的、改间距要改代码。现在统一走 UIMgr + prefab。
        UIMgr.boot().bindRoots(this.pageRoot, this.dialogRoot, this.tipRoot);

        // 购买引导的跳转桥：商城里的「去研发」靠它把面板切到技能树的对应类目。
        // 用注入而不是 import —— BottomPanel 反向依赖 Guidance（差额提示），
        // 直接互相 import 会形成 ESM 循环依赖（见 Guidance.ts 顶部注释）。
        registerNav({
            openTree: (page: number) => { this.bottom.showTreeCategory(page); },
            closeShop: () => { this.bottom.showShopCategory(0); },
        });

        // ★ 场景里 navRoot 已挂 Abilities 组件就复用（能力条 abilityBar 已实体化在场景里）
        const ab = this.navRoot.getComponent(Abilities) || this.navRoot.addComponent(Abilities);
        this.abilities = ab;
        ab.buildBar(this.navRoot);

        // 广告按钮层：在 navRoot 之后、uiRoot 之前 —— 固定在场景里，
        // 不再运行时 nd()（那样它会落到 gameRoot 末尾，时序不可控）。
        const adNode = this.adRoot || nd(this.gameRoot, 'adRoot', AUTHOR_W, AUTHOR_H, 0, 0);
        const ad = adNode.getComponent(AdButtons) || adNode.addComponent(AdButtons);
        ad.build();
    }

    /* ---------------- 启动（Boot 场景标题页点击后进入） ---------------- */
    private afterReady() {
        this.rebindSceneRenderers();
        Res.I.masterScale = G.data.settings.master;
        this.applySafeLayout();
        const off = G.applyOffline();
        // 离线收益 = 独立预制体（Prefabs/UI/OfflineDialog），挂 DialogRoot。
        // 以前它是 Hud.showOffline 里用 rect/label/button 现搭的一棵节点树。
        if (off.money > 0 || off.caps > 0) {
            UIMgr.I.showDialog(UIName.OfflineDialog, undefined, {
                money: off.money, caps: off.caps, seconds: off.seconds,
            });
        }
        G.checkAch();
    }

    /**
     * ★ 场景渲染组件的「注册自救」（实测踩坑）：
     *   场景反序列化的 Sprite/Label 在「场景被 preload 提前实例化 + 常驻节点迁移」的时序下，
     *   首次 markForUpdateRenderData 发生在渲染管线就绪之前 → 请求被丢弃且永不重发。
     *   表现：节点树/组件/贴图/颜色/世界变换**全部正常**，但整棵子树就是不画；
     *   运行时 addChild 的新节点一切正常。把含场景渲染组件的层摘下来重新挂回
     *   （_lpos/_siblingIndex 都不动），子树重新走一遍 onEnable 即恢复。
     *   无头验收复现实测：重挂 hudRoot/navRoot/adRoot 三层后整屏 UI 立即出现。
     */
    private rebindSceneRenderers() {
        const parent = this.gameRoot;
        if (!parent || !parent.isValid) { return; }
        for (const name of ['hudRoot', 'navRoot', 'adRoot']) {
            const layer = parent.getChildByName(name);
            if (!layer || !layer.isValid || layer.children.length === 0) { continue; }
            const idx = layer.getSiblingIndex();
            parent.removeChild(layer);
            parent.addChild(layer);
            layer.setSiblingIndex(idx);
        }
    }

    /**
     * 竖屏移动端自适应（核心）：
     *  0. 屏幕比 9:16 更「宽」时（横屏 / 桌面浏览器 / 方形窗口），把整个 720x1280 设计区
     *     整体等比缩小并居中 —— 设计区完整可见，不会被横向压扁或裁掉两边；
     *  1. 顶部 UI 块钉在屏幕顶部、底部 UI 块（快捷购买 / 能力条 / 导航 / 抽屉）钉在屏幕底部，
     *     各自让开安全区（设计留白与异形屏安全区取大者）；
     *  2. 中部舞台（桌面 + 瓶子活动区 + 左侧履带）按「剩余高度」与「可用宽度」取小者等比缩放，
     *     并把 WORLD_ENV 这团内容的中心摆到剩余区域正中 —— 于是瓶子活动区与履带整体
     *     水平居中于屏幕、垂直居中于上下两块 UI 之间的正中。
     */
    /**
     * ★ Canvas 对齐「可见区」中心 —— 等价于旧场景 Canvas 节点上那个 cc.Widget(alignFlags=45)
     *   的运行时职责，预制体化时为了躲编辑器报错把它删了，必须用代码补回来，否则：
     *   Canvas 停在场景里的设计位置 (360,640)（设计区左下角 = 世界原点），而屏幕比例 ≠ 9:16 时
     *   可见区中心 ≠ (360,640)，导致：
     *   ① getUILocation()（UI 坐标，原点=屏幕左下角）与世界坐标错开 (设计高-可见高)/2
     *      → BottleField.aim / CapMachine 的「UI 坐标直接当世界坐标用」全部失准
     *      → 点瓶子全打空（命中框只有 ±43 设计单位，错位 50 就永远 miss）；
     *   ② applySafeLayout 按「世界原点=屏幕中心」钉上下 UI 块 → 顶栏飞出屏幕、底栏错位。
     *   对齐后：世界原点 = 可见区左下角，Canvas 中心 = 可见区中心，渲染与点击完全一致。
     *   （场景里不重新挂 Widget：编辑器里它会触发 "Canvas has not attached to a scene" 刷屏。）
     *
     * ★ 尺寸也要同步（第二十五轮）：GameRoot 节点上的 cc.Widget(45) 以 Canvas 为参考，
     *   而**引擎不会把 Canvas 的 UITransform 改成可见区**（实测停在场景里手写的 1440×2560），
     *   于是 Widget 铺的是 2560 而不是真实可见高 —— gameRoot 的 AutoNodeScale 会算大
     *   （720×1280 视口下实测 s=2，正确值 1.894，顶/底各多出 ~68 设计单位被裁）。
     *   这里把 Canvas 尺寸钉到可见区，整条 Widget 链才与旧的 sA×DS 逐字等价。
     */
    private alignCanvas() {
        const cv = this.node.parent;
        if (!cv || !cv.isValid) { return; }
        const vs = view.getVisibleSize();
        const vo = view.getVisibleOrigin();
        const x = vo.x + vs.width / 2;
        const y = vo.y + vs.height / 2;
        const cut = cv.getComponent(UITransform) || cv.addComponent(UITransform);
        if (Math.abs(cut.width - vs.width) > 0.01 || Math.abs(cut.height - vs.height) > 0.01) {
            cut.setContentSize(vs.width, vs.height);
        }
        if (Math.abs(cv.position.x - x) < 0.01 && Math.abs(cv.position.y - y) < 0.01) { return; }
        cv.setPosition(x, y, 0);
        const canvas = cv.getComponent(Canvas);
        const cam = canvas && canvas.cameraComponent;
        if (cam && cam.isValid) { cam.node.setWorldPosition(x, y, 1000); }
    }

    private applySafeLayout() {
        // 旋屏 / 窗口缩放后可见区变了，Canvas 对齐也要跟（幂等）
        this.alignCanvas();
        // ★ 全部布局数学都在**创作空间（720×1280）**里做：可见区（设计单位）除以 DS 换算。
        const vs = view.getVisibleSize();
        const vw = vs.width / DS;              // 创作空间可见宽（FIXED_WIDTH 下恒 720）
        const vh = vs.height / DS;             // 创作空间可见高

        // ---- 0) gameRoot 整体等比缩放（用户口径：游戏内容整体缩小到屏幕中间、比例不变） ----
        //   ★ 改由**编辑器实体化**承担（第二十五轮）：
        //     scene 里 `GameRoot` 节点挂 cc.Widget(alignFlags=45) 平铺整个摄像机可见区，
        //     `gameRoot` 节点 UT=720×1280 + AutoNodeScale 组件 → s = min(父宽/720, 父高/1280)。
        //     FIXED_WIDTH 下父宽恒 1440 → s = min(2, 可见高/1280) ≡ 原来的 sA×DS，数值逐字等价。
        //     只有「组件漏挂 / 直接跑旧场景」时才走下面的运行时兜底。
        const sA = Math.min(1, vh / AUTHOR_H);
        const rootScale = sA * DS;
        if (this.gameRoot && this.gameRoot.isValid) {
            if (!this.gameRoot.getComponent(AutoNodeScale)) {
                this.gameRoot.setScale(rootScale, rootScale, 1);
            }
            this.gameRoot.setPosition(0, 0, 0);
        }
        // ---- 0b) uiRoot：铺满可见区（**不缩放**）。Page/Dialog/Tip 用 Widget 全对齐它，
        //      每个 UI 预制体再用「根 Widget 平铺 + AutoNodeScale 等比缩放内容」适配。
        if (this.uiRoot && this.uiRoot.isValid) {
            this.uiRoot.setScale(1, 1, 1);
            this.uiRoot.setPosition(0, 0, 0);
            const uw = this.uiRoot.getComponent(Widget);
            // 挂了 Widget 就交给它（自动跟 GameRoot 的可见区尺寸）；没挂才运行时兜底。
            if (!uw) {
                const uut = this.uiRoot.getComponent(UITransform) || this.uiRoot.addComponent(UITransform);
                uut.setContentSize(vs.width, vs.height);
                for (const child of this.uiRoot.children) {
                    const w = child.getComponent(Widget);
                    if (w) { w.updateAlignment(); }
                }
            }
        }
        const vhE = vh / sA;          // 创作空间内部的等效可见高度（sA<1 时恒为 1280）
        const vwE = vw / sA;

        // 异形屏安全区（Web 上一般取不到，退化为 0，靠设计留白兜底）
        // 注意：getSafeAreaRect 返回的是「可见区单位（设计）」，要先 ÷DS 换到创作空间、
        // 再除以 sA，否则 sA<1（平板/宽屏）时顶部留白会被算成巨大值、顶部 UI 块被推到底部。
        let devTop = 0, devBottom = 0;
        try {
            const sa = sys.getSafeAreaRect();
            if (sa && sa.height > 1) {
                devTop = Math.max(0, vs.height - (sa.y + sa.height)) / DS / sA;
                devBottom = Math.max(0, sa.y) / DS / sA;
            }
        } catch (e) { /* ignore */ }
        const padTop = Math.max(LAYOUT.safeTop, devTop);
        const padBottom = Math.max(LAYOUT.safeBottom, devBottom);

        // ---- 1) 上下 UI 块：贴边定位 ----
        const hudDY = (vhE / 2 - padTop) - SAFE_BLOCKS.topY;
        const navDY = (-vhE / 2 + padBottom) - SAFE_BLOCKS.botBottomY;
        if (this.hudRoot && this.hudRoot.isValid) { this.hudRoot.setPosition(0, hudDY, 0); }
        if (this.navRoot && this.navRoot.isValid) { this.navRoot.setPosition(0, navDY, 0); }
        if (this.hud && this.hud.isValid) { this.hud.fitWidth(vwE); }

        // 模态遮罩尺寸跟着可见区走（宽屏 / 超高屏都要盖满，否则边缘露白）
        MASK_SIZE.w = Math.max(1000, vwE + 80);
        MASK_SIZE.h = Math.max(1600, vhE + 80);
        // ★ 底栏 + 内嵌升级面板都常驻在屏幕底部，不再有「遮罩要切到按钮上方」那套处理
        //   （那是升级面板还是模态卡时的补丁，见旧 Drawer.setMaskCut）。

        // ---- 2) 中部舞台：等比缩放 + 居中 ----
        const bandTop = SAFE_BLOCKS.topBottomY + hudDY;
        const bandBottom = SAFE_BLOCKS.botTopY + navDY;

        const envW = WORLD_ENV.x1 - WORLD_ENV.x0;
        const envH = WORLD_ENV.y1 - WORLD_ENV.y0;
        const envCX = (WORLD_ENV.x0 + WORLD_ENV.x1) / 2;
        const envCY = (WORLD_ENV.y0 + WORLD_ENV.y1) / 2;

        const fitH = (bandTop - bandBottom - 4) / envH;    // 竖向上留 4px 余量
        const fitW = (vwE * 0.97) / envW;                  // 横向左右各让 1.5%
        let ws = Math.min(fitH, fitW);
        // 下限 0.32：横屏/超宽窗口时 fitH 会要很小，钳太高等于「看不全」（用户口径），
        // 上限 1.15 不变（超窄长屏时舞台稍微放大填宽度）
        ws = Math.max(0.32, Math.min(1.15, ws));

        const wx = -envCX * ws;
        const wy = (bandTop + bandBottom) / 2 - envCY * ws;
        if (this.worldLayer && this.worldLayer.isValid) {
            this.worldLayer.setScale(ws, ws, 1);
            this.worldLayer.setPosition(wx, wy, 0);
        }
        this.worldScale = ws;
        // UI 层的横置履带要接住世界坐标事件（瓶盖起飞点），必须知道这组变换
        WORLD_XFORM.s = ws;
        WORLD_XFORM.ox = wx;
        WORLD_XFORM.oy = wy;
        WORLD_XFORM.navDY = navDY;

        // ---- 3) 木桌铺满可见区（宽屏/超高屏外侧不能露底） ----
        if (this.bgDark && this.bgDark.isValid) { setSize(this.bgDark, vwE + 40, vhE + 40); }
        if (this.bgWood && this.bgWood.isValid) { setSize(this.bgWood.node, vwE + 6, vhE + 6); }

        this.lastVh = vh;
    }
    private lastVh = 0;
    /** 当前世界层缩放比例（供外部做坐标换算参考） */
    worldScale = 1;

    /* ---------------- 帧循环 ---------------- */
    update(dt: number) {
        const d = Math.min(dt, 0.05);
        G.tick(d);
        if (G.hasIdle) { G.idleOn = true; }
        this.saveT += d;
        if (this.saveT >= 12) { this.saveT = 0; G.save(); }
        if (Res.I) { Res.I.masterScale = G.data.settings.master; }
        // 屏幕尺寸变化（旋屏 / 浏览器缩放）时重新贴合安全区
        const vh = view.getVisibleSize().height;
        if (Math.abs(vh - this.lastVh) > 0.5) { this.applySafeLayout(); }
        void button; void img; void rect; void tween; void UIOpacity; void Vec3; void input; void Input; void t; void label;
    }

    onDestroy() { G.save(); }
}

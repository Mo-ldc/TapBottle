import { _decorator, Component, Node, UITransform, Sprite, Vec3, tween, UIOpacity, input, Input, view, ResolutionPolicy, director, profiler, sys } from 'cc';
import { BOTTLE_STATS, DESIGN_H, DESIGN_W, LAYOUT, MILESTONES, SAFE_BLOCKS, WORLD_ENV, WORLD_XFORM } from './Core/GameConfig';
import { G } from './Core/State';
import { Res } from './Core/Res';
import { t } from './Core/Locale';
import { button, img, label, MASK_SIZE, nd, rect, setFrame, setSize } from './UI/UIKit';
import { Toast } from './UI/Toast';
import { Hud } from './UI/Hud';
import { BottomPanel } from './UI/BottomPanel';
import { debugGoal, registerNav } from './UI/Guidance';
import { Modal } from './UI/Modal';
import { Ads } from './UI/Ads';
import { AdButtons } from './UI/AdButtons';
import { openAch } from './UI/AchPanel';
import { openStats } from './UI/StatsPanel';
import { openSettings } from './UI/SettingsPanel';
import { BottleField } from './Game/BottleField';
import { HelperHands } from './Game/HelperHands';
import { CapMachine } from './Game/CapMachine';
import { Abilities } from './Game/Abilities';
import { FxLayer } from './Game/Fx';

const { ccclass } = _decorator;

/** 游戏主控：装配整个竖屏场景（720×1280） */
@ccclass('GameRoot')
export class GameRoot extends Component {
    private contentRoot: Node = null!;
    private bgLayer: Node = null!;
    private worldLayer: Node = null!;
    private fxLayer: Node = null!;
    private uiLayer: Node = null!;
    private panelLayer: Node = null!;
    private toastLayer: Node = null!;
    private shakeHolder: Node = null!;

    private hud: Hud = null!;
    private bottom: BottomPanel = null!;
    private hudRoot: Node = null!;
    private navRoot: Node = null!;
    private abilities: Abilities = null!;
    private saveT = 0;
    private started = false;

    onLoad() {
        // ★ 模块级单例在「重载场景」后仍然存在：如果重载那会儿正好有模态面板开着，
        //   Modal.count 会残留 >0 → BottleField 的 aim()/pointerDown() 永远 return
        //   → 整局再也点不动瓶子。所以每次进场景都要清一次。
        Modal.reset();
        G.clearListeners();
        // 关掉 debug 构建默认打开的性能面板（发布版也会顺带静默）
        try { if (profiler && profiler.hideStats) { profiler.hideStats(); } } catch (e) { /* ignore */ }
        // FIXED_WIDTH：竖屏手机上设计宽 720 恒等于屏幕宽（窄屏以高补足），铺满整屏。
        // 屏幕比 9:16 更「宽」时（横屏 / 桌面浏览器 / 方形窗口），由 contentRoot 整体等比缩小居中，
        // 保证 720x1280 设计区完整可见，而不是被横向压扁或裁掉两边。
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(DESIGN_W, DESIGN_H);

        // 整个竖屏设计区的外层容器（自适应时整体等比缩放/居中）
        this.contentRoot = nd(this.node, 'contentRoot', DESIGN_W, DESIGN_H, 0, 0);
        this.bgLayer = nd(this.contentRoot, 'bgLayer', DESIGN_W, DESIGN_H, 0, 0);
        this.shakeHolder = nd(this.contentRoot, 'shakeHolder', DESIGN_W, DESIGN_H, 0, 0);
        this.worldLayer = nd(this.shakeHolder, 'worldLayer', DESIGN_W, DESIGN_H, 0, 0);
        // fx 层挂进世界层：两者一起缩放/平移，特效坐标才能和世界坐标严格对齐
        this.fxLayer = nd(this.worldLayer, 'fxLayer', DESIGN_W, DESIGN_H, 0, 0);
        this.uiLayer = nd(this.shakeHolder, 'uiLayer', DESIGN_W, DESIGN_H, 0, 0);
        this.hudRoot = nd(this.uiLayer, 'hudRoot', DESIGN_W, DESIGN_H, 0, 0);
        this.navRoot = nd(this.uiLayer, 'navRoot', DESIGN_W, DESIGN_H, 0, 0);
        this.panelLayer = nd(this.contentRoot, 'panelLayer', DESIGN_W, DESIGN_H, 0, 0);
        this.toastLayer = nd(this.contentRoot, 'toastLayer', DESIGN_W, DESIGN_H, 0, 0);

        // 资源与音频
        const resNode = nd(this.node, 'Res', 1, 1, 0, 0);
        nd(resNode, 'BgmSource', 1, 1, 0, 0);
        resNode.addComponent(Res);

        this.fxLayer.addComponent(FxLayer).bindRoot(this.shakeHolder);
        this.toastLayer.addComponent(Toast);

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
        (globalThis as any).__tb_reload = () => { director.loadScene('Main'); };
        // 调试/自动化测试入口
        // 调试/自动化测试入口（panels/ui 两个是为了无头验收能直接开面板截图，不必靠盲点坐标）
        (globalThis as any).__tb = {
            G, res: Res, director, field: BottleField, abil: Abilities, bottom: BottomPanel,
            cap: CapMachine, hud: Hud, ads: Ads,
            panels: this.panelLayer,
            /** 购买引导：无头验收直接断言「下一步」文案与差额提示 */
            goal: debugGoal,
            ui: { settings: openSettings, ach: openAch, stats: openStats },
        };

        Res.I.loadAll((ok) => {
            if (!ok) { console.warn('[GameRoot] resource load incomplete'); }
            // ⚠️ 背景必须在**贴图加载完之后**才建：buildBackground 里是 img()/rect()，
            //    setFrame 依赖 Res.I.sf()，在 onLoad 里同步调用会拿到 null frame →
            //    整个背景层静默空白（屏幕上只剩相机清屏色，看着就像「背景是深蓝」）。
            this.buildBackground();
            this.buildWorld();
            this.buildUI();
            this.afterReady();
        });
    }

    /* ---------------- 背景：整屏木桌 ---------------- */
    /**
     * 参考图里没有「带桌腿的木板」——木桌纹理铺满整屏，UI 全部浮在木纹上。
     * 所以这里退化成「一层深棕兜底 + 一整张木桌纹理」，桌腿/桌面板节点都取消了。
     */
    private buildBackground() {
        this.bgDark = rect(this.bgLayer, DESIGN_W + 80, DESIGN_H + 80, 0, 0, '#6B3A1A', 'dark');
        this.bgWood = img(this.bgLayer, 'env/wood_table', DESIGN_W + 4, DESIGN_H + 4, 0, 0);
    }
    private bgDark: Node = null!;
    private bgWood: Sprite = null!;
    private bgVinH = DESIGN_H * 0.86;

    /* ---------------- 木桌装饰 ---------------- */
    /**
     * ★ 用户口径（第十四轮）：背景左上/右上的猫爪挂牌和枝条绿叶全部移除，
     *   木桌只保留整屏木纹。函数保留为空壳以兼容旧调用点。
     */
    private buildDecor(root: Node) { void root; }

    /* ---------------- 世界：只剩瓶子与特效（履带已移到 UI 层） ---------------- */
    private buildWorld() {
        const fieldNode = nd(this.worldLayer, 'bottles', DESIGN_W, DESIGN_H, 0, 0);
        const field = fieldNode.addComponent(BottleField);
        // ★ 买瓶飞入的临时精灵要挂在 panelLayer（在 uiLayer/navRoot **之上**）：
        //   起飞点是底栏商店面板里的价格按钮，挂世界层的话这半程会被底部 UI 整块盖住
        //   （用户口径：瓶子要在下面商店模块的上层）。
        field.flyLayer = this.panelLayer;
        nd(this.worldLayer, 'hands', DESIGN_W, DESIGN_H, 0, 0).addComponent(HelperHands);

        // ★ fxLayer 必须排到世界层**末尾**（它在 onLoad 里就建好了，后面还有 table/bottles/hands 加进来），
        //   否则所有飘字都被后建的节点盖住，桌面上战斗时一个字都看不到。
        this.fxLayer.setSiblingIndex(this.worldLayer.children.length - 1);
    }

    /* ---------------- UI ---------------- */
    private buildUI() {
        this.buildDecor(this.hudRoot);

        // 广告统一入口：确认弹窗挂在 toastLayer（盖在一切 UI 之上）；
        // 接真实 SDK 时在进场景前 Ads.setProvider(...) 即可，业务层不用改。
        Ads.I.uiRoot = this.toastLayer;

        this.hud = this.hudRoot.addComponent(Hud);
        this.hud.build({
            onSettings: () => openSettings(this.panelLayer),
            onAch: () => openAch(this.panelLayer),
            onStats: () => openStats(this.panelLayer),
            onLang: () => {
                G.data.settings.lang = G.lang === 'zh' ? 'en' : 'zh';
                G.notify();
            },
        });

        // ★ 桌上那两张「快捷购买卡」（普通塑料瓶 / 助手之手）已按用户要求删除：
        //   它们和底栏的「商城」按钮功能重复，且浮在木桌中间挡瓶子。
        //   买瓶子 / 雇助手统一走底栏「商城」→ 升级面板。

        // 履带：横置、挂在底部块上（能力条与底栏之间）。放 UI 层是为了通栏不变形，
        // 同时把宽阔屏多出来的高度全部让给瓶子活动区。
        const beltNode = nd(this.navRoot, 'belt', DESIGN_W, LAYOUT.beltH, 0, LAYOUT.beltY);
        this.beltNode = beltNode;
        beltNode.addComponent(CapMachine);

        // ★ 底栏 + 内嵌升级面板（同一个组件）：商城 / 技能树 两个页签 + 瓶子种类下拉框，
        //   列表直接铺在底栏下方 —— 不再是二级弹窗（用户要求，见 BottomPanel 顶部注释）。
        const bpNode = nd(this.navRoot, 'bottomPanel', DESIGN_W, DESIGN_H, 0, 0);
        this.bottom = bpNode.addComponent(BottomPanel);
        this.bottom.build();

        // 购买引导的跳转桥：商城里的「去研发」靠它把面板切到技能树的对应类目。
        // 用注入而不是 import —— BottomPanel 反向依赖 Guidance（差额提示），
        // 直接互相 import 会形成 ESM 循环依赖（见 Guidance.ts 顶部注释）。
        registerNav({
            openTree: (page: number) => { this.bottom.showTreeCategory(page); },
            closeShop: () => { this.bottom.showShopCategory(0); },
        });

        this.abilities = this.navRoot.addComponent(Abilities);
        this.abilities.buildBar(this.navRoot);

        // 屏幕中部靠左的三枚广告增益按钮（金币翻倍 / 瓶盖翻倍 / 光圈变大）
        // 挂 uiLayer（屏幕中心坐标系）而不是 hudRoot/navRoot —— 它们被钉在上下安全区，
        // 只有 uiLayer 原点始终在屏幕正中，「中间靠左」才落得准。
        nd(this.uiLayer, 'adRoot', DESIGN_W, DESIGN_H, 0, 0).addComponent(AdButtons).build();
    }

    private beltNode: Node = null!;

    /* ---------------- 启动（直接进游戏，无 Logo 页） ---------------- */
    private afterReady() {
        Res.I.masterScale = G.data.settings.master;
        this.applySafeLayout();
        Res.I.music(true, G.data.settings.music);
        const off = G.applyOffline();
        // 弹窗挂 panelLayer（在 uiLayer 之上）：否则会被晚创建的左侧广告按钮盖住
        if (off.money > 0 || off.caps > 0) { this.hud.showOffline(off.money, off.caps, off.seconds, this.panelLayer); }
        G.checkAch();
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
    private applySafeLayout() {
        const vs = view.getVisibleSize();
        const vh = vs.height;
        const vw = vs.width;

        // ---- 0) 设计区整体缩放（宽屏不压扁、不裁切） ----
        const s = Math.min(1, vh / DESIGN_H);
        if (this.contentRoot && this.contentRoot.isValid) {
            this.contentRoot.setScale(s, s, 1);
            this.contentRoot.setPosition(0, 0, 0);
        }
        const vhE = vh / s;          // 设计区内部的等效可见高度（s<1 时恒为 1280）
        const vwE = vw / s;

        // 异形屏安全区（Web 上一般取不到，退化为 0，靠设计留白兜底）
        // 注意：getSafeAreaRect 返回的是「可见区单位」，要先换算到设计区等效单位（除以 s），
        // 否则 s<1（平板/宽屏）时顶部留白会被算成巨大值、顶部 UI 块被推到底部。
        let devTop = 0, devBottom = 0;
        try {
            const sa = sys.getSafeAreaRect();
            if (sa && sa.height > 1) {
                devTop = Math.max(0, vh - (sa.y + sa.height)) / s;
                devBottom = Math.max(0, sa.y) / s;
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
        ws = Math.max(0.50, Math.min(1.15, ws));

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

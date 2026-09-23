import { _decorator, Component, Node, UITransform, Sprite, Vec3, tween, UIOpacity, input, Input, view, ResolutionPolicy, director, profiler, sys } from 'cc';
import { BOTTLE_STATS, DESIGN_H, DESIGN_W, LAYOUT, MILESTONES, SAFE_BLOCKS, WORLD_ENV } from './Core/GameConfig';
import { G } from './Core/State';
import { Res } from './Core/Res';
import { t } from './Core/Locale';
import { button, img, label, MASK_SIZE, nd, rect, setFrame, setSize } from './UI/UIKit';
import { Toast } from './UI/Toast';
import { Hud } from './UI/Hud';
import { NavBar } from './UI/NavBar';
import { QuickBuy } from './UI/QuickBuy';
import { Drawer, DrawerTab } from './UI/Drawer';
import { openSkill } from './UI/SkillPanel';
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
    private quickBuy: QuickBuy = null!;
    private nav: NavBar = null!;
    private drawer: Drawer = null!;
    private drawerLayer: Node = null!;
    private hudRoot: Node = null!;
    private navRoot: Node = null!;
    private abilities: Abilities = null!;
    private saveT = 0;
    private started = false;

    onLoad() {
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
        // 抽屉层需在模态面板之下
        this.drawerLayer = nd(this.contentRoot, 'drawerLayer', DESIGN_W, DESIGN_H, 0, 0);
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
        (globalThis as any).__tb = { G, res: Res, director, field: BottleField, abil: Abilities, drawer: Drawer };

        this.buildBackground();

        Res.I.loadAll((ok) => {
            if (!ok) { console.warn('[GameRoot] resource load incomplete'); }
            this.buildWorld();
            this.buildUI();
            this.afterReady();
        });
    }

    /* ---------------- 背景 ---------------- */
    private buildBackground() {
        this.bgDark = rect(this.bgLayer, DESIGN_W + 60, DESIGN_H + 60, 0, 0, '#0E1018', 'dark');
        this.bgFog = img(this.bgLayer, 'env/fog', DESIGN_W, this.bgFogH, 0, DESIGN_H / 2 - this.bgFogH / 2, '#46527A');
        this.bgVin = img(this.bgLayer, 'env/vignette', DESIGN_W, this.bgVinH, 0, 0, '#000000');
    }
    private bgDark: Node = null!;
    private bgFog: Sprite = null!;
    private bgVin: Sprite = null!;
    private bgFogH = 460;
    private bgVinH = DESIGN_H * 0.86;

    /* ---------------- 世界 ---------------- */
    private buildWorld() {
        const tw = LAYOUT.tableWidth;
        const th = LAYOUT.tableHeight;
        const table = nd(this.worldLayer, 'table', tw, th + 140, LAYOUT.tableX, LAYOUT.tableY - 40);

        // 桌腿：对齐桌面板左右角、并紧贴板下沿（原版 Table_LegLeft/Right 的用法）。
        // 注意必须「贴住」板底：超高屏上桌面板下方会空出一段（舞台按屏宽缩放后垂直居中），
        // 若桌腿悬在板下 47px，就会在空隙里显出两块漂浮的暗红方块。
        // 面板 bottom（局部）= 40 - th/2，腿高 54 → 腿心 = 40 - th/2 - 27。
        for (const d of [{ x: -171, tex: 'env/table_leg_l' }, { x: 171, tex: 'env/table_leg_r' }]) {
            const lg = nd(table, 'leg' + d.x, 158, 54, d.x, 40 - th / 2 - 27);
            setFrame(lg.addComponent(Sprite), d.tex, 158, 54);
        }

        const top = nd(table, 'top', tw, th, 0, 40);
        setFrame(top.addComponent(Sprite), 'env/table', tw, th);

        nd(this.worldLayer, 'bottles', DESIGN_W, DESIGN_H, 0, 0).addComponent(BottleField);
        nd(this.worldLayer, 'hands', DESIGN_W, DESIGN_H, 0, 0).addComponent(HelperHands);
        // 左侧竖向瓶盖履带（局部坐标以履带中线为原点）
        nd(this.worldLayer, 'caps', 320, 1000, LAYOUT.railX, 0).addComponent(CapMachine);

        // ★ fxLayer 必须排到世界层**末尾**。
        //   fxLayer 是在 onLoad() 里建的（挂世界层是为了和世界坐标一起缩放/平移对得上），
        //   而 table / bottles / hands / caps 都是这里才建的 → 兄弟序上 fx 一直是最底层：
        //   实测 `worldLayer.children = fxLayer#0, table#1, bottles#2, hands#3, caps#4`，
        //   于是所有飘字（+$N 金币、扣盖、MISS、处决 +600%…）全被桌面挡住，
        //   在桌面上战斗时一个字都看不到。放到末尾即可，仍在 shakeHolder 内保持坐标一致。
        this.fxLayer.setSiblingIndex(this.worldLayer.children.length - 1);
    }

    /* ---------------- UI ---------------- */
    private buildUI() {
        this.hud = this.hudRoot.addComponent(Hud);
        this.hud.build({
            onSettings: () => openSettings(this.panelLayer),
            onAch: () => openAch(this.panelLayer),
            onStats: () => openStats(this.panelLayer),
            onLang: () => {
                G.data.settings.lang = G.lang === 'zh' ? 'en' : 'zh';
                G.notify();
            },
        }, this.navRoot);

        // 快捷购买卡属于「底部块」，必须跟主导航一起贴屏幕底
        this.quickBuy = this.navRoot.addComponent(QuickBuy);
        this.quickBuy.build();

        const nav = this.navRoot.addComponent(NavBar);
        // 升级面板（居中 Q 弹模态，与模态面板同层但排在 panelLayer 之下）
        const drawerNode = nd(this.drawerLayer, 'drawer', DESIGN_W, LAYOUT.drawerH, 0, 0);
        this.drawer = drawerNode.addComponent(Drawer);
        this.drawer.build();

        nav.build((id) => {
            if (id === 'tree') { openSkill(this.panelLayer); nav.highlight(null); return; }
            this.drawer.toggle(id as DrawerTab);
        });
        this.nav = nav;

        // 升级面板现在是屏幕中间的模态卡（自带全屏遮罩），底栏不再被盖住，
        // 所以打开期间保持底栏可见，只同步一下高亮。
        this.drawer.onOpenChanged = (o: boolean) => {
            this.nav.highlight(o ? this.drawer.tab : null);
        };

        this.abilities = this.navRoot.addComponent(Abilities);
        this.abilities.buildBar(this.navRoot);
    }

    /* ---------------- 启动（直接进游戏，无 Logo 页） ---------------- */
    private afterReady() {
        Res.I.masterScale = G.data.settings.master;
        this.applySafeLayout();
        Res.I.music(true, G.data.settings.music);
        const off = G.applyOffline();
        if (off.money > 0 || off.caps > 0) { this.hud.showOffline(off.money, off.caps, off.seconds); }
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
        // 升级面板已改成屏幕正中的模态卡：整层不跟随底栏位移，遮罩才正好盖住整屏
        if (this.drawerLayer && this.drawerLayer.isValid) { this.drawerLayer.setPosition(0, 0, 0); }

        // 模态遮罩尺寸跟着可见区走（宽屏 / 超高屏都要盖满，否则边缘露白）
        MASK_SIZE.w = Math.max(1000, vwE + 80);
        MASK_SIZE.h = Math.max(1600, vhE + 80);

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

        if (this.worldLayer && this.worldLayer.isValid) {
            this.worldLayer.setScale(ws, ws, 1);
            this.worldLayer.setPosition(-envCX * ws, (bandTop + bandBottom) / 2 - envCY * ws, 0);
        }
        this.worldScale = ws;

        // ---- 3) 背景铺满可见区（设计区整体缩小时外侧也要有底色） ----
        if (this.bgDark && this.bgDark.isValid) { setSize(this.bgDark, vwE + 40, vhE + 40); }
        if (this.bgFog && this.bgFog.isValid) { setSize(this.bgFog.node, vwE, this.bgFogH); }
        if (this.bgVin && this.bgVin.isValid) { setSize(this.bgVin.node, vwE, this.bgVinH); }

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

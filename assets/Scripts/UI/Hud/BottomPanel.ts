import { _decorator, Component, Graphics, Label, Node, ScrollView, Sprite, UITransform } from 'cc';
import {
    ABILITY_GRAPH, BOTTLE_STATS, BOTTLE_TREE_ORDER, BottleStatDef, CURSOR, HELPER_GRAPH,
    LAYOUT, PLAYER_GRAPH, SkillNodeDef, TIERS,
} from '../../Core/GameConfig';
import { G, SKILL_BY_ID, UNLOCK_SKILL } from '../../Core/State';
import { t } from '../../Core/Locale';
import { fmt, hex } from '../../Core/Util';
import { applyFontDeep, label, nd, newBadgePlate, pressable, setFrame, setSize, sliced, destroyChildren, roundedPanel, scrollView, UIScrollBar, sizeOf } from '../Base/UIKit';
import { WOOD, wobble, woodButton, woodPlate } from '../Base/Theme';
import { applyRow, makeCell, COLS, CELL_W, CELL_H, GAP_X, GAP_Y, RowSpec, RowUI, skillSub, statSub, successText } from '../Widgets/UpgradeRows';
import { capsShortAd, MACHINE_PRICE, moneyShortAd, nextGoalText } from './Guidance';
import { Toast } from '../Base/Toast';
import { BottleField } from '../../Game/BottleField';

const { ccclass, property } = _decorator;

/**
 * ★ 三页签的内容口径（对齐原版 ShopMenuUI / FromPageUpgradeMenuUI / SkillTreeUI 的解析结果，
 *   见 BottleFlipInc/_analysis/model.json + report_cn.txt）：
 *
 *   · 商店（无下拉，全平铺）：每个已解锁瓶子一张「买瓶数量」按钮 + 瓶盖机器 + 助手之手；
 *   · 升级（无下拉，全平铺，随解锁增多）：每阶「收入 / 悬停翻转」快捷入口 +
 *     光标圈大小（解锁光圈后出现）+ 瓶盖机收入（买机器后出现）+ 各阶助手许可（雇助手后出现）；
 *   · 技能树（唯一带下拉框的页签）：
 *       ① 瓶子模块 —— 每个已研发阶一棵完整的瓶子天赋树（原版 BottleSkillTreeUpgradeUI，
 *          Unlock → 收入 → 收入加成 → 翻转速度 → 瓶盖获取量 → 购买上限 → 翻转精通
 *          → 收入翻倍 → 再次翻转 → 随机翻转 → 悬停翻转），末端挂两条「模块解锁」
 *          （解锁光圈 → 手部模块；解锁传送带模块 → 履带科技线）与「解锁下一阶瓶」；
 *       ② 科技线 —— 履带升级 / 挂机模式 / 手部操作 / 特殊技能，**各自要模块解锁后才出现**。
 *   ⚠️ 技能树整体需要在商店买下瓶盖机器才能打开（原版口径）。
 *
 *   ★ 用户口径（第十八轮）：
 *     · **未开放研发的项一概不画**（商店的助手之手在没研发 h_unlock 前整行消失；
 *       升级页的各项本来就带门控），等它真的可研发了才出现；
 *     · 任何**新出现**的可见项在自己格子上挂「新」角标，同时对应底栏按钮也挂一枚，
 *       玩家点过那一行的按钮即视为已读（跨存档记忆，见 State.itemSeen）。
 *
 *   列表是**两列网格**（一行 2 个选项卡），格子见 UpgradeRows.makeCell。
 *   顶部一条提示带常显「下一步该做什么」+ 里程碑进度。
 */
type Tab = 'shop' | 'up' | 'tree';

/** ★ 页签换皮（buco 系列）：底板选中 buco01 / 未选中 buco02，图标 buco03/04/05 */
const TAB_PLATE: Record<Tab, { on: string, off: string, icon: string, iconH: number }> = {
    shop: { on: 'skin/main/tab_on', off: 'skin/main/tab_off', icon: 'skin/main/tab_ic_shop', iconH: 42 },
    up: { on: 'skin/main/tab_on', off: 'skin/main/tab_off', icon: 'skin/main/tab_ic_up', iconH: 42 },
    tree: { on: 'skin/main/tab_on', off: 'skin/main/tab_off', icon: 'skin/main/tab_ic_tree', iconH: 42 },
};

interface CatDef {
    id: string;
    /** Locale key（瓶子模块没有 key，名字直接取 TIERS） */
    key: string;
    icon: string;
    /** 瓶子模块：对应的阶号（0..6） */
    tier?: number;
    /** 科技线：模块解锁所需的科技节点 id（没解锁就不出现在下拉框） */
    req?: string;
}

/**
 * 技能树页签的**科技线**类目 —— 下拉框只在这一页出现（用户口径）。
 *
 * ★ 四条科技线各有**模块解锁条件**（`req`）：没解锁就不出现在下拉框里。
 *   解锁入口挂在「瓶子模块」的瓶子树末端（原版就是这么挂的，见 Locale.unlock_*）。
 *     · 履带升级 ← 解锁传送带模块（p_stability）
 *     · 挂机模式 ← 解锁光圈（p_cursor）
 *     · 手部操作 ← 解锁光圈（p_cursor）★ 用户口径：光圈开启手部技能模块
 *     · 特殊技能 ← 挂机模式（p_idle）
 */
const TREE_TECHS: CatDef[] = [
    { id: 'belt', key: 'tree_cat_belt', icon: 'skin/main/belt_composite', req: 'p_stability' },
    { id: 'idle', key: 'tree_cat_idle', icon: 'stat/time', req: 'p_cursor' },
    { id: 'hand', key: 'tree_cat_hand', icon: 'env/hand', req: 'p_cursor' },
    { id: 'abil', key: 'tree_cat_ability', icon: 'ability/flyingcoke', req: 'p_idle' },
];

/**
 * 科技线的节点归属（对齐原版 PnH/MachineGate、PnH/IdleMode、PnH/Helper 三组）。
 * ⚠️ 两个**数值型**节点不进树，改放「升级」页（原版 PlayerUpgradeMenuUI 就是这么摆的）：
 *    · p_cursorsize 光标圈大小 —— 得先解锁光标天赋(p_cursor)才出现在升级页；
 *    · p_machineinc 瓶盖机收入 —— 得先买下瓶盖机器才出现在升级页。
 *    助手的六阶翻瓶许可（h_bronze..h_diamond）同理：原版在升级页 · 助手区。
 */
const TREE_BELT_NODES = ['p_stability', 'p_machinespeed', 'p_gateunlock', 'p_gatechance'];
/**
 * ★ 用户口径（第十九轮）：`p_cursor`（解锁光圈）**不进技能树**了 ——
 *   它改到「商店」里花金币直接买（见 shopRows → cursorRow）。
 *   这里留着会导致「挂机模式」栏里渲染一个永远点不了的死节点。
 */
const TREE_IDLE_NODES = ['p_sizelimit', 'p_idle', 'p_idlemove', 'p_idletime', 'p_idlerecov'];
const HELPER_CAP_NODES = ['h_bronze', 'h_silver', 'h_gold', 'h_ruby', 'h_emerald', 'h_diamond'];

const PANEL_W = 708;
const SCROLL_W = 664;
/**
 * 滚动视口高度（★ 第十九轮：格子尺寸不变，只是把提示带压薄 1px，两行仍完整可见）。
 */
const SCROLL_H = 170;
/**
 * 底栏五件等距宽度：商店 / 升级 / 技能树 / 种类下拉框 / 列表展开按钮。
 * ★ 第三十四轮：为塞下第 5 件（展开/收起把手），四件各缩窄，总宽仍 706（左右各留 7）。
 */
const NAV_W = [138, 138, 154, 188, 56];
const NAV_GAP = 8;
/** 五件的中心 x（和 674 + 4×8 间隙 = 706 → 左缘 -353，右缘 +353） */
const NAV_X = [-284, -138, 16, 195, 325];
/**
 * 列表展开额外高度：可视区 170 → 350（2 行 → 4 行 = 8 格）。
 * ★ 用户口径：面板**底边钉死**（LAYOUT.panelY - panelH/2 = -616 贴屏幕底），
 *   变高的部分全部向上生长，展开后盖住履带/能力条/底栏（把手按钮 z 最高仍可点）。
 */
const EXPAND_DH = 180;

@ccclass('BottomPanel')
export class BottomPanel extends Component {
    static I: BottomPanel = null!;

    private tab: Tab = 'shop';
    /** 技能树当前类目 id（'bt0'..'bt6' 瓶子模块 / 'belt' / 'idle' / 'hand' / 'abil'）—— 下拉框只服务技能树页签 */
    private treeCat = 'bt0';

    /** ---- 场景实体化引用（Game.scene 里 bottomPanel 节点下已摆好；未绑定时按名字找/兜底现建） ---- */
    @property({ type: Node, tooltip: '「商店」页签按钮（tab_shop，自带 label 文字 + tabNew 角标）' })
    tabShop: Node = null!;
    @property({ type: Node, tooltip: '「升级」页签按钮（tab_up）' })
    tabUp: Node = null!;
    @property({ type: Node, tooltip: '「技能树」页签按钮（tab_tree）' })
    tabTree: Node = null!;
    @property({ type: Node, tooltip: '下拉框（dropdown，自带 ddLb 文字 + chev 箭头 + newTag 角标）' })
    ddNode: Node = null!;
    @property({ type: Label, tooltip: '下拉框当前类目文字（dropdown/ddLb）' })
    ddLb: Label = null!;
    @property({ type: Node, tooltip: '下拉框「新」角标（dropdown/newTag）' })
    ddNew: Node = null!;
    @property({ type: Node, tooltip: '内嵌面板（panel：bg/inner 底板 + hintLb/msLb + scroll 滚动区）' })
    panel: Node = null!;
    @property({ type: Node, tooltip: '滚动视口（panel/scroll）' })
    scrollRoot: Node = null!;
    @property({ type: Node, tooltip: '滚动内容（panel/scroll/view/content，列表行运行时生成在这里）' })
    content: Node = null!;
    @property({ type: ScrollView, tooltip: 'ScrollView 组件（panel/scroll 上）' })
    scrollSV: ScrollView = null!;
    @property({ type: Label, tooltip: '「下一步」提示带（panel/hintLb）' })
    hintLb: Label = null!;
    @property({ type: Label, tooltip: '里程碑进度（panel/msLb）' })
    msLb: Label = null!;

    private tabUis: Record<string, { node: Node; lb: Label }> = {};
    /** 底栏三个页签按钮右上角的「新」角标 */
    private tabNew: Record<string, Node> = {};
    private ddMenu: Node = null!;
    /** 下拉框的宽与中心 x（菜单展开时按它对齐「正上方」） */
    private ddW = 236;
    private ddX = 235;
    private menuOpen = false;

    /** 列表展开态（bd16 把手：箭头向上=伸出 8 格 / 向下=回收 4 格） */
    private expanded = false;
    private expandBtn: Node = null!;
    /** 滚动视口当前高度（随展开切换；rebuild/滚动条都按它算） */
    private get VH(): number { return SCROLL_H + (this.expanded ? EXPAND_DH : 0); }

    private rows: RowUI[] = [];
    private built = false;
    private acc = 0;
    private lastLang = '';
    /** 上一次构建的「结构指纹」——变了才重建节点，否则只刷文本 */
    private sig = '';
    /** 上一次构建的「页签+模块」key —— 相同则重建后保持玩家滚动位置（★ 用户口径：列表位置由玩家掌控） */
    private lastCatKey = '';

    onLoad() { BottomPanel.I = this; }

    /* ================= 搭建 ================= */
    /**
     * ★ 场景实体化优先：bottomPanel 节点下已摆好底栏骨架（tab_shop/tab_up/tab_tree/
     *   dropdown/panel）→ 只绑引用；否则运行时现建（与场景树逐节点同构）。
     *   动态内容（下拉菜单项 / 两列网格的行）任何时候都由 rebuild() 生成进 content。
     */
    build() {
        if (this.built) { return; }
        this.built = true;
        if (!this.bindScene()) { this.construct(); }
        this.reskinTabs();
        this.normalizeDropdown();
        this.wire();
        G.addListener(() => this.onLang());
        this.lastLang = G.lang;
        this.rebuild();
        this.baselineSeen();
    }

    /** 场景里已摆好底栏骨架（有 tab_shop）→ 补齐引用，返回 true */
    private bindScene(): boolean {
        const g = (s: string) => this.node.getChildByName(s);
        if (!g('tab_shop')) { return false; }
        if (!this.tabShop || !this.tabShop.isValid) { this.tabShop = g('tab_shop')!; }
        if (!this.tabUp || !this.tabUp.isValid) { this.tabUp = g('tab_up')!; }
        if (!this.tabTree || !this.tabTree.isValid) { this.tabTree = g('tab_tree')!; }
        if (!this.ddNode || !this.ddNode.isValid) { this.ddNode = g('dropdown')!; }
        if ((!this.ddLb || !this.ddLb.isValid) && this.ddNode) { this.ddLb = this.ddNode.getChildByName('ddLb')?.getComponent(Label) || null!; }
        if ((!this.ddNew || !this.ddNew.isValid) && this.ddNode) { this.ddNew = this.ddNode.getChildByName('newTag') || null!; }
        // ★ 第四十四轮：场景烘的 ddNew 是旧版 Graphics 底板 → 强制换 buco06 圆徽章
        this.reskinDdNew();
        if (!this.panel || !this.panel.isValid) { this.panel = g('panel')!; }
        if (!this.expandBtn || !this.expandBtn.isValid) { this.expandBtn = g('expandBtn') || null!; }
        if (this.panel) {
            if (!this.hintLb || !this.hintLb.isValid) { this.hintLb = this.panel.getChildByName('hintLb')?.getComponent(Label) || null!; }
            if (!this.msLb || !this.msLb.isValid) { this.msLb = this.panel.getChildByName('msLb')?.getComponent(Label) || null!; }
            if (!this.scrollRoot || !this.scrollRoot.isValid) { this.scrollRoot = this.panel.getChildByName('scroll') || null!; }
            if (!this.scrollSV || !this.scrollSV.isValid) { this.scrollSV = this.scrollRoot?.getComponent(ScrollView) || null!; }
            if ((!this.content || !this.content.isValid) && this.scrollRoot) {
                this.content = this.scrollRoot.getChildByName('view')?.getChildByName('content') || null!;
            }
        }
        this.tabUis = {};
        this.tabNew = {};
        const mk = (id: Tab, n: Node | null) => {
            if (!n) { return; }
            this.tabUis[id] = { node: n, lb: n.getChildByName('label')?.getComponent(Label) || null! };
            this.tabNew[id] = n.getChildByName('tabNew') || null!;
            // ★ 第四十四轮：场景烘的是旧版 Graphics 底板 → 强制换 buco06 圆徽章（代码为布局真源）
            const tg = this.tabNew[id];
            if (tg && tg.isValid) {
                const ut = sizeOf(n);
                tg.setPosition(ut.width / 2 - 14, ut.height / 2 - 12, 0);
                newBadgePlate(tg);
                if (!tg.getChildByName('lb')) {
                    const lb = label(tg, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
                    lb.node.name = 'lb';
                    // ★ 场景渲染注册坑：运行时新建组件挂场景烘焙节点下不渲染，重挂子树救活
                    lb.node.removeFromParent();
                    tg.addChild(lb.node);
                }
            }
        };
        mk('shop', this.tabShop);
        mk('up', this.tabUp);
        mk('tree', this.tabTree);
        // 滚动指示条：场景只摆节点（sbar/thumb），组件进场景后在这里补挂接线
        if (this.scrollRoot && this.scrollSV && this.content && !this.scrollRoot.getComponent(UIScrollBar)) {
            const sb = this.scrollRoot.addComponent(UIScrollBar);
            const track = this.panel.getChildByName('sbar');
            sb.sv = this.scrollSV;
            sb.content = this.content;
            sb.thumb = track?.getChildByName('thumb') || null!;
            sb.trackH = this.VH - 24;
            sb.viewH = this.VH;
        }
        if (this.ddNode) { this.ddW = this.ddNode.getComponent(UITransform)?.width || 236; this.ddX = this.ddNode.position.x; }
        // 编辑器里摆的 Label 是系统字体，进场景后统一换成 NotoSansSC
        applyFontDeep(this.node);
        return true;
    }

    /** 运行时兜底搭建（与 Game.scene 里 bottomPanel 的节点树逐节点同构） */
    private construct() {
        const root = this.node;

        /* ---- 底栏：五件等距铺满 720：【商店】【升级】【技能树】【下拉框】【展开/回收】 ----
         *   138 + 138 + 154 + 188 + 56 + 4×8 间隙 = 706，左右各留 7（见 NAV_W / NAV_X） */
        const H = LAYOUT.navH;
        const Y = LAYOUT.navY;
        const [W1, W2, W3, W4, W5] = NAV_W;
        const [shopX, upX, treeX, ddX, exX] = NAV_X;

        const mkTab = (id: Tab, x: number, w: number, key: string, icon: string) => {
            const n = woodButton(root, {
                w, h: H, x, y: Y,
                fill: id === this.tab ? WOOD.gold : WOOD.cream, radius: 20,
                icon, iconW: 42, iconH: 42, iconX: -w / 2 + 34,
                text: t(key, G.lang), fontSize: 26, textColor: WOOD.text,
                textX: 12, textPadX: 62,
                name: 'tab_' + id, sound: null,
            });
            this.tabUis[id] = { node: n, lb: n.getComponentInChildren(Label)! };
            // ★ 用户口径（第十八轮）：该页签里有「新出现的、还没点过」的项 → 按钮右上角挂「新」
            //   底板 = buco06 红圆徽章整图（33×33 原尺寸，第四十四轮换皮）
            const tg = nd(n, 'tabNew', 33, 33, w / 2 - 14, H / 2 - 12);
            setFrame(tg.addComponent(Sprite), 'skin/main/new_badge', 33, 33);
            label(tg, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
            tg.active = false;
            this.tabNew[id] = tg;
        };
        mkTab('shop', shopX, W1, 'nav_shop', 'ui/icon/icon_shop2');
        mkTab('up', upX, W2, 'nav_upgrade', 'ui/icon/icon_upgrade');
        mkTab('tree', treeX, W3, 'nav_skill', 'ui/icon/icon_medal');
        this.tabShop = this.tabUis['shop'].node;
        this.tabUp = this.tabUis['up'].node;
        this.tabTree = this.tabUis['tree'].node;

        /* 下拉框（最右，贴着「技能树」）；★ 只有技能树页签才显示它 */
        const dd = woodPlate(root, {
            w: W4, h: H, x: ddX, y: Y,
            fill: WOOD.creamDark, radius: 20, name: 'dropdown',
        });
        this.ddNode = dd;
        this.ddW = W4;
        this.ddX = ddX;
        dd.active = this.tab === 'tree';
        this.ddLb = label(dd, '', -12, 2, 124, 40, {
            size: 20, color: WOOD.text, overflow: 'shrink', hAlign: 'center',
        });
        this.ddLb.node.name = 'ddLb';
        // 三角箭头用 Graphics 画（字体里不一定有 ▼）—— 贴下拉框右缘
        const chev = nd(dd, 'chev', 30, 20, W4 / 2 - 26, -6);
        const cg = chev.addComponent(Graphics);
        cg.fillColor = hex(WOOD.text);
        cg.moveTo(-14, 7); cg.lineTo(14, 7); cg.lineTo(0, -9); cg.close(); cg.fill();

        // ★ 用户口径（第十五轮）：有没点开过的技能模块 → 下拉框右上角挂「新」标签，点过即消
        //   底板 = buco06 红圆徽章整图（33×33 原尺寸，第四十四轮换皮）
        this.ddNew = nd(dd, 'newTag', 33, 33, 70, 10);
        setFrame(this.ddNew.addComponent(Sprite), 'skin/main/new_badge', 33, 33);
        label(this.ddNew, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
        this.ddNew.active = false;

        /* ---- 提示带 + 列表（内嵌面板本体） ---- */
        this.buildPanel(root);

        /* ---- 列表展开/回收把手（bd16 整图；建在 panel 之后 → z 在面板之上，
         *      展开时面板盖住底栏，把手仍可点；y 跟面板顶边走，见 applyExpand） ---- */
        const eb = nd(root, 'expandBtn', W5, 52, exX, LAYOUT.panelY + LAYOUT.panelH / 2 + 30);
        setFrame(eb.addComponent(Sprite), 'skin/main/btn_arrow_up', W5, 52);
        this.expandBtn = eb;
    }

    /**
     * 首次进游戏的一次性「已读基线」。
     * ★ 不做的话，桌面上本来就摆着的那些项（T1 瓶 / 瓶盖机 / T1 收入…）在玩家眼里全是「新」，
     *   三个底栏按钮开局就一起亮 —— 那不是「新增」而是「初始」。
     *   技能树模块**不标**：它在买下瓶盖机之前进不去，买下那一刻标「新」正好是玩家想要的提示。
     */
    private baselineSeen() {
        if (G.seenBaseline) { return; }
        const ids: string[] = [];
        const add = (r: RowSpec | null) => { if (r && r.id) { ids.push(r.id); } };
        for (const r of this.shopBottleRows()) { add(r); }
        add(this.machineRow());
        add(this.cursorRow());
        add(this.helperRow());
        for (const r of this.upgradeRows()) { add(r); }
        G.markBaseline(ids);
    }

    private buildPanel(root: Node) {
        const p = nd(root, 'panel', PANEL_W, LAYOUT.panelH, 0, LAYOUT.panelY);
        this.panel = p;
        roundedPanel(p, PANEL_W, LAYOUT.panelH, 0, 0, '#EFDCBB', 20, '#4A2C14', 4, 'bg');
        // 内圈浅色描边（木纹皮肤的「厚边」口径）：填色必须是不透明的 6 位 hex
        roundedPanel(p, PANEL_W - 12, LAYOUT.panelH - 12, 0, 0, '#F4E4C6', 16, '#D8BF94', 2, 'inner');

        const topEdge = LAYOUT.panelH / 2;
        // ★ 第十九轮：提示带字号 16 → 18（文案同步压短，见 Locale.goal_*），整体上提 1px 让位给列表
        this.hintLb = label(p, '', -PANEL_W / 2 + 18, topEdge - 21, 440, 26,
            { size: 18, color: '#7A4210', hAlign: 'left', anchorX: 0, overflow: 'shrink' });
        this.hintLb.node.name = 'hintLb';
        this.msLb = label(p, '', PANEL_W / 2 - 18, topEdge - 21, 200, 26,
            { size: 17, color: '#8A6134', hAlign: 'right', anchorX: 1, overflow: 'shrink' });
        this.msLb.node.name = 'msLb';

        // 滚动区：上沿贴提示带下方，下沿离面板底 8px
        const sv = scrollView(p, SCROLL_W, SCROLL_H, 0, -15);
        this.scrollRoot = sv.root;
        this.content = sv.content;
        this.scrollSV = sv.sv;
    }

    /** 接页签/下拉框事件（场景/运行时同一套手感：按压缩放 + click 音 + 摆动） */
    private wire() {
        for (const id of ['shop', 'up', 'tree'] as Tab[]) {
            const ui = this.tabUis[id];
            if (ui && ui.node && ui.node.isValid) {
                pressable(ui.node, () => {
                    // ★ 用户口径（第十七轮）：点页签按钮，选项左右晃一下
                    wobble(ui.node);
                    this.showTab(id);
                });
            }
        }
        const dd = this.ddNode;
        if (dd && dd.isValid) {
            dd.on(Node.EventType.TOUCH_START, () => { dd.setScale(0.96, 0.96, 1); });
            dd.on(Node.EventType.TOUCH_CANCEL, () => { dd.setScale(1, 1, 1); });
            dd.on(Node.EventType.TOUCH_END, () => {
                dd.setScale(1, 1, 1);
                wobble(dd);            // ★ 用户口径（第十七轮）：下拉框也是「选项」，点击同样左右晃
                this.toggleMenu();
            });
        }
        // 列表展开/回收把手（bd16；pressable 自带 click 音 + 按压缩放）
        if (this.expandBtn && this.expandBtn.isValid) {
            pressable(this.expandBtn, () => {
                wobble(this.expandBtn);
                this.toggleExpand();
            });
        }
    }

    /* ================= 列表展开 / 回收（第三十四轮） ================= */
    /**
     * ★ 用户口径：面板底边钉死（贴屏幕底），变高部分全部向上生长；
     *   展开后盖住履带/能力条/底栏页签 —— 把手按钮 z 最高（bottomPanel 末位）+ y 跟面板顶边走，始终可点。
     */
    private toggleExpand() {
        this.expanded = !this.expanded;
        this.applyExpand();
        this.rebuild();   // 按新视口高度重夹滚动位置 + 刷新把手显隐
    }

    /** 把面板/底板/提示带/滚动视口/滚动条/把手切到当前展开态（SLICED 底板改尺寸即拉伸） */
    private applyExpand() {
        if (!this.panel || !this.panel.isValid) { return; }
        const h = LAYOUT.panelH + (this.expanded ? EXPAND_DH : 0);
        const cy = (LAYOUT.panelY - LAYOUT.panelH / 2) + h / 2;
        this.panel.setPosition(0, cy, 0);
        setSize(this.panel, PANEL_W, h);
        for (const nm of ['bg', 'inner']) {
            const n = this.panel.getChildByName(nm);
            if (!n) { continue; }
            const inset = nm === 'inner' ? 12 : 0;
            setSize(n, PANEL_W - inset, h - inset);
            const st = n.getChildByName('stroke');
            if (st) { setSize(st, PANEL_W - inset, h - inset); }
        }
        // 提示带贴新顶边
        const top = h / 2 - 21;
        if (this.hintLb && this.hintLb.isValid) { this.hintLb.node.setPosition(this.hintLb.node.position.x, top, 0); }
        if (this.msLb && this.msLb.isValid) { this.msLb.node.setPosition(this.msLb.node.position.x, top, 0); }
        // 滚动视口（Mask=GRAPHICS_RECT 监听 SIZE_CHANGED 自动重绘）；视口中心 y 恒 -15（底边固定推导）
        if (this.scrollRoot && this.scrollRoot.isValid) {
            setSize(this.scrollRoot, SCROLL_W, this.VH);
            const view = this.scrollRoot.getChildByName('view');
            if (view) { setSize(view, SCROLL_W, this.VH); }
            const sb = this.scrollRoot.getComponent(UIScrollBar);
            if (sb) { sb.trackH = this.VH - 24; sb.viewH = this.VH; }
        }
        const sbar = this.panel.getChildByName('sbar');
        if (sbar) { setSize(sbar, 6, this.VH - 24); sbar.setPosition(SCROLL_W / 2 + 12, -15, 0); }
        // ★ 用户口径（第三十四轮）：列表向上伸出时，底栏 3 个页签（+下拉框）**跟着一起上移**，
        //   始终贴在列表上方，不会被变高的面板盖住 —— 整条底栏随面板顶边抬高 EXPAND_DH。
        const dy = this.expanded ? EXPAND_DH : 0;
        for (const id of ['shop', 'up', 'tree'] as Tab[]) {
            const ui = this.tabUis[id];
            if (ui && ui.node && ui.node.isValid) {
                ui.node.setPosition(ui.node.position.x, LAYOUT.navY + dy, 0);
            }
        }
        if (this.ddNode && this.ddNode.isValid) {
            this.ddNode.setPosition(this.ddNode.position.x, LAYOUT.navY + dy, 0);
        }
        // 把手：y 跟面板顶边走；箭头向上=伸出 / 向下=回收（scaleY 翻转，图内无文字可放心翻）
        if (this.expandBtn && this.expandBtn.isValid) {
            this.expandBtn.setPosition(NAV_X[4], cy + h / 2 + 30, 0);
            this.expandBtn.setScale(1, this.expanded ? -1 : 1, 1);
        }
    }

    /* ================= 下拉框（只服务技能树页签） ================= */
    /**
     * 技能树下拉项 = ① 瓶子模块（每个已研发阶一个，未解锁的阶不出现）
     *              ② 科技线四条（各自的模块解锁条件满足后才出现）
     * ★ 用户口径：解锁「稀有瓶」后它的模块才进下拉框；解锁光圈 → 手部模块；
     *   解锁传送带模块 → 履带科技线。
     */
    private cats(): CatDef[] {
        const out: CatDef[] = [];
        for (let i = 0; i < 7; i++) {
            if (i > 0 && !G.tierResearched(i)) { continue; }
            out.push({ id: 'bt' + i, key: '', icon: 'bottle/body_' + TIERS[i].art, tier: i });
        }
        for (const c of TREE_TECHS) {
            if (c.req && G.skLv(c.req) <= 0) { continue; }
            out.push(c);
        }
        return out;
    }

    private catDef(): CatDef {
        const list = this.cats();
        for (const c of list) { if (c.id === this.treeCat) { return c; } }
        // 选中的类目被门控藏起来了（比如模块被重置）→ 退回瓶子模块
        const first = list[0];
        this.treeCat = first.id;
        return first;
    }

    /** 还有「没被玩家点开过」的已解锁模块吗（下拉框「新」标签的显示条件） */
    private hasNewModules(): boolean {
        if (!G.hasMachine) { return false; }
        for (const c of this.cats()) { if (!G.itemSeen(c.id)) { return true; } }
        return false;
    }

    private refreshNewTag() {
        if (this.ddNew && this.ddNew.isValid) { this.ddNew.active = this.hasNewModules(); }
    }

    private catName(c: CatDef): string {
        if (c.tier !== undefined) { return G.lang === 'zh' ? TIERS[c.tier].zh : TIERS[c.tier].en; }
        return t(c.key, G.lang);
    }

    /**
     * 展开/收起下拉菜单（菜单浮在履带上，不是模态）。
     * ★ 用户要求「下拉框在选项按钮的正上方」：菜单右缘对齐下拉框右缘、
     *   底缘贴底栏顶沿 —— 不是整屏居中。
     */
    /**
     * ★ 第四十轮（用户口径「列表按钮 ui 重叠了，下拉框太大了」）：矫正场景烘的 dropdown。
     * 两个历史遗留问题（探针实测）：
     *  ① gloss/stroke 视觉底板 **236×72**，比节点槽位（188×72，五件套布局的格位）左右各溢
     *     24px —— 左边压住「技能树」页签、右边顶到展开把手，看起来就是「按钮互相重叠」；
     *  ② ddLb 文字盒 112×144（=逻辑 56×72）+ 自动换行 —— 「普通塑料瓶」5 个字被掰成
     *     三行竖排、字号 24 也偏大，字直接压在图标/箭头上。
     * 这里双路径统一矫正：底板收到槽位内（176×58），ddLb 整只重建（单行 SHRINK、20 号），
     * 「新」角标同步收进缩小后的底板右上角。
     */
    private normalizeDropdown() {
        const dd = this.ddNode;
        if (!dd || !dd.isValid) { return; }
        const shrink = (name: string) => {
            const ut = dd.getChildByName(name)?.getComponent(UITransform);
            if (ut) { ut.setContentSize(176, 58); }
        };
        shrink('gloss');
        shrink('stroke');
        // 箭头下移一点，给右上角的「新」角标让位（两者在缩小后的底板里不再打架）
        const chev = dd.getChildByName('chev');
        if (chev) { chev.setPosition(chev.position.x, -6, 0); }
        // ddLb 重建：场景版的盒(56 逻辑宽)+wrap 必然三行竖排，直接换一只单行的
        if (this.ddLb && this.ddLb.isValid && this.ddLb.node && this.ddLb.node.isValid) {
            this.ddLb.node.destroy();
        }
        this.ddLb = label(dd, '', -12, 2, 124, 40, {
            size: 20, color: WOOD.text, overflow: 'shrink', hAlign: 'center',
        });
        this.ddLb.node.name = 'ddLb';
        if (this.ddNew && this.ddNew.isValid) {
            // ★ 第四十四轮：「新」角标换 buco06 圆徽章（33×33），贴缩小后底板右上角
            this.reskinDdNew();
        }
    }

    /** ddNew 统一换皮：buco06 圆徽章 33×33 + 原生字体白字（bindScene 接手 / normalizeDropdown 收窄后都走这） */
    private reskinDdNew() {
        const tg = this.ddNew;
        if (!tg || !tg.isValid) { return; }
        tg.setPosition(70, 10, 0);
        newBadgePlate(tg);
        const lb = label(tg, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
        lb.node.name = 'lb';
        // ★ 场景渲染注册坑：运行时新建的组件挂在**场景烘焙节点**下不进渲染注册
        //   （红圆能显示是因为复用场景烘的 Sprite 组件只换贴图；新建 Label 必须重挂子树）
        lb.node.removeFromParent();
        tg.addChild(lb.node);
    }

    private toggleMenu() {
        this.menuOpen = !this.menuOpen;
        if (!this.menuOpen) {
            if (this.ddMenu && this.ddMenu.isValid) { this.ddMenu.active = false; }
            return;
        }
        if (!this.ddMenu || !this.ddMenu.isValid) {
            this.ddMenu = nd(this.node, 'ddMenu', 240, 10, 0, 0);
        }
        this.ddMenu.removeAllChildren();
        const list = this.cats();
        const cur = this.catDef().id;
        // ★ 第四十轮（用户口径「下拉框太大了」）：菜单整体缩一档 —— 项高 52→42、宽 280→240，
        //   字号/图标/角标同步缩小；行距 4 不变。
        const IH = 42, PAD = 5, MW = 240;
        const mh = list.length * (IH + 4) + PAD * 2;
        (this.ddMenu.getComponent(UITransform) as any).setContentSize(MW, mh);
        roundedPanel(this.ddMenu, MW, mh, 0, 0, '#3E2C1A', 12, '#1E1408', 4, 'mbg');

        // 右缘对齐下拉框右缘（超宽屏也不出屏：再夹一道屏幕右边界）
        const rightEdge = Math.min(this.ddX + this.ddW / 2, 360 - 8);
        const bottom = LAYOUT.navY + LAYOUT.navH / 2 + 6;
        this.ddMenu.setPosition(rightEdge - MW / 2, bottom + mh / 2, 0);
        this.ddMenu.setSiblingIndex(this.node.children.length - 1);   // 压在履带之上

        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const y = mh / 2 - PAD - IH / 2 - i * (IH + 4);
            const on = c.id === cur;
            // ★ 第三十五轮：选项背景换品阶底框 dik —— 瓶子项用本阶色 dik_{tier+1}，
            //   非瓶子功能项默认第一块 dik_1；整图 SIMPLE（dik 无九宫格边）。
            //   选中态 = 淡金 tint 提亮（彩色底框不能再用深棕 tint 压暗）。
            const bgPath = c.tier !== undefined ? 'skin/tier/dik_' + (c.tier + 1) : 'skin/tier/dik_1';
            const sp = sliced(this.ddMenu, 'ui/panel/card_white', MW - 10, IH, 0, y, [24, 24, 24, 24],
                on ? '#FFE9B8' : '#FFFFFF', 'it' + i);
            sp.type = Sprite.Type.SIMPLE;
            setFrame(sp, bgPath, MW - 10, IH, on ? '#FFE9B8' : '#FFFFFF');
            const iw = c.icon.indexOf('bottle/body_') === 0 ? 11 : 26;   // 瓶身贴图瘦高比 0.4，同比例缩小
            const icNode = nd(sp.node, 'ic', iw, 26, -88, 0);
            setFrame(icNode.addComponent(Sprite), c.icon, iw, 26);
            if (c.tier !== undefined) {
                // ★ 瓶子项名字用美术字 wzi（自带阶色底）：按**高度**定标（扁字图不能方形 contain）
                //   ⚠️ packable 小图的 sf.width/height 是动态图集尺寸（2048×2048 方形）——
                //   直接用会把 nw2 算成 18 → 美术字压成 18×18 的小方块糊成一团
                //   （第三十五轮就埋了，坑同 UpgradeRows 的 nameImg：必须读 originalSize）。
                const nm = nd(sp.node, 'nameImg', 60, 20, 0, 0);
                const nmSp = setFrame(nm.addComponent(Sprite), 'bottle/name_' + c.tier, 60, 20);
                const osz = nmSp.spriteFrame ? nmSp.spriteFrame.originalSize : null;
                const ow = osz ? osz.width : 60, oh = osz ? osz.height : 20;
                const nk = oh > 0 ? 20 / oh : 1;
                const nw2 = Math.round(ow * nk);
                (nm.getComponent(UITransform) as any).setContentSize(nw2, 20);
                nm.setPosition(-64 + nw2 / 2, 0, 0);
            } else {
                // 文字紧贴图标右侧（锚点靠左），不要居中 —— 和参考图的下拉项一致
                const lb = label(sp.node, this.catName(c), -64, 1, 150, IH, {
                    size: 19, color: '#7A4210', hAlign: 'left', anchorX: 0, overflow: 'shrink',
                });
                void lb;
            }
            // ★ 用户口径（第十五轮）：没被玩家点过的技能模块在行右侧挂「新」标签，点过即消
            //   底板 = buco06 红圆徽章整图（33×33 原尺寸，第四十四轮换皮）
            if (!G.itemSeen(c.id)) {
                const tg = nd(sp.node, 'newTag', 33, 33, (MW - 10) / 2 - 13, 0);
                setFrame(tg.addComponent(Sprite), 'skin/main/new_badge', 33, 33);
                label(tg, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
            }
            sp.node.on(Node.EventType.TOUCH_END, () => {
                G.markItemSeen(c.id);
                this.treeCat = c.id;
                this.menuOpen = false;
                this.ddMenu.active = false;
                this.rebuild();
            });
        }
        this.ddMenu.active = true;
    }

    /* ================= 对外 API ================= */
    showTab(tb: Tab) {
        if (this.tab === tb && this.built) { return; }
        // ★ 原版口径：商店的瓶盖机器到手，技能树才打得开
        if (tb === 'tree' && !G.hasMachine) {
            Toast.I?.show(t('need_machine', G.lang), '#FFD98A');
            if (this.tab !== 'shop') { this.showTab('shop'); }
            return;
        }
        this.tab = tb;
        this.menuOpen = false;
        if (this.ddMenu && this.ddMenu.isValid) { this.ddMenu.active = false; }
        // ★ 下拉框只在技能树页签显示（用户口径）
        if (this.ddNode && this.ddNode.isValid) { this.ddNode.active = tb === 'tree'; }
        this.rebuild();
    }

    /**
     * 供购买引导跳转：0 瓶子模块（→ 含「解锁下一阶」的那棵树）/ 1 履带 / 2 手部 / 3 特殊技能。
     * ★ 科技线跳转前要确认模块已解锁，否则提示去瓶子树解锁对应模块。
     */
    showTreeCategory(page: number) {
        if (!G.hasMachine) {
            Toast.I?.show(t('need_machine', G.lang), '#FFD98A');
            this.showTab('shop');
            return;
        }
        if (page === 0) {
            this.showTab('tree');
            // 跳到「当前最高已研发阶」的树 —— 解锁下一阶瓶的入口就在它的末尾
            const nt = G.nextUnlockTier();
            this.treeCat = 'bt' + (nt > 1 ? nt - 1 : 0);
            G.markItemSeen(this.treeCat);          // 玩家已经跳进这个模块了
            this.rebuild();
            return;
        }
        const id = page === 1 ? 'belt' : page === 2 ? 'hand' : 'abil';
        const def = TREE_TECHS.find((c) => c.id === id);
        if (def && def.req && G.skLv(def.req) <= 0) {
            Toast.I?.show(t('module_locked', G.lang), '#FFD98A');
            this.showTab('tree');
            this.treeCat = 'bt0';
            this.rebuild();
            return;
        }
        this.showTab('tree');
        this.treeCat = id;
        G.markItemSeen(id);
        this.rebuild();
    }

    /** 瓶子页签（购买引导的「收起商城」用） */
    showShopCategory(_i: number) {
        this.showTab('shop');
    }

    get currentTab(): Tab { return this.tab; }

    /* ================= 列表构建 ================= */
    private rebuild() {
        if (!this.built || !this.content || !this.content.isValid) { return; }
        const cat = this.catDef();
        // ★ 用户口径（第十七轮）：列表滚动位置由玩家掌控 —— 同页签同模块的重建（买瓶后指纹变化、
        //    定时 refresh 重建等）要保留当前滚动位置；只有换页签/换模块才回到顶部。
        const sameCat = this.lastCatKey !== '' && this.lastCatKey === this.tab + ':' + cat.id;
        const savedY = sameCat ? this.content.position.y : (this.VH / 2);

        // 惯性还在滚的话先停掉，避免 ScrollView 用旧速度把 content 拽走
        if (this.scrollSV && this.scrollSV.isValid) { this.scrollSV.stopAutoScroll(); }

        destroyChildren(this.content);
        this.rows = [];

        // 下拉框文字只在技能树页签有意义（其它页签下拉框整个隐藏）
        if (this.ddLb && this.ddLb.isValid) { this.ddLb.string = this.tab === 'tree' ? this.catName(cat) : ''; }
        if (this.ddNode && this.ddNode.isValid) { this.ddNode.active = this.tab === 'tree'; }
        this.refreshTabs();

        const specs = this.specs(cat);
        // ★ 两列网格（用户要求「一行 2 个」）：
        //    content 锚点在顶部 → 第一行**顶边**对齐内容顶：行中心 = -CELL_H/2 - r*(CELL_H+GAP_Y)
        //    （写成 0 会让整行上飘出遮罩，顶部被裁掉一半）
        const nrows = Math.ceil(specs.length / COLS);
        for (let i = 0; i < specs.length; i++) {
            const col = i % COLS;
            const r = (i / COLS) | 0;
            const x = col === 0 ? -(CELL_W + GAP_X) / 2 : (CELL_W + GAP_X) / 2;
            const y = -CELL_H / 2 - r * (CELL_H + GAP_Y);
            this.rows.push(makeCell(this.content, x, y, specs[i], () => this.refresh()));
        }
        const h = nrows * (CELL_H + GAP_Y) - GAP_Y + 8;
        (this.content.getComponent(UITransform) as any).setContentSize(COLS * CELL_W + GAP_X, h);
        // 展开把手：内容超过一屏（4 格）或已展开时显示 —— ★ 展开态必须保持可见，否则收不回去
        if (this.expandBtn && this.expandBtn.isValid) {
            const need = this.expanded || h > SCROLL_H + 2;
            if (this.expandBtn.active !== need) { this.expandBtn.active = need; }
        }
        // content 锚点在顶部 → 位置写「视口半高」（见 UIKit.scrollView 注释）。
        // 同模块重建时夹回新内容高度的合法范围（列表变短了就停在末尾），否则恢复顶部。
        const maxY = this.VH / 2;
        const minY = maxY - Math.max(0, h - this.VH);
        const y = Math.min(maxY, Math.max(minY, savedY));
        this.content.setPosition(0, y, 0);
        this.sig = this.fingerprint(cat, specs.length);
        this.lastCatKey = this.tab + ':' + cat.id;
        this.refresh();
    }

    private fingerprint(cat: CatDef, n: number): string {
        return [this.tab, cat.id, n, G.lang, G.statUnlockedCount, G.milestone,
            G.data.bottles.join(','), G.data.machine, G.data.hands, G.maxHands,
            // ⚠️ 词条等级 / 科技节点等级都会改变列表**结构**（模块解锁后下拉框多一条、
            //    收入 0→1 时说明行消失、「解锁下一阶」入口出现）→ 必须进指纹，
            //    否则长度恰好相同时不会重建，格子内容会错位。
            (G.data.tierStats || []).map((a) => (a || []).join(',')).join(';'),
            JSON.stringify(G.data.skills)].join('|');
    }

    /**
     * 当前页签的全部行（现算，不缓存）。
     * ★ 口径对齐原版解析（model.json）：
     *   商店 = 每阶买瓶按钮 + 瓶盖机器 + 助手之手（全平铺，无下拉）；
     *   升级 = 每阶「收入 / 悬停翻转」快捷入口 + 光标圈大小 + 瓶盖机收入 + 各阶助手许可；
     *   技能树 = 下拉框选「瓶子模块 / 科技线」，**只画能解锁的项**（locked/maxed 不出现）。
     */
    private specs(cat: CatDef): RowSpec[] {
        let out: RowSpec[];
        if (this.tab === 'shop') {
            out = this.shopRows();
        } else if (this.tab === 'up') {
            out = this.upgradeRows();
        } else {
            out = this.rowsForCat(cat);
        }
        if (out.length === 0) {
            out = [this.placeholderRow(t('all_done', G.lang))];
        }
        return out;
    }

    /** 技能树 · 某个类目（瓶子模块 / 四条科技线）当前该画的行 */
    private rowsForCat(cat: CatDef): RowSpec[] {
        if (cat.tier !== undefined) { return this.bottleTreeRows(cat.tier); }
        if (cat.id === 'belt') { return this.skillRows(PLAYER_GRAPH.filter((n) => TREE_BELT_NODES.indexOf(n.id) >= 0)); }
        if (cat.id === 'idle') { return this.skillRows(PLAYER_GRAPH.filter((n) => TREE_IDLE_NODES.indexOf(n.id) >= 0)); }
        if (cat.id === 'hand') { return this.skillRows(HELPER_GRAPH.filter((n) => HELPER_CAP_NODES.indexOf(n.id) < 0)); }
        return this.skillRows(ABILITY_GRAPH);
    }

    /** 不可点的灰行（空列表占位 / 说明行）—— 不带 id，所以永远不挂「新」 */
    private placeholderRow(text: string, icon = 'ui/icon/icon_medal'): RowSpec {
        return {
            icon,
            name: text,
            sub: '',
            label: '—',
            tone: 'lock',
            onBuy: () => { /* 占位说明，不可点 */ },
        };
    }

    /* ---- 技能树 · 某一阶瓶子（原版 BottleSkillTreeUpgradeUI，一棵完整的瓶子天赋树） ----
     *
     * 节点顺序照原版 UpgradeType（GameConfig.BOTTLE_TREE_ORDER）+ 三条特殊节点：
     *   ① 收入（树的根）→ ② 解锁下一阶瓶（★ 不受收入门控，始终可见）→ ③ 其余数值词条 → ④ 两条模块解锁
     *
     * ★ 出现规则（用户口径 + 原版渐进设计）：
     *   · 「解锁下一阶瓶」只在**当前最高已研发阶**的树里出现，且不受收入门控 ——
     *     原来藏在「收入≥1 级」后面，玩家解锁 T2 后看不到 T3 入口，像「只能解锁两种瓶子」；
     *   · 其余词条沿用里程碑门控（G.statUnlocked），满级不画；
     *   · 两条模块解锁仍要收入 ≥ 1 级才露出来。
     */
    private bottleTreeRows(tier: number): RowSpec[] {
        const out: RowSpec[] = [];
        const incomeDef = BOTTLE_STATS.find((s) => s.id === 'income')!;

        // ① 收入 —— 树的根（该阶唯一一开始就开放的节点）
        if (!G.statMax(tier, 'income')) { out.push(this.statRow(tier, incomeDef, 'tr:b' + tier + ':income')); }

        // ②★ 解锁下一阶瓶 —— 只在最高已研发阶出现。
        //   ★ 用户反馈「只能解锁两种瓶子」：原来它排在收入门控之后 —— 该阶收入没点过 1 级就提前
        //   return，下一阶的解锁入口根本不显示，看起来像链断了。现在提到门控之前，永远可见。
        const nt = G.nextUnlockTier();
        if (nt > 0 && tier === nt - 1) {
            const id = UNLOCK_SKILL[nt];
            const def = SKILL_BY_ID[id];
            if (def) { out.push(this.unlockTierRow(id, nt, 'tr:u' + nt)); }
        }

        // 收入 0 级 → 只给这一条 + 一条说明（头一次打开技能树就是这个样子）
        if (G.statLv(tier, 'income') <= 0) {
            if (!G.statMax(tier, 'income')) {
                out.push(this.placeholderRow(t('tree_hint_income', G.lang), incomeDef.icon));
            }
            return out;
        }

        // ③ 该阶数值词条（原版顺序；里程碑没解锁的不画、满级不画）
        for (const id of BOTTLE_TREE_ORDER) {
            if (id === 'income') { continue; }                     // 根已在上面画过
            const d = BOTTLE_STATS.find((s) => s.id === id);
            if (!d || !G.statUnlocked(d.id) || G.statMax(tier, d.id)) { continue; }
            out.push(this.statRow(tier, d, 'tr:b' + tier + ':' + d.id));
        }

        // ④ 模块解锁：传送带 → 履带科技线（原版挂在这棵树上）
        //   ★ 用户口径（第十九轮）：「解锁光圈」已从技能模块移除，改到商店购买（见 cursorRow）。
        if (G.skLv('p_stability') <= 0) { out.push(this.moduleRow('p_stability', 'unlock_beltmod', 'unlock_beltmod_d', 'tr:m:p_stability')); }

        return out;
    }

    /** 研发 / 解锁一整阶瓶子（瓶盖货币） */
    private unlockTierRow(id: string, tier: number, seenId: string): RowSpec {
        const def = SKILL_BY_ID[id];
        const cost = G.skCost(id);
        const afford = G.data.caps >= cost;
        return {
            id: seenId,
            icon: def.icon,
            // ★ 第三十八轮：解锁阶行也有 ztk 底框 + 等级进度（解锁节点 max=1 → 买下即满金）
            lv: G.skLv(id),
            lvMax: def ? def.max : 0,
            name: t(def.name, G.lang).replace(/\n/g, ' '),
            sub: skillSub(def),
            label: fmt(cost),
            cur: 'cap',
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 瓶盖不足 → 右上角广告图标（直接拉广告给货）
            onBuy: (after) => {
                if (G.skMax(id)) { Toast.I?.show(t('maxed', G.lang), '#FFD98A'); return; }
                if (!G.upgradeSkill(id)) {
                    // 瓶盖不足 → 直接拉广告给货（无二级弹窗）
                    capsShortAd(cost, () => {
                        if (G.upgradeSkill(id)) {
                            Toast.I?.show(
                                t('ms_unlock_stat', G.lang) + ' ' + (G.lang === 'zh' ? TIERS[tier].zh : TIERS[tier].en),
                                '#8CE7A2');
                            after();
                        }
                    });
                    return;
                }
                Toast.I?.show(
                    t('ms_unlock_stat', G.lang) + ' ' + (G.lang === 'zh' ? TIERS[tier].zh : TIERS[tier].en),
                    '#8CE7A2');
                after();
            },
        };
    }

    /** 模块解锁节点（解锁光圈 / 解锁传送带模块）—— 解锁后对应科技线才会出现在下拉框 */
    private moduleRow(id: string, nameKey: string, descKey: string, seenId: string): RowSpec {
        const def = SKILL_BY_ID[id];
        const cost = G.skCost(id);
        const afford = G.data.caps >= cost;
        return {
            id: seenId,
            icon: def ? def.icon : 'stat/unlock',
            // ★ 第三十八轮：模块解锁行也有 ztk 底框（max=1 → 买下即满金）
            lv: G.skLv(id),
            lvMax: def ? def.max : 0,
            name: t(nameKey, G.lang),
            sub: t(descKey, G.lang),
            label: fmt(cost),
            cur: 'cap',
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 瓶盖不足 → 右上角广告图标（直接拉广告给货）
            onBuy: (after) => {
                if (G.skLv(id) > 0) { return; }
                if (!G.upgradeSkill(id)) {
                    capsShortAd(cost, () => {
                        if (G.upgradeSkill(id)) {
                            Toast.I?.show(t(nameKey, G.lang) + (G.lang === 'zh' ? ' 已解锁' : ' unlocked'), '#8CE7A2');
                            after();
                        }
                    });
                    return;
                }
                Toast.I?.show(t(nameKey, G.lang) + (G.lang === 'zh' ? ' 已解锁' : ' unlocked'), '#8CE7A2');
                after();
            },
        };
    }

    /* ---- 商城（每阶买瓶按钮 + 瓶盖机器 + 助手之手；全平铺、无下拉） ----
     * ★ 用户口径（第十八轮）：**未开放研发的项不出现** ——
     *   助手之手还没在技能树里研发（h_unlock）之前，整行藏起来（原来是显示一枚「去研发」灰按钮）；
     *   等研发出来它才出现在商店里，并挂「新」角标。 */
    private shopRows(): RowSpec[] {
        const out: RowSpec[] = this.shopBottleRows();
        const m = this.machineRow();
        if (m) { out.push(m); }
        out.push(this.cursorRow());
        const h = this.helperRow();
        if (h) { out.push(h); }
        return out;
    }

    /* ---- 商城 · 瓶子 ---- */
    private shopBottleRows(): RowSpec[] {
        const out: RowSpec[] = [];
        for (let i = 0; i < 7; i++) {
            if (i > 0 && !G.tierResearched(i)) { continue; }
            const tier = i;
            const d = TIERS[tier];
            const cap = G.tierCap(tier);
            out.push({
                id: 'sh:b' + tier,
                icon: 'bottle/body_' + d.art,
                // ★ 第三十五轮：瓶子行统一「ztk 底框 + 名字美术字」——
                //   badge 启用左侧底框（ztk_1 + ztk_2 进度填充），nameImg 用 wzi 名字图
                badge: 'bottle/body_' + d.art,
                nameImg: 'bottle/name_' + d.art,
                lv: G.data.bottles[tier],
                lvMax: cap,
                name: G.lang === 'zh' ? d.zh : d.en,
                // ★ 第十九轮：说明压短（原来「拥有 3/30 · +$1/次 · ±18°」13 个字在 172px 里会被 SHRINK 压小）
                // ★ 第十七轮：判定改纯概率 → 末尾改成「成功 50%」（= 50% + 精通 ×5%）
                sub: t('owned_short', G.lang).replace('{n}', String(G.data.bottles[tier])).replace('{m}', String(cap))
                    + ' · $' + fmt(G.bottleIncome(tier)) + (G.lang === 'zh' ? '/次' : '/flip')
                    + ' · ' + successText(tier),
                label: '',
                tone: 'on',
                buySfx: true,   // ★ 商店物品：买成补一声 buy（升级页/技能树不播）
                onBuy: () => { /* 由下面覆盖 */ },
            });
            const row = out[out.length - 1];
            // 三态文案在按钮上：满仓 / 购买 / 去研发
            const maxed = G.data.bottles[tier] >= cap;
            const cost = G.bottleCost(tier);
            row.tone = maxed ? 'max' : (G.data.money >= cost ? 'on' : 'off');
            // ★ 第二十轮：价格只留数字，货币符号交给按钮左侧的金币图标（满仓则没有价格行）
            row.label = maxed ? t('max', G.lang) : fmt(cost);
            row.cur = maxed ? undefined : 'coin';
            // 金币不足但有广告出路 → 价格照常显示，右上角再亮 ksp 广告图标
            row.ad = !maxed && G.data.money < cost;
            // ★ 第三十九轮：`from` 是**被点的整个格子**（整格即按钮，见 UpgradeRows.makeCell）
            row.onBuy = (after, from) => {
                if (G.data.bottles[tier] >= G.tierCap(tier)) {
                    Toast.I?.show(t('bought_out', G.lang), '#FFD98A');
                    return;
                }
                // ★ 先登记飞入、再扣钱：buyBottle 内部同步 notify → BottleField.sync 立刻建出
                //   这只新瓶子，飞行动画只有在那一次 sync 里接上才对得上（失败则撤销登记）。
                BottleField.I?.queueFlyIn(tier, from ?? null);
                if (!G.buyBottle(tier)) {
                    BottleField.I?.cancelFlyIn();
                    // 金币不足 → 广告出路：看广告补足后自动重试（补足不显示差额）
                    moneyShortAd(G.bottleCost(tier), () => {
                        BottleField.I?.queueFlyIn(tier, null);
                        if (G.buyBottle(tier)) { after(); } else { BottleField.I?.cancelFlyIn(); }
                    });
                    return;
                }
                after();
            };
        }
        return out;
    }

    /* ---- 商城 · 履带设施（瓶盖机器） ---- */
    private machineRow(): RowSpec | null {
        const on = G.hasMachine;
        return {
            id: 'sh:machine',
            icon: 'env/machine',
            buySfx: true,   // ★ 商店物品：装成补一声 buy
            name: t('cap_machine', G.lang),
            sub: on
                ? (G.lang === 'zh' ? '已安装 · 自动回收' : 'Installed · auto collect')
                : (G.lang === 'zh' ? '装好后才开始产瓶盖' : 'Caps drop once installed'),
            label: on ? t('max', G.lang) : String(MACHINE_PRICE).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
            cur: on ? undefined : 'coin',
            tone: on ? 'max' : (G.data.money >= MACHINE_PRICE ? 'on' : 'off'),
            ad: !on && G.data.money < MACHINE_PRICE,
            onBuy: (after) => {
                // ★ 第二十轮：已拥有的项点下去也要有声音/文字反馈（以前是静默 return，
                //   玩家以为「点了没反应」）
                if (G.hasMachine) { Toast.I?.show(t('machine_installed', G.lang), '#FFD98A'); return; }
                if (!G.buyMachine()) {
                    moneyShortAd(MACHINE_PRICE, () => {
                        if (G.buyMachine()) {
                            Toast.I?.show(t('machine_installed', G.lang), '#8CE7A2');
                            after();
                        }
                    });
                    return;
                }
                Toast.I?.show(t('machine_installed', G.lang), '#8CE7A2');
                after();
            },
        };
    }

    /* ---- 商城 · 抓取光圈（★ 用户口径第十九轮：从技能树挪到商店购买） ----
     * 买下后手指带光圈跟随；点击/触发的判定逻辑完全不变（BottleField 里那套），
     * 唯一变化只是「解锁入口」从技能树变成了商店设施 —— 和瓶盖机器同款流程。 */
    private cursorRow(): RowSpec {
        const on = G.hasCursor;
        return {
            id: 'sh:cursor',
            icon: 'env/cursor',
            buySfx: true,   // ★ 商店物品：买成补一声 buy
            name: t('shop_cursor', G.lang),
            sub: on ? t('shop_cursor_on', G.lang) : t('shop_cursor_d', G.lang),
            label: on ? t('max', G.lang) : fmt(CURSOR.buyPrice),
            cur: on ? undefined : 'coin',
            tone: on ? 'max' : (G.data.money >= CURSOR.buyPrice ? 'on' : 'off'),
            ad: !on && G.data.money < CURSOR.buyPrice,
            onBuy: (after) => {
                if (G.hasCursor) { Toast.I?.show(t('cursor_bought', G.lang), '#FFD98A'); return; }
                if (!G.buyCursor()) {
                    moneyShortAd(CURSOR.buyPrice, () => {
                        if (G.buyCursor()) {
                            Toast.I?.show(t('cursor_bought', G.lang), '#8CE7A2');
                            after();
                        }
                    });
                    return;
                }
                Toast.I?.show(t('cursor_bought', G.lang), '#8CE7A2');
                after();
            },
        };
    }

    /* ---- 商城 · 助手之手 ----
     * ★ 未研发（h_unlock 0 级）→ **返回 null，整行不画**（用户口径：未开放研发的选项不出现）；
     *   研发出来以后它才出现在商店里并挂「新」角标。 */
    private helperRow(): RowSpec | null {
        if (!G.hasHelper) { return null; }
        const maxed = G.data.hands >= G.maxHands;
        const cost = G.handCost();
        return {
            id: 'sh:helper',
            icon: 'env/hand',
            buySfx: true,   // ★ 商店物品：雇到补一声 buy
            name: t('helper_hand', G.lang),
            sub: G.lang === 'zh'
                ? `自动翻瓶 · ${G.data.hands}/${G.maxHands}`
                : `Auto flip · ${G.data.hands}/${G.maxHands}`,
            label: maxed ? t('max', G.lang) : fmt(cost),
            cur: maxed ? undefined : 'coin',
            tone: maxed ? 'max' : (G.data.money >= cost ? 'on' : 'off'),
            ad: !maxed && G.data.money < cost,
            onBuy: (after) => {
                if (G.data.hands >= G.maxHands) { Toast.I?.show(t('maxed', G.lang), '#FFD98A'); return; }
                if (!G.buyHand()) {
                    moneyShortAd(G.handCost(), () => { if (G.buyHand()) { after(); } });
                    return;
                }
                after();
            },
        };
    }

    /* ---- 升级页（原版 FromPageUpgradeMenuUI 口径，全平铺、无下拉） ----
     *
     * 顺序：每阶「收入 / 悬停翻转」两条快捷入口（原版升级页 · 瓶子区就只有这两类）
     *       → 玩家数值（光标圈大小 / 瓶盖机收入，随天赋/设施解锁出现）
     *       → 助手各阶翻瓶许可（雇助手后出现，对应瓶子也要已解锁）。
     * ⚠️ 瓶子天赋树的**其余 9 条词条只在「技能树 · 瓶子模块」里**升级（原版就是这么分的）。
     * ★ 用户口径（第十八轮）：每条都带门控，**没开放的一条也不画**（等可研发了再出现并标「新」）。
     */
    private upgradeRows(): RowSpec[] {
        const out: RowSpec[] = [];

        // ① 每阶「收入 / 悬停翻转」（原版 UpgradeType = Income / FlipMode）
        for (let tier = 0; tier < 7; tier++) {
            if (!G.tierResearched(tier)) { continue; }
            for (const id of ['income', 'hover']) {
                const d = BOTTLE_STATS.find((s) => s.id === id);
                if (!d || !G.statUnlocked(d.id) || G.statMax(tier, d.id)) { continue; }
                out.push(this.statRow(tier, d, 'up:s' + tier + ':' + id));
            }
        }

        // ② 玩家数值升级：光标圈大小（解锁光圈后）/ 瓶盖机收入（买机器后）
        if (G.skLv('p_cursor') > 0 && !G.skMax('p_cursorsize')) { out.push(this.skillNodeRow('p_cursorsize', 'up:k:p_cursorsize')); }
        if (G.hasMachine && !G.skMax('p_machineinc')) { out.push(this.skillNodeRow('p_machineinc', 'up:k:p_machineinc')); }

        // ③ 助手各阶翻瓶许可（原版 HelperUpgradeMenuUI：Bronze..Diamond Hand）
        if (G.hasHelper) {
            for (let tier = 1; tier < 7; tier++) {
                const id = HELPER_CAP_NODES[tier - 1];
                if (!G.tierResearched(tier) || G.skMax(id)) { continue; }
                out.push(this.skillNodeRow(id, 'up:k:' + id));
            }
        }
        return out;
    }

    /**
     * 单瓶词条行（原版升级页 · 瓶子区：收入可重复买、悬停翻转一次性）
     * ★ 第二十一轮用户口径：左侧大图标 = **稀有度色底板 + 对应瓶身**，
     *   原来的词条图标（收益 $ / 悬停手势 …）缩成角标跨在底板右下角（对照用户参考图）；
     *   名字只留词条名（「收益」），阶信息由瓶身颜色直接表达。
     */
    private statRow(tier: number, d: BottleStatDef, seenId: string): RowSpec {
        const cost = G.statCost(tier, d.id);
        const caps = G.statCurrency(d.id) === 'caps';
        const afford = caps ? G.data.caps >= cost : G.data.money >= cost;
        return {
            id: seenId,
            icon: 'bottle/body_' + TIERS[tier].art,
            badge: d.icon,
            badgeBg: TIERS[tier].color,
            // ★ 第三十五轮：底框进度按词条等级填充（ztk_2 FILLED），点满显示完全
            lv: G.statLv(tier, d.id),
            lvMax: G.statMaxLevel(tier, d.id),
            name: t(d.name, G.lang),
            sub: statSub(d, tier),
            label: fmt(cost),
            cur: caps ? 'cap' : 'coin',
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 金币/瓶盖不足都走右上角广告图标（直接拉广告给货）
            onBuy: (after) => {
                if (G.statMax(tier, d.id)) { Toast.I?.show(t('maxed', G.lang), '#FFD98A'); return; }
                if (!G.upgradeStat(tier, d.id)) {
                    if (caps) {
                        // 瓶盖不足 → 直接拉广告给货（无二级弹窗）
                        capsShortAd(G.statCost(tier, d.id), () => { if (G.upgradeStat(tier, d.id)) { after(); } });
                    }
                    else {
                        // 金币不足 → 广告出路（不显示差额，看完自动补足并重试）
                        moneyShortAd(G.statCost(tier, d.id), () => { if (G.upgradeStat(tier, d.id)) { after(); } });
                    }
                    return;
                }
                after();
            },
        };
    }

    /** 单个科技节点行（升级页里的光标圈大小 / 瓶盖机收入 / 助手许可共用） */
    private skillNodeRow(id: string, seenId: string): RowSpec {
        const def = SKILL_BY_ID[id];
        const cost = G.skCost(id);
        const afford = G.data.caps >= cost;
        return {
            id: seenId,
            icon: def.icon,
            // ★ 第三十八轮：功能板块行也有 ztk 底框 + 等级进度（与瓶子行同一套口径）
            lv: G.skLv(id),
            lvMax: def ? def.max : 0,
            name: t(def.name, G.lang).replace(/\n/g, ' '),
            sub: skillSub(def),
            label: fmt(cost),
            cur: 'cap',
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 瓶盖不足 → 右上角广告图标（直接拉广告给货）
            onBuy: (after) => {
                if (G.skMax(id)) { Toast.I?.show(t('maxed', G.lang), '#FFD98A'); return; }
                if (!G.upgradeSkill(id)) {
                    // 瓶盖不足 → 直接拉广告给货（无二级弹窗）
                    capsShortAd(G.skCost(id), () => { if (G.upgradeSkill(id)) { after(); } });
                    return;
                }
                after();
            },
        };
    }

    /* ---- 技能树 · 科技线（履带 / 挂机 / 手部 / 特殊技能） ----
     * ★ 与原版技能树梳理结果（model.json）口径一致：列表里**只画能解锁的节点** ——
     *   前置未解锁的（灰锁）与已满级的不出现；买不起的保留（能解，只是钱不够）。 */
    private skillRows(graph: SkillNodeDef[]): RowSpec[] {
        // 按「行从上到下、列从左到右」排成列表（原节点图的拓扑顺序）
        const list = graph.slice().sort((a, b) => (b.row - a.row) || (a.col - b.col));
        // 前置只看**同一栏内**的节点：拆栏之后跨栏依赖（如 stability←cursor）不算锁，
        // 否则「履带升级」栏会永远显示「需先解锁前置」却找不到可以去解锁的地方。
        const inList: Record<string, boolean> = {};
        for (const n of list) { inList[n.id] = true; }
        const out: RowSpec[] = [];
        for (const n of list) {
            const def = SKILL_BY_ID[n.id];
            if (!def) { continue; }
            if (G.skMax(n.id)) { continue; }                       // 满级 → 不画
            const parentInList = !!n.parent && !!inList[n.parent];
            const locked = parentInList && G.skLv(n.parent!) <= 0;
            if (locked) { continue; }                              // 前置没解 → 不画
            const cost = G.skCost(n.id);
            const afford = G.data.caps >= cost;
            out.push({
                id: 'tr:k:' + n.id,
                icon: def.icon,
                // ★ 第三十八轮：科技节点行也有 ztk 底框 + 等级进度
                lv: G.skLv(n.id),
                lvMax: def.max,
                name: t(def.name, G.lang).replace(/\n/g, ' '),
                sub: skillSub(def),
                label: fmt(cost),
                cur: 'cap',
                tone: afford ? 'on' : 'off',
                ad: !afford,   // 瓶盖不足 → 右上角广告图标（直接拉广告给货）
                onBuy: (after) => {
                    if (G.skMax(n.id)) { Toast.I?.show(t('maxed', G.lang), '#8CE7A2'); return; }
                if (!G.upgradeSkill(n.id)) {
                    // 瓶盖不足 → 直接拉广告给货（无二级弹窗）
                    capsShortAd(G.skCost(n.id), () => { if (G.upgradeSkill(n.id)) { after(); } });
                    return;
                }
                after();
            },
            });
        }
        return out;
    }

    /* ================= 刷新 ================= */
    /** 每 0.25s 刷一次文本（只改字符串，节点不动） */
    update(dt: number) {
        this.acc += dt;
        if (this.acc < 0.25) { return; }
        this.acc = 0;
        this.refresh();
    }

    refresh() {
        if (!this.built || !this.content || !this.content.isValid) { return; }
        const cat = this.catDef();
        const specs = this.specs(cat);
        // 结构变了（解锁了新阶 / 新词条 / 换了语言）→ 整块重建
        if (specs.length !== this.rows.length || this.fingerprint(cat, specs.length) !== this.sig) {
            this.rebuild();
            return;
        }
        for (let i = 0; i < specs.length; i++) { applyRow(this.rows[i], specs[i]); }
        this.refreshHead();
    }

    private refreshHead() {
        // ★ 第四十三轮：提示带/里程碑条的文本先比对再写（面板每 0.25s 刷一次，
        //   无条件写 string 会白触发系统字体重绘 + 纹理上传）
        if (this.hintLb && this.hintLb.isValid) {
            const hint = t('next_goal', G.lang) + '：' + nextGoalText();
            if (this.hintLb.string !== hint) { this.hintLb.string = hint; }
        }
        if (this.msLb && this.msLb.isValid) {
            const next = G.msNext;
            const ms = t('ms_chip', G.lang).replace('{n}', String(G.milestone))
                + ' · ' + (next ? (fmt(G.msProgress) + '/' + fmt(next.need)) : t('ms_max', G.lang));
            if (this.msLb.string !== ms) { this.msLb.string = ms; }
        }
        this.refreshNewTag();
        this.refreshTabTags();
    }

    /**
     * 某页签下「当前可见、但玩家还没点过」的项 id。
     * ★ 判据就是「可见」——每个页签的内容生成函数本身已经把所有门控（未研发 / 前置未解 / 满级）
     *   过滤干净了，所以这里不用再判一次解锁。
     */
    private unseenIds(tb: Tab): string[] {
        const out: string[] = [];
        const add = (r: RowSpec | null) => { if (r && r.id && !G.itemSeen(r.id)) { out.push(r.id); } };
        if (tb === 'shop') {
            for (const r of this.shopBottleRows()) { add(r); }
            add(this.machineRow());
            add(this.cursorRow());
            add(this.helperRow());
        } else if (tb === 'up') {
            for (const r of this.upgradeRows()) { add(r); }
        } else {
            // 技能树：① 下拉框里的模块 ② 每个模块内部当前能买/能研发的节点行
            if (!G.hasMachine) { return out; }
            for (const c of this.cats()) {
                if (!G.itemSeen(c.id)) { out.push(c.id); }
                for (const r of this.rowsForCat(c)) { add(r); }
            }
        }
        return out;
    }

    /** 底栏三个按钮的「新」角标（该页签里还有没点过的新项就亮） */
    private refreshTabTags() {
        for (const id of ['shop', 'up', 'tree'] as Tab[]) {
            const n = this.tabNew[id];
            if (n && n.isValid) { n.active = this.unseenIds(id).length > 0; }
        }
    }

    private refreshTabs() {
        const keys: Record<Tab, string> = { shop: 'nav_shop', up: 'nav_upgrade', tree: 'nav_skill' };
        for (const id of ['shop', 'up', 'tree'] as Tab[]) {
            const ui = this.tabUis[id];
            if (!ui || !ui.node.isValid) { continue; }
            // 技能树没买瓶盖机器前是「暗着」的（点了会提示，见 showTab）
            const locked = id === 'tree' && !G.hasMachine;
            this.applyTabPlate(id, locked);
            ui.lb.string = t(keys[id], G.lang);
        }
    }

    /**
     * ★ 页签底板/图标换皮（buco 系列，第三十六轮）：
     *   选中 = buco01 金色圆角条、未选中 = buco02 奶油圆角条（整图 SIMPLE，白 tint）；
     *   图标 = 商店 buco05 / 升级 buco03 / 技能树 buco04，按 originalSize contain 到 42 高；
     *   旧的九宫格 gloss/stroke 层隐藏（buco 图自带高光描边）；场景版/运行时兜底统一走这里。
     */
    private applyTabPlate(id: Tab, locked = false) {
        const ui = this.tabUis[id];
        if (!ui || !ui.node || !ui.node.isValid) { return; }
        const cfg = TAB_PLATE[id];
        const n = ui.node;
        const on = id === this.tab;
        const sp = n.getComponent(Sprite) || n.addComponent(Sprite);
        sp.type = Sprite.Type.SIMPLE;
        setFrame(sp, on ? cfg.on : cfg.off, undefined, undefined, !on && locked ? '#C9B79B' : '#FFFFFF');
        for (const ch of n.children) {
            if (ch.name === 'gloss' || ch.name === 'stroke' || ch.name === 'inner') { ch.active = false; }
        }
        const ic = n.getChildByName('icon');
        if (ic) {
            const isp = ic.getComponent(Sprite) || ic.addComponent(Sprite);
            setFrame(isp, cfg.icon, undefined, undefined, '#FFFFFF');
            const sf = isp.spriteFrame;
            if (sf) {
                const os = sf.originalSize;
                const k = Math.min(1, 42 / os.height, 42 / os.width);
                (ic.getComponent(UITransform)!).setContentSize(Math.round(os.width * k), Math.round(os.height * k));
            }
        }
    }

    /** build 时一次性换皮（refreshTabs 里切页签时再按选中态重刷） */
    private reskinTabs() {
        for (const id of ['shop', 'up', 'tree'] as Tab[]) {
            this.applyTabPlate(id, id === 'tree' && !G.hasMachine);
        }
    }

    /** 语言切换：整块重建（文案全变了） */
    private onLang() {
        if (G.lang === this.lastLang) { return; }
        this.lastLang = G.lang;
        this.rebuild();
    }
}

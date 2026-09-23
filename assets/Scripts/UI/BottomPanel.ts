import { _decorator, Component, Graphics, Label, Node, ScrollView, Sprite, UITransform } from 'cc';
import {
    ABILITY_GRAPH, BOTTLE_STATS, BOTTLE_TREE_ORDER, BottleStatDef, HELPER_GRAPH,
    LAYOUT, PLAYER_GRAPH, SkillNodeDef, TIERS,
} from '../Core/GameConfig';
import { G, SKILL_BY_ID, UNLOCK_SKILL } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt, hex } from '../Core/Util';
import { label, nd, setFrame, sliced, destroyChildren, roundedPanel, scrollView } from './UIKit';
import { WOOD, wobble, woodButton, woodPlate, woodPlateRefill } from './Theme';
import { applyRow, makeCell, COLS, CELL_W, CELL_H, GAP_X, GAP_Y, RowSpec, RowUI, skillDesc, statDesc, toleranceText } from './UpgradeRows';
import { capsShortAd, MACHINE_PRICE, moneyShortAd, nextGoalText } from './Guidance';
import { Toast } from './Toast';
import { BottleField } from '../Game/BottleField';

const { ccclass } = _decorator;

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
    { id: 'belt', key: 'tree_cat_belt', icon: 'env/belt', req: 'p_stability' },
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
const TREE_IDLE_NODES = ['p_cursor', 'p_sizelimit', 'p_idle', 'p_idlemove', 'p_idletime', 'p_idlerecov'];
const HELPER_CAP_NODES = ['h_bronze', 'h_silver', 'h_gold', 'h_ruby', 'h_emerald', 'h_diamond'];

const PANEL_W = 708;
const SCROLL_W = 664;
const SCROLL_H = 170;

@ccclass('BottomPanel')
export class BottomPanel extends Component {
    static I: BottomPanel = null!;

    private tab: Tab = 'shop';
    /** 技能树当前类目 id（'bt0'..'bt6' 瓶子模块 / 'belt' / 'idle' / 'hand' / 'abil'）—— 下拉框只服务技能树页签 */
    private treeCat = 'bt0';

    private tabUis: Record<string, { node: Node; lb: Label }> = {};
    /** 底栏三个页签按钮右上角的「新」角标 */
    private tabNew: Record<string, Node> = {};
    private ddNode: Node = null!;
    private ddLb: Label = null!;
    private ddMenu: Node = null!;
    /** 下拉框右上角的「新」标签（有没点开过的模块时显示） */
    private ddNew: Node = null!;
    /** 下拉框的宽与中心 x（菜单展开时按它对齐「正上方」） */
    private ddW = 236;
    private ddX = 235;
    private menuOpen = false;

    private panel: Node = null!;
    private scrollRoot: Node = null!;
    private content: Node = null!;
    private scrollSV: ScrollView = null!;
    private hintLb: Label = null!;
    private msLb: Label = null!;

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
    build() {
        if (this.built) { return; }
        this.built = true;
        const root = this.node;

        /* ---- 底栏：【商店】【升级】【技能树】【瓶子种类下拉框】 ---- */
        const H = LAYOUT.navH;
        const Y = LAYOUT.navY;
        // 四件等距铺满 720：142 + 142 + 162 + 236 + 3×8 间隙 = 706，左右各留 7
        const W1 = 142, W2 = 142, W3 = 162, W4 = 236;
        const x0 = -(W1 + W2 + W3 + W4 + 24) / 2;              // 整排左缘
        const shopX = x0 + W1 / 2;
        const upX = shopX + W1 / 2 + 8 + W2 / 2;
        const treeX = upX + W2 / 2 + 8 + W3 / 2;
        const ddX = treeX + W3 / 2 + 8 + W4 / 2;

        const mkTab = (id: Tab, x: number, w: number, key: string, icon: string) => {
            const n = woodButton(root, {
                w, h: H, x, y: Y,
                fill: id === this.tab ? WOOD.gold : WOOD.cream, radius: 20,
                icon, iconW: 42, iconH: 42, iconX: -w / 2 + 34,
                text: t(key, G.lang), fontSize: 26, textColor: WOOD.text,
                textX: 12, textPadX: 62,
                name: 'tab_' + id, sound: 'click',
                onClick: () => {
                    // ★ 用户口径（第十七轮）：点页签按钮，选项左右晃一下
                    wobble(n);
                    this.showTab(id);
                },
            });
            this.tabUis[id] = { node: n, lb: n.getComponentInChildren(Label)! };
            // ★ 用户口径（第十八轮）：该页签里有「新出现的、还没点过」的项 → 按钮右上角挂「新」
            const tg = nd(n, 'tabNew', 40, 26, w / 2 - 20, H / 2 - 10);
            roundedPanel(tg, 40, 26, 0, 0, '#E8556D', 10, '#7A1E33', 2, 'bg');
            label(tg, t('tag_new', G.lang), 0, 1, 36, 22, { size: 14, color: '#FFF3D0', overflow: 'shrink' });
            tg.active = false;
            this.tabNew[id] = tg;
        };
        mkTab('shop', shopX, W1, 'nav_shop', 'ui/icon_shop2');
        mkTab('up', upX, W2, 'nav_upgrade', 'ui/icon_upgrade');
        mkTab('tree', treeX, W3, 'nav_skill', 'ui/icon_medal');

        /* 下拉框（最右，贴着「技能树」）；★ 只有技能树页签才显示它 */
        const dd = woodPlate(root, {
            w: W4, h: H, x: ddX, y: Y,
            fill: WOOD.creamDark, radius: 20, name: 'dropdown',
        });
        this.ddNode = dd;
        this.ddW = W4;
        this.ddX = ddX;
        dd.active = this.tab === 'tree';
        this.ddLb = label(dd, '', -26, 2, W4 - 76, H, {
            size: 24, color: WOOD.text, overflow: 'shrink',
        });
        // 三角箭头用 Graphics 画（字体里不一定有 ▼）
        const chev = nd(dd, 'chev', 30, 20, W3 / 2 - 26, 0);
        const cg = chev.addComponent(Graphics);
        cg.fillColor = hex(WOOD.text);
        cg.moveTo(-14, 7); cg.lineTo(14, 7); cg.lineTo(0, -9); cg.close(); cg.fill();

        dd.on(Node.EventType.TOUCH_START, () => { dd.setScale(0.96, 0.96, 1); });
        dd.on(Node.EventType.TOUCH_CANCEL, () => { dd.setScale(1, 1, 1); });
        dd.on(Node.EventType.TOUCH_END, () => {
            dd.setScale(1, 1, 1);
            wobble(dd);            // ★ 用户口径（第十七轮）：下拉框也是「选项」，点击同样左右晃
            this.toggleMenu();
        });

        // ★ 用户口径（第十五轮）：有没点开过的技能模块 → 下拉框右上角挂「新」标签，点过即消
        this.ddNew = nd(dd, 'newTag', 46, 30, W4 / 2 - 16, H / 2 - 4);
        roundedPanel(this.ddNew, 46, 30, 0, 0, '#E8556D', 12, '#7A1E33', 2, 'bg');
        label(this.ddNew, t('tag_new', G.lang), 0, 1, 42, 24, { size: 16, color: '#FFF3D0', overflow: 'shrink' });
        this.ddNew.active = false;

        /* ---- 提示带 + 列表（内嵌面板本体） ---- */
        this.buildPanel(root);

        G.addListener(() => this.onLang());
        this.lastLang = G.lang;
        this.rebuild();
        this.baselineSeen();
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
        this.hintLb = label(p, '', -PANEL_W / 2 + 18, topEdge - 22, 430, 26,
            { size: 16, color: '#7A4210', hAlign: 'left', anchorX: 0, overflow: 'shrink' });
        this.msLb = label(p, '', PANEL_W / 2 - 18, topEdge - 22, 200, 26,
            { size: 15, color: '#8A6134', hAlign: 'right', anchorX: 1, overflow: 'shrink' });

        // 滚动区：上沿贴提示带下方，下沿离面板底 8px
        const sv = scrollView(p, SCROLL_W, SCROLL_H, 0, -15);
        this.scrollRoot = sv.root;
        this.content = sv.content;
        this.scrollSV = sv.sv;
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
    private toggleMenu() {
        this.menuOpen = !this.menuOpen;
        if (!this.menuOpen) {
            if (this.ddMenu && this.ddMenu.isValid) { this.ddMenu.active = false; }
            return;
        }
        if (!this.ddMenu || !this.ddMenu.isValid) {
            this.ddMenu = nd(this.node, 'ddMenu', 280, 10, 0, 0);
        }
        this.ddMenu.removeAllChildren();
        const list = this.cats();
        const cur = this.catDef().id;
        const IH = 52, PAD = 6, MW = 280;
        const mh = list.length * (IH + 4) + PAD * 2;
        (this.ddMenu.getComponent(UITransform) as any).setContentSize(MW, mh);
        roundedPanel(this.ddMenu, MW, mh, 0, 0, '#3E2C1A', 16, '#1E1408', 4, 'mbg');

        // 右缘对齐下拉框右缘（超宽屏也不出屏：再夹一道屏幕右边界）
        const rightEdge = Math.min(this.ddX + this.ddW / 2, 360 - 8);
        const bottom = LAYOUT.navY + LAYOUT.navH / 2 + 6;
        this.ddMenu.setPosition(rightEdge - MW / 2, bottom + mh / 2, 0);
        this.ddMenu.setSiblingIndex(this.node.children.length - 1);   // 压在履带之上

        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const y = mh / 2 - PAD - IH / 2 - i * (IH + 4);
            const on = c.id === cur;
            const sp = sliced(this.ddMenu, 'ui/card_white', MW - 12, IH, 0, y, [24, 24, 24, 24],
                on ? '#F2C34E' : '#5C2E12', 'it' + i);
            const iw = c.icon.indexOf('bottle/body_') === 0 ? 14 : 34;   // 瓶身贴图瘦高比 0.4，同比例缩小
            const icNode = nd(sp.node, 'ic', iw, 34, -104, 0);
            setFrame(icNode.addComponent(Sprite), c.icon, iw, 34);
            // 文字紧贴图标右侧（锚点靠左），不要居中 —— 和参考图的下拉项一致
            const lb = label(sp.node, this.catName(c), -76, 1, 170, IH, {
                size: 21, color: on ? '#7A4210' : '#F1E0C0', hAlign: 'left', anchorX: 0, overflow: 'shrink',
            });
            void lb;
            // ★ 用户口径（第十五轮）：没被玩家点过的技能模块在行右侧挂「新」标签，点过即消
            if (!G.itemSeen(c.id)) {
                const tg = nd(sp.node, 'newTag', 54, 30, (MW - 12) / 2 - 34, 0);
                roundedPanel(tg, 54, 30, 0, 0, '#E8556D', 10, '#7A1E33', 2, 'bg');
                label(tg, t('tag_new', G.lang), 0, 1, 50, 22, { size: 16, color: '#FFF3D0', overflow: 'shrink' });
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
        const savedY = sameCat ? this.content.position.y : (SCROLL_H / 2);

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
        // content 锚点在顶部 → 位置写「视口半高」（见 UIKit.scrollView 注释）。
        // 同模块重建时夹回新内容高度的合法范围（列表变短了就停在末尾），否则恢复顶部。
        const maxY = SCROLL_H / 2;
        const minY = maxY - Math.max(0, h - SCROLL_H);
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
    private placeholderRow(text: string, icon = 'ui/icon_medal'): RowSpec {
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
        const pref = (G.lang === 'zh' ? TIERS[tier].zh : TIERS[tier].en) + '·';
        const incomeDef = BOTTLE_STATS.find((s) => s.id === 'income')!;

        // ① 收入 —— 树的根（该阶唯一一开始就开放的节点）
        if (!G.statMax(tier, 'income')) { out.push(this.statRow(tier, incomeDef, pref, 'tr:b' + tier + ':income')); }

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
            out.push(this.statRow(tier, d, pref, 'tr:b' + tier + ':' + d.id));
        }

        // ④ 模块解锁：光圈 → 手部模块；传送带 → 履带科技线（原版挂在这棵树上）
        if (G.skLv('p_cursor') <= 0) { out.push(this.moduleRow('p_cursor', 'unlock_cursor', 'unlock_cursor_d', 'tr:m:p_cursor')); }
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
            name: t(def.name, G.lang).replace(/\n/g, ' '),
            sub: skillDesc(def),
            label: 'C ' + fmt(cost),
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 瓶盖不足 → 广告图标（直接拉广告给货）
            onBuy: (after) => {
                if (G.skMax(id)) { return; }
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
            name: t(nameKey, G.lang),
            sub: t(descKey, G.lang),
            label: 'C ' + fmt(cost),
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 瓶盖不足 → 广告图标（直接拉广告给货）
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
                name: G.lang === 'zh' ? d.zh : d.en,
                sub: t('owned_n', G.lang).replace('{n}', String(G.data.bottles[tier])).replace('{m}', String(cap))
                    + ' · +' + fmt(G.bottleIncome(tier)) + (G.lang === 'zh' ? '/次' : '/flip')
                    + ' · ' + toleranceText(tier),
                label: '',
                tone: 'on',
                onBuy: () => { /* 由下面覆盖 */ },
            });
            const row = out[out.length - 1];
            // 三态文案在按钮上：满仓 / 购买 / 去研发
            const maxed = G.data.bottles[tier] >= cap;
            const cost = G.bottleCost(tier);
            row.tone = maxed ? 'max' : (G.data.money >= cost ? 'on' : 'off');
            row.label = maxed ? t('max', G.lang) : '$' + fmt(cost);
            // 金币不足但有广告出路 → 价格按钮亮 ksp 广告图标（不显示金币价格）
            row.ad = !maxed && G.data.money < cost;
            row.onBuy = (after, btn) => {
                if (G.data.bottles[tier] >= G.tierCap(tier)) {
                    Toast.I?.show(t('bought_out', G.lang), '#FFD98A');
                    return;
                }
                // ★ 先登记飞入、再扣钱：buyBottle 内部同步 notify → BottleField.sync 立刻建出
                //   这只新瓶子，飞行动画只有在那一次 sync 里接上才对得上（失败则撤销登记）。
                BottleField.I?.queueFlyIn(tier, btn ?? null);
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
            name: t('cap_machine', G.lang),
            sub: on
                ? (G.lang === 'zh' ? '已安装 · 扣盖弹出的瓶盖自动回收入库' : 'Installed · caps auto-collected')
                : (G.lang === 'zh' ? '装在桌台下方 · 装好后扣盖才开始产瓶盖' : 'Under the desk · caps drop once installed'),
            label: on ? t('max', G.lang) : '$' + String(MACHINE_PRICE).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
            tone: on ? 'max' : (G.data.money >= MACHINE_PRICE ? 'on' : 'off'),
            ad: !on && G.data.money < MACHINE_PRICE,
            onBuy: (after) => {
                if (G.hasMachine) { return; }
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
            name: t('helper_hand', G.lang),
            sub: G.lang === 'zh'
                ? `自动翻瓶 · 已拥有 ${G.data.hands}/${G.maxHands} 只`
                : `Auto flip · ${G.data.hands}/${G.maxHands}`,
            label: maxed ? t('max', G.lang) : '$' + fmt(cost),
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
            const pref = (G.lang === 'zh' ? TIERS[tier].zh : TIERS[tier].en) + '·';
            for (const id of ['income', 'hover']) {
                const d = BOTTLE_STATS.find((s) => s.id === id);
                if (!d || !G.statUnlocked(d.id) || G.statMax(tier, d.id)) { continue; }
                out.push(this.statRow(tier, d, pref, 'up:s' + tier + ':' + id));
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

    /** 单瓶词条行（原版升级页 · 瓶子区：收入可重复买、悬停翻转一次性） */
    private statRow(tier: number, d: BottleStatDef, namePrefix: string, seenId: string): RowSpec {
        const cost = G.statCost(tier, d.id);
        const caps = G.statCurrency(d.id) === 'caps';
        const afford = caps ? G.data.caps >= cost : G.data.money >= cost;
        return {
            id: seenId,
            icon: d.icon,
            name: namePrefix + t(d.name, G.lang),
            sub: statDesc(d, tier),
            label: (caps ? 'C ' : '$') + fmt(cost),
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 金币/瓶盖不足都走广告图标（直接拉广告给货）
            onBuy: (after) => {
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
            name: t(def.name, G.lang).replace(/\n/g, ' '),
            sub: skillDesc(def),
            label: 'C ' + fmt(cost),
            tone: afford ? 'on' : 'off',
            ad: !afford,   // 瓶盖不足 → 广告图标（直接拉广告给货）
            onBuy: (after) => {
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
                name: t(def.name, G.lang).replace(/\n/g, ' '),
                sub: skillDesc(def),
                label: 'C ' + fmt(cost),
                tone: afford ? 'on' : 'off',
                ad: !afford,   // 瓶盖不足 → 广告图标（直接拉广告给货）
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
        if (this.hintLb && this.hintLb.isValid) {
            this.hintLb.string = t('next_goal', G.lang) + '：' + nextGoalText();
        }
        if (this.msLb && this.msLb.isValid) {
            const next = G.msNext;
            this.msLb.string = t('ms_chip', G.lang).replace('{n}', String(G.milestone))
                + ' · ' + (next ? (fmt(G.msProgress) + '/' + fmt(next.need)) : t('ms_max', G.lang));
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
            woodPlateRefill(ui.node, id === this.tab ? WOOD.gold : (locked ? '#C9B79B' : WOOD.cream));
            ui.lb.string = t(keys[id], G.lang);
        }
    }

    /** 语言切换：整块重建（文案全变了） */
    private onLang() {
        if (G.lang === this.lastLang) { return; }
        this.lastLang = G.lang;
        this.rebuild();
    }
}

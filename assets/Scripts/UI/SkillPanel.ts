import { Node, Label, Sprite, UITransform, Graphics, ScrollView, UIOpacity, Vec2, tween } from 'cc';
import {
    ABILITY_GRAPH, HELPER_GRAPH, NODE_SIZE, NODE_STEP_X, NODE_STEP_Y, PLAYER_GRAPH, SKILL_GRAPH,
    SkillNodeDef,
} from '../Core/GameConfig';
import { G, SKILL_BY_ID } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { fmt, hex } from '../Core/Util';
import { destroyChildren, label, nd, setFrame, tint } from './UIKit';
import { openPanel, PanelWrap } from './Panel';
import { Toast } from './Toast';
import { skillDesc } from './DrawerContent';

/* ------------------------------------------------------------------ *
 *  技能树：节点图（对照原版 Bottle Flip Inc —— 中心 = 最先解锁的节点）
 *
 *  每张节点卡由三层叠出来（全部走 tint 染色，零 Graphics 重绘）：
 *    glow  S+16  可购买时脉动的金色光晕
 *    ring  S+8   状态色描边（锁定灰蓝 / 可买亮金 / 已购暗金 / 满级绿）
 *    card  S     深色内芯：图标 + 名称 + 价格或等级
 *  右上角角标位：锁定=挂锁，可升级=绿色箭头，已拥有=暗金箭头。
 *  底部整条信息栏就是购买按钮（点节点选中 → 点下方购买）。
 * ------------------------------------------------------------------ */

interface PageDef { id: string; titleKey: string; graph: SkillNodeDef[]; }

/** 四大分支各一页（对照原版 Bottle Flip Inc 的四个科技树页签） */
const PAGES: PageDef[] = [
    { id: 'bottle', titleKey: 'tree_page_bottle', graph: SKILL_GRAPH },
    { id: 'player', titleKey: 'tree_page_player', graph: PLAYER_GRAPH },
    { id: 'helper', titleKey: 'tree_page_helper', graph: HELPER_GRAPH },
    { id: 'ability', titleKey: 'tree_page_ability', graph: ABILITY_GRAPH },
];

const CANVAS_W = 640;

/**
 * 面板内布局（frame 局部坐标，frame 高 1080 → ±540）
 *
 * ⚠️ SCROLL_H 不是随便取的 620：节点在内容里按 NODE_STEP_Y(124) 排格，
 * 首个节点中心距内容顶 = padTop(84) + NODE_SIZE/2(56) = 140。
 * 视口下沿能落进「行间隙」的条件是 SCROLL_H ≡ 140 + 124/2 = 202 ≡ 78 (mod 124)。
 * 620 ≡ 0 (mod 124) → 下沿正好切在节点中心下方 16px，也就是**从名称文字中间划过去**，
 * 这就是用户看到的「文本被挡住了」。改成 574（574 ≡ 78）后，下沿落进行间隙，
 * 最近的一整行节点下沿还留 6px，一眼看上去就是「这里本来还有一行」。
 */
const TITLE_Y = 484;
const CAPS_Y = 420;
const TAB_Y = 342;
const SCROLL_H = 574;
const SCROLL_Y = -15;
const INFO_H = 192;
const INFO_Y = -428;

type NodeState = 'locked' | 'poor' | 'buy' | 'owned' | 'max';

interface Skin { ring: string; card: string; icon: string; name: string; }
const SKIN: Record<NodeState, Skin> = {
    locked: { ring: '#39435A', card: '#1A2130', icon: '#4A5468', name: '#6B7891' },
    poor:   { ring: '#8A5A3C', card: '#2A211A', icon: '#9AA6BC', name: '#C9A98F' },
    buy:    { ring: '#FFD75E', card: '#43331A', icon: '#FFFFFF', name: '#FFE9A8' },
    owned:  { ring: '#D9A63C', card: '#332A18', icon: '#FFFFFF', name: '#FFE9A8' },
    max:    { ring: '#7BD9A0', card: '#1C3326', icon: '#FFFFFF', name: '#B6F0C6' },
};

interface NodeUI {
    def: SkillNodeDef;
    root: Node;
    glow: Node;
    ring: Sprite;
    card: Sprite;
    icon: Sprite;
    name: Label;
    botIcon: Node;
    bot: Label;
    badge: Node;
    badgeSp: Sprite;
    sel: Node;
    pos: Vec2;
}

/** 统一造一张 card_white 九宫格并染色 */
function cardSprite(parent: Node, name: string, w: number, h: number, color: string, inset = 30): Sprite {
    const n = nd(parent, name, w, h, 0, 0);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.trim = false;
    const sf = Res.I ? Res.I.slice('ui/card_white', inset, inset, inset, inset) : null;
    if (sf) { sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; }
    (n.getComponent(UITransform) as any).setContentSize(w, h);
    tint(sp, color);
    return sp;
}

export function openSkill(parent: Node) {
    const p: PanelWrap = openPanel(parent, 'tab_tree', SCROLL_H);
    const frame = p.frame;
    const body = p.body;

    const svNode = frame.getChildByName('scroll');
    if (svNode) { svNode.setPosition(0, SCROLL_Y, 0); }
    // 滚动指示条是 frame 的兄弟节点，不跟着 scroll 走，要手动同步 Y
    const sbarNode = frame.getChildByName('sbar');
    if (sbarNode) { sbarNode.setPosition(sbarNode.position.x, SCROLL_Y, 0); }
    const sv = svNode ? svNode.getComponent(ScrollView) : null;

    /* ---------------- 顶部：瓶盖余额 ---------------- */
    const capPill = nd(frame, 'capsPill', 340, 66, 0, CAPS_Y);
    cardSprite(capPill, 'bg', 340, 66, '#111827', 32);
    const capIcNode = nd(capPill, 'ci', 46, 40, -118, 0);
    setFrame(capIcNode.addComponent(Sprite), 'bottle/capchip_6', 46, 40);
    const capUnit = label(capPill, t('caps_unit', G.lang), -62, -2, 110, 32, { size: 19, color: '#8FA3BC' });
    const capLb = label(capPill, '0', 150, 2, 180, 46, {
        size: 31, color: '#FFE9A8', hAlign: 'right', anchorX: 1, outline: '#0B0F16', outlineWidth: 2,
    });

    /* ---------------- 页签 ---------------- */
    let page = 0;
    const tabUis: Array<{ bg: Sprite, lb: Label }> = [];
    const strip = nd(frame, 'tabStrip', 648, 80, 0, TAB_Y);
    cardSprite(strip, 'bg', 648, 80, '#0D1420', 32);

    for (let i = 0; i < PAGES.length; i++) {
        // 4 个页签挤在 648 宽的条里：152 宽 / 间距 160
        const bx = (i - (PAGES.length - 1) / 2) * 160;
        const n = nd(strip, 'tab_' + PAGES[i].id, 152, 64, bx, 0);
        const bg = cardSprite(n, 'bg', 152, 64, '#22304A', 30);
        const lb = label(n, t(PAGES[i].titleKey, G.lang), 0, 1, 146, 46, { size: 21, color: '#C9D6E6', overflow: 'shrink' });
        tabUis.push({ bg, lb });
        n.on(Node.EventType.TOUCH_END, () => { if (page !== i) { page = i; rebuild(); } });
    }

    /* ---------------- 底部购买条（整条即按钮） ---------------- */
    const info = nd(frame, 'info', 640, INFO_H, 0, INFO_Y);
    const ibBg = cardSprite(info, 'bg', 640, INFO_H, '#141C2A', 32);

    const infoName = label(info, '', -296, 64, 360, 38, { size: 28, color: '#FFE9A8', hAlign: 'left', anchorX: 0 });
    const infoLv = label(info, '', 296, 64, 220, 34, { size: 21, color: '#8FA3BC', hAlign: 'right', anchorX: 1 });
    const infoDesc = label(info, '', -296, 8, 372, 68, {
        size: 18, color: '#9FB3CC', hAlign: 'left', anchorX: 0, overflow: 'clamp',
    });
    infoDesc.lineHeight = 23;

    const btnShape = nd(info, 'btn', 228, 86, 184, -46);
    const bsSp = cardSprite(btnShape, 'bg', 228, 86, '#3A4557', 44);
    const btnLb = label(btnShape, '', 0, 2, 200, 56, { size: 26, color: '#FFFFFF', outline: '#1B2230', outlineWidth: 2 });

    const infoCost = label(info, '', -296, -54, 270, 40, { size: 24, color: '#7FE1FF', hAlign: 'left', anchorX: 0 });

    /* ---------------- 图内容 ---------------- */
    let nodes: NodeUI[] = [];
    let selected: NodeUI | null = null;
    let linesGr: Graphics | null = null;
    let byId: Record<string, SkillNodeDef> = {};

    function rebuild() {
        destroyChildren(body);
        nodes = [];
        selected = null;
        linesGr = null;

        for (let i = 0; i < PAGES.length; i++) {
            const on = i === page;
            tint(tabUis[i].bg, on ? '#F2C64B' : '#22304A');
            tint(tabUis[i].lb, on ? '#1B2334' : '#C9D6E6');
        }

        const g = PAGES[page].graph;
        let maxRow = -99, minRow = 99;
        for (const d of g) { maxRow = Math.max(maxRow, d.row); minRow = Math.min(minRow, d.row); }
        const rows = maxRow - minRow;
        const padTop = 84;
        const canvasH = padTop + rows * NODE_STEP_Y + NODE_SIZE + 92;

        (body.getComponent(UITransform) as any).setContentSize(CANVAS_W, canvasH);

        const toPos = (d: SkillNodeDef): Vec2 => new Vec2(
            d.col * NODE_STEP_X,
            -(padTop + (maxRow - d.row) * NODE_STEP_Y + NODE_SIZE / 2),
        );

        byId = {};
        for (const d of g) { byId[d.id] = d; }

        const lines = nd(body, 'lines', CANVAS_W, canvasH, 0, 0, 0.5, 1);
        linesGr = lines.addComponent(Graphics);
        linesGr.lineCap = Graphics.LineCap.ROUND;

        for (const d of g) { nodes.push(makeNode(body, d, toPos(d))); }

        // 打开时定位到「当前最该点的那一个」
        const focus = nodes.find(n => stateOf(n.def) === 'buy')
            || nodes.find(n => n.def.parent === null)
            || nodes[0];
        if (focus) { select(focus); }

        paintAll();

        if (sv && focus) {
            const maxOff = Math.max(0, canvasH - SCROLL_H);
            let off = Math.abs(focus.pos.y) - SCROLL_H / 2;
            // 对齐到行格：初始位置的下沿落进「行间隙」，底部那行不会被遮罩从名称中间切开
            off = Math.round(off / NODE_STEP_Y) * NODE_STEP_Y;
            off = Math.min(maxOff, Math.max(0, off));
            sv.scrollToOffset(new Vec2(0, off));
        }
    }

    function makeNode(parentNode: Node, def: SkillNodeDef, pos: Vec2): NodeUI {
        const S = NODE_SIZE;
        const root = nd(parentNode, 'n_' + def.id, S, S, pos.x, pos.y);

        // 选中外环（最底）
        const sel = nd(root, 'sel', S + 30, S + 30, 0, 0);
        const selSp = cardSprite(sel, 'bg', S + 30, S + 30, '#EAF2FF', 30);
        sel.addComponent(UIOpacity).opacity = 96;
        sel.active = false;

        // 可购买光晕（脉动）
        const glow = nd(root, 'glow', S + 16, S + 16, 0, 0);
        cardSprite(glow, 'bg', S + 16, S + 16, '#FFD75E', 30);
        const glOp = glow.addComponent(UIOpacity);
        glOp.opacity = 70;
        tween(glOp).to(0.7, { opacity: 190 }).to(0.7, { opacity: 70 })
            .union().repeatForever().start();
        glow.active = false;

        void selSp;

        // 状态描边环 + 内芯
        const ring = cardSprite(nd(root, 'ring', S + 8, S + 8), 'bg', S + 8, S + 8, '#39435A', 30);
        const card = cardSprite(nd(root, 'card', S, S), 'bg', S, S, '#1A2130', 30);

        // 卡内三级文本层级（纵向预算，卡片 112 → ±56）：
        //   图标 44@y=28   →  6 … 50
        //   名称 30@y=-16  → -31 … -1   （可放两行，行高 15；长名在 Locale 里用 \n 手动断行）
        //   状态 22@y=-42  → -53 … -31
        // 三段首尾相接、零重叠。原来图标 54@20 伸到 -7 而名称顶在 0，图标底 7px 压在字上。
        const icNode = nd(root, 'ic', 44, 44, 0, 28);
        const icon = setFrame(icNode.addComponent(Sprite), def.icon, 44, 44);

        const name = label(root, '', 0, -16, 106, 30, { size: 14, color: '#FFFFFF', overflow: 'shrink' });
        name.lineHeight = 15;

        const botIcon = nd(root, 'botIcon', 18, 16, -24, -42);
        setFrame(botIcon.addComponent(Sprite), 'bottle/capchip_6', 18, 16);
        botIcon.active = false;

        const bot = label(root, '', 8, -42, 92, 22, { size: 15, color: '#9FE3FF' });

        const badge = nd(root, 'st', 34, 34, 42, 42);
        const badgeSp = setFrame(badge.addComponent(Sprite), 'stat/locked', 30, 40);
        badge.active = false;

        const ui: NodeUI = { def, root, glow, ring, card, icon, name, botIcon, bot, badge, badgeSp, sel, pos };
        root.on(Node.EventType.TOUCH_END, () => onTap(ui));
        return ui;
    }

    /* ---------------- 状态 ---------------- */
    function parentOk(d: SkillNodeDef): boolean {
        if (!d.parent) { return true; }
        return G.skLv(d.parent) > 0;
    }

    function stateOf(d: SkillNodeDef): NodeState {
        if (!parentOk(d)) { return 'locked'; }
        if (G.skMax(d.id)) { return 'max'; }
        const lv = G.skLv(d.id);
        if (lv > 0) { return 'owned'; }
        return G.data.caps >= G.skCost(d.id) ? 'buy' : 'poor';
    }

    function paint(ui: NodeUI) {
        const d = ui.def;
        const st = stateOf(d);
        const sk = SKIN[st];
        const maxed = G.skMax(d.id);
        const lv = G.skLv(d.id);
        const cost = G.skCost(d.id);
        const def = SKILL_BY_ID[d.id];

        tint(ui.ring, sk.ring);
        tint(ui.card, sk.card);
        tint(ui.icon, sk.icon);
        tint(ui.name, sk.name);
        ui.name.string = t(def ? def.name : d.id, G.lang);

        ui.glow.active = st === 'buy';
        ui.sel.active = selected === ui;

        // 右上角角标：锁 / 升级箭头
        const showBadge = st === 'locked' || st === 'buy' || st === 'owned';
        ui.badge.active = showBadge;
        if (showBadge) {
            if (st === 'locked') {
                setFrame(ui.badgeSp, 'stat/locked', 30, 40);
                tint(ui.badgeSp, '#9AA6BC');
            } else {
                setFrame(ui.badgeSp, 'ui/icon_upgrade', 34, 34);
                tint(ui.badgeSp, st === 'buy' ? '#7CE38B' : '#C9A44A');
            }
        }

        // 底部：价格 / 等级 / MAX / 未解锁
        if (st === 'locked') {
            ui.botIcon.active = false;
            ui.bot.node.setPosition(0, -42, 0);
            ui.bot.string = t('locked', G.lang);
            tint(ui.bot, '#5E6A82');
        } else if (maxed) {
            ui.botIcon.active = false;
            ui.bot.node.setPosition(0, -42, 0);
            ui.bot.string = t('max', G.lang);
            tint(ui.bot, '#7CE38B');
        } else if (lv > 0) {
            ui.botIcon.active = false;
            ui.bot.node.setPosition(0, -42, 0);
            ui.bot.string = t('level', G.lang) + ' ' + lv + '/' + (def ? def.max : 1);
            tint(ui.bot, '#C9D6E6');
        } else {
            ui.botIcon.active = true;
            ui.botIcon.setPosition(-24, -42, 0);
            ui.bot.node.setPosition(12, -38, 0);
            ui.bot.string = fmt(cost);
            tint(ui.bot, st === 'buy' ? '#FFE9A8' : '#E8765A');
        }
    }

    function posOf(d: SkillNodeDef): Vec2 | null {
        for (const n of nodes) { if (n.def === d) { return n.pos; } }
        return null;
    }

    function redrawLinks() {
        const gr = linesGr;
        if (!gr) { return; }
        gr.clear();
        for (const d of PAGES[page].graph) {
            if (!d.parent || !byId[d.parent]) { continue; }
            const a = posOf(byId[d.parent]);
            if (!a) { continue; }
            const b = posOf(d);
            if (!b) { continue; }
            const on = parentOk(d);
            gr.lineWidth = on ? 12 : 8;
            gr.strokeColor = hex(on ? '#8A7440' : '#2B3346');
            gr.moveTo(a.x, a.y);
            gr.lineTo(b.x, b.y);
            gr.stroke();
        }
    }

    function paintAll() {
        for (const n of nodes) { paint(n); }
        redrawLinks();
    }

    function select(ui: NodeUI) {
        selected = ui;
        for (const n of nodes) { n.sel.active = n === ui; }
        refreshInfo();
    }

    function refreshInfo() {
        const ui = selected;
        if (!ui) { return; }
        const d = ui.def;
        const def = SKILL_BY_ID[d.id];
        const st = stateOf(d);
        const lv = G.skLv(d.id);
        const maxed = G.skMax(d.id);

        // 节点名里可能有为卡片排版的 \n，信息条是单行，换成空格
        infoName.string = t(def ? def.name : d.id, G.lang).replace(/\n/g, ' ');
        tint(infoName, SKIN[st].name);
        infoLv.string = t('level', G.lang) + ' ' + lv + '/' + (def ? def.max : 1);

        if (st === 'locked') {
            infoDesc.string = t('need_parent', G.lang);
            infoCost.string = t('locked', G.lang);
            tint(infoCost, '#8FA3BC');
            btnLb.string = t('locked', G.lang);
            tint(bsSp, '#3A4557');
            tint(btnLb, '#98A3B6');
        } else if (maxed) {
            infoDesc.string = def ? t('maxed', G.lang) : '';
            infoCost.string = t('max', G.lang);
            tint(infoCost, '#8CE7A2');
            btnLb.string = t('max', G.lang);
            tint(bsSp, '#2E6B4E');
            tint(btnLb, '#B6F0C6');
        } else {
            infoDesc.string = def ? skillDesc(def) : '';
            const cost = G.skCost(d.id);
            const afford = G.data.caps >= cost;
            infoCost.string = fmt(cost) + ' ' + t('caps_unit', G.lang);
            tint(infoCost, afford ? '#7FE1FF' : '#E8765A');
            btnLb.string = (lv === 0 && def && def.unit === 'unlock') ? t('unlock', G.lang) : t('upgrade', G.lang);
            // 买得起 = 亮金底深字（最抓眼）；买不起 = 暗红底浅字
            tint(bsSp, afford ? '#D9A63C' : '#6E4038');
            tint(btnLb, afford ? '#1B2334' : '#E8BDB4');
        }
    }

    /* ---------------- 点击 ---------------- */
    function buy() {
        const ui = selected;
        if (!ui) { return; }
        const d = ui.def;
        const st = stateOf(d);
        if (st === 'locked') { Toast.I?.show(t('need_parent', G.lang), '#FFB0A0'); return; }
        if (st === 'max') { Toast.I?.show(t('maxed', G.lang), '#8CE7A2'); return; }
        if (st === 'poor') {
            Toast.I?.show(t('not_enough', G.lang) + (G.lang === 'zh' ? '（瓶盖）' : ' (caps)'), '#FFB0A0');
            return;
        }
        if (G.upgradeSkill(d.id)) {
            paintAll();
            refreshInfo();
            capLb.string = fmt(Math.floor(G.data.caps));
        }
    }

    function onTap(ui: NodeUI) {
        select(ui);
        if (stateOf(ui.def) === 'locked') { Toast.I?.show(t('need_parent', G.lang), '#FFB0A0'); }
    }

    info.on(Node.EventType.TOUCH_START, () => { info.setScale(0.985, 0.985, 1); });
    info.on(Node.EventType.TOUCH_CANCEL, () => { info.setScale(1, 1, 1); });
    info.on(Node.EventType.TOUCH_END, () => { info.setScale(1, 1, 1); buy(); });

    p.host.onRefresh = () => {
        capLb.string = fmt(Math.floor(G.data.caps));
        paintAll();
        refreshInfo();
    };
    G.addListener(() => {
        for (let i = 0; i < PAGES.length; i++) {
            if (tabUis[i].lb.isValid) { tabUis[i].lb.string = t(PAGES[i].titleKey, G.lang); }
        }
        if (capUnit.isValid) { capUnit.string = t('caps_unit', G.lang); }
    });

    void ibBg;
    capLb.string = fmt(Math.floor(G.data.caps));
    rebuild();
    return p;
}

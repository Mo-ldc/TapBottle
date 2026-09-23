import { Node, Label, Sprite, UITransform } from 'cc';
import { BOTTLE_STATS, BottleStatDef, HAND, TIERS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { bar, button, destroyChildren, label, nd, setFrame, tint } from './UIKit';
import { Toast } from './Toast';

export const CW = 648;          // 内容宽

/* ------------------------------------------------------------------ *
 *  抽屉内皮肤
 * ------------------------------------------------------------------ */
const C_CARD = '#1C2531';       // 普通卡
const C_CARD_HI = '#22303F';    // 主卡
const C_LINE = '#2E3B52';       // 卡片描边

/* ------------------------------------------------------------------ *
 *  卡片 / 贴图助手
 * ------------------------------------------------------------------ */
function slicedNode(parent: Node, w: number, h: number, x: number, y: number, color: string, name = 'card'): Node {
    const n = nd(parent, name, w, h, x, y);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.trim = false;
    const sf = Res.I ? Res.I.slice('ui/card_white', 30, 30, 30, 30) : null;
    if (sf) { sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; }
    (n.getComponent(UITransform) as any).setContentSize(w, h);
    tint(sp, color);
    return n;
}

/** 卡片（可带一圈描边，描边先建所以在下层） */
function roundCard(parent: Node, x: number, y: number, w: number, h: number, fill: string, stroke?: string): Node {
    if (stroke) { slicedNode(parent, w + 6, h + 6, x, y, stroke, 'stroke'); }
    return slicedNode(parent, w, h, x, y, fill, 'card');
}

/* ------------------------------------------------------------------ *
 *  数值文案
 * ------------------------------------------------------------------ */
export function skillDesc(d: { id: string; desc: string; unit: string; base: number; step: number }): string {
    const lv = G.skLv(d.id);
    const cur = d.base + lv * d.step;
    const next = d.base + (lv + 1) * d.step;
    const S = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString());
    let body = t(d.desc, G.lang);
    switch (d.unit) {
        case 'percent':
            body = body.replace('{v}', S(next * 100)).replace('{d}', S(d.step * 100));
            break;
        case 'mult':
            body = body.replace('{v}', S((next - 1) * 100));
            break;
        case 'size':
            body = body.replace('{v}', S(next));
            break;
        case 'count':
            body = body.replace('{v}', String(Math.max(0, Math.floor(next)))).replace('{d}', S(Math.abs(d.step)));
            break;
        case 'seconds':
            body = body.replace('{v}', S(Math.abs(cur))).replace('{d}', S(Math.abs(d.step)));
            break;
        default:
            body = body.replace('{v}', S(next)).replace('{d}', S(d.step));
            break;
    }
    body = body.replace('{cur}', S(cur * (d.unit === 'percent' ? 100 : 1)));
    body = body.replace('{next}', S(next * (d.unit === 'percent' ? 100 : 1)));
    body = body.replace('{cd}', G.cokeCooldown.toFixed(0));
    body = body.replace('{n}', String(G.berserkNeed));
    return body;
}

export function statDesc(d: BottleStatDef, tier: number): string {
    const lv = G.statLv(tier, d.id);
    const isPP = d.unit === 'pp';
    const base = isPP ? TIERS[tier].success : 0;
    const cur = base + lv * d.step;
    const next = Math.min(0.85, base + (lv + 1) * d.step);
    const S = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString());
    let body = t(d.desc, G.lang);
    switch (d.unit) {
        case 'percent':
            if (d.id === 'income') { body = body.replace('{v}', S(next + 1)); }
            else { body = body.replace('{v}', S(next * 100)).replace('{d}', S(d.step * 100)); }
            break;
        case 'pp':
            body = body.replace('{cur}', String(Math.round(cur * 100))).replace('{next}', String(Math.round(next * 100)));
            break;
        case 'count':
            body = body.replace('{v}', String(G.tierCap(tier)));
            break;
        default:
            body = body.replace('{v}', S(next));
            break;
    }
    return body;
}

/** 主按钮三态皮肤：可用（金底深字）/ 买不起（暗红底浅字）/ 满级（绿底） */
type BtnState = 'on' | 'off' | 'max';
const BTN_SKIN: Record<BtnState, { bg: string; fg: string }> = {
    on:  { bg: '#C8A44A', fg: '#1B2334' },
    off: { bg: '#4A3B36', fg: '#E8BDB4' },
    max: { bg: '#2E6B4E', fg: '#B6F0C6' },
};

export function skinBtn(btn: Node, lb: Label, st: BtnState) {
    const bg = btn.getChildByName('bg');
    const sp = bg ? bg.getComponent(Sprite) : null;
    if (sp) { tint(sp, BTN_SKIN[st].bg); }
    tint(lb, BTN_SKIN[st].fg);
}

/* ------------------------------------------------------------------ *
 *  行：单瓶词条（名称 + 等级条 + 描述 + 价格按钮）
 * ------------------------------------------------------------------ */
interface StatRowUI {
    def: BottleStatDef;
    tier: number;
    icon: Sprite;
    name: Label;
    desc: Label;
    lv: Label;
    btn: Node;
    btnLb: Label;
    lvBar: { set: (p: number) => void };
}

export function makeStatRow(parent: Node, y: number, tier: number, d: BottleStatDef,
    onChanged: () => void): StatRowUI {
    const card = roundCard(parent, 0, y, CW, 104, C_CARD);

    const icNode = nd(card, 'ic', 64, 64, -268, 0);
    const icon = setFrame(icNode.addComponent(Sprite), d.icon, 64, 64);

    const name = label(card, '', -224, 32, 250, 32, { size: 21, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
    const lvBar = bar(card, 290, 10, -78, 8, '#4FB0E8', '#101722');
    const desc = label(card, '', -224, -22, 300, 44, {
        size: 15, color: '#9FB3CC', hAlign: 'left', anchorX: 0, overflow: 'clamp',
    });
    desc.lineHeight = 19;
    const lv = label(card, '', 224, 38, 180, 26, { size: 16, color: '#8FA3BC', hAlign: 'right', anchorX: 1 });

    const btn = button(card, {
        w: 176, h: 68, x: 224, y: -18,
        tex: 'ui/card_white', inset: [30, 30, 30, 30],
        sound: 'buy', name: 'st_' + d.id,
        onClick: () => {
            if (G.statMax(tier, d.id)) { return; }
            if (!G.upgradeStat(tier, d.id)) {
                Toast.I?.show(t('not_enough', G.lang) + (G.lang === 'zh' ? '（金币）' : ' (coins)'), '#FFB0A0');
                return;
            }
            onChanged();
        },
    });
    const btnLb = label(btn, '', 0, 2, 158, 44, { size: 21, color: '#FFFFFF' });

    const r: StatRowUI = { def: d, tier, icon, name, desc, lv, btn, btnLb, lvBar };
    refreshStatRow(r);
    return r;
}

export function refreshStatRow(r: StatRowUI) {
    const d = r.def;
    const lv = G.statLv(r.tier, d.id);
    const maxed = G.statMax(r.tier, d.id);
    setFrame(r.icon, d.icon, 64, 64);

    r.name.string = t(d.name, G.lang);
    r.desc.string = maxed ? t('maxed', G.lang) : statDesc(d, r.tier);
    r.lv.string = t('level', G.lang) + ' ' + lv + '/' + d.max;
    tint(r.lv, maxed ? '#8CE7A2' : '#8FA3BC');
    r.lvBar.set(Math.min(1, lv / Math.max(1, d.max)));

    const cost = G.statCost(r.tier, d.id);
    const afford = G.data.money >= cost;
    if (maxed) {
        r.btnLb.string = t('max', G.lang);
        skinBtn(r.btn, r.btnLb, 'max');
    } else {
        r.btnLb.string = '$' + fmt(cost);
        skinBtn(r.btn, r.btnLb, afford ? 'on' : 'off');
    }
}

/* ------------------------------------------------------------------ *
 *  页 1：瓶子升级（GDD §4.2）
 * ------------------------------------------------------------------ */
export function buildBottleTab(parent: Node): () => void {
    destroyChildren(parent);
    let tier = 0;
    for (let t = 0; t < 7; t++) { if (G.data.bottles[t] > 0) { tier = t; } }

    /* ---- 阶数选择条：7 个带图标的方块，选中金底、未解锁挂小锁 ---- */
    const tierBtns: Array<{ t: number, bg: Sprite, icon: Sprite, lock: Node, lb: Label }> = [];
    for (let t = 0; t < 7; t++) {
        const n = slicedNode(parent, 82, 88, (t - 3) * 88, -46, '#212A38', 'tier' + t);

        const icNode = nd(n, 'ic', 46, 40, 0, 12);
        const icon = setFrame(icNode.addComponent(Sprite), 'bottle/icon_' + TIERS[t].key, 46, 40);

        const lockNode = nd(n, 'lock', 26, 34, 0, 12);
        setFrame(lockNode.addComponent(Sprite), 'stat/locked', 26, 34);

        const lb = label(n, 'T' + (t + 1), 0, -28, 74, 26, { size: 16, color: '#C9D6E6' });
        tierBtns.push({ t, bg: n.getComponent(Sprite)!, icon, lock: lockNode, lb });
        n.on(Node.EventType.TOUCH_END, () => { tier = t; rebuild(); });
    }

    const holder = nd(parent, 'holder', CW, 10, 0, -110, 0.5, 1);

    /* ---- 可刷新引用 ---- */
    let curTier = 0;
    let ownedLb: Label = null!;
    let incLb: Label = null!;
    let succLb: Label = null!;
    let buyInfo: Label = null!;
    let buyPrice: Label = null!;
    let buyBtn: Node = null!;
    let buyBtnLb: Label = null!;
    let statRows: StatRowUI[] = [];

    function refresh() {
        if (!ownedLb || !ownedLb.isValid) { return; }
        const d = TIERS[curTier];
        const n = G.data.bottles[curTier];
        const cap = G.tierCap(curTier);

        for (const tb of tierBtns) {
            const owned = G.data.bottles[tb.t] > 0;
            const cur = tb.t === curTier;
            tint(tb.bg, cur ? '#F2C64B' : (owned ? '#3C4A5F' : '#212A38'));
            tint(tb.lb, cur ? '#1B2334' : (owned ? '#C9D6E6' : '#66738A'));
            tb.icon.node.active = owned;
            tb.lock.active = !owned;
        }

        ownedLb.string = t('owned_n', G.lang).replace('{n}', String(n)).replace('{m}', String(cap));
        incLb.string = '+' + fmt(G.bottleIncome(curTier)) + (G.lang === 'zh' ? '/次' : '/flip');
        succLb.string = (G.lang === 'zh' ? '落地 ' : 'Land ') + Math.round(G.tierSuccess(curTier) * 100) + '%';

        const nextT = G.nextUnlockTier();
        const locked = n === 0 && nextT !== curTier;
        const cost = G.bottleCost(curTier);
        buyInfo.string = locked
            ? t('locked_tier', G.lang)
            : (n === 0 ? t('unlock_bottle', G.lang).replace('{bottle}', G.lang === 'zh' ? d.zh : d.en) : t('buy_bottle', G.lang));
        buyPrice.string = locked ? '—' : '$' + fmt(cost);
        tint(buyPrice, locked ? '#8FA3BC' : (G.data.money >= cost ? '#FFD75E' : '#E8765A'));
        buyBtnLb.string = n >= cap ? t('max', G.lang) : (n === 0 ? t('unlock', G.lang) : t('buy', G.lang));
        skinBtn(buyBtn, buyBtnLb, n >= cap ? 'max' : (!locked && G.data.money >= cost ? 'on' : 'off'));
    }

    function rebuild() {
        curTier = tier;
        destroyChildren(holder);
        statRows = [];
        const d = TIERS[tier];
        let y = 0;

        /* ---- 主卡 ---- */
        const head = roundCard(holder, 0, y - 75, CW, 150, C_CARD_HI, C_LINE);
        const icNode = nd(head, 'ic', 140, 62, -238, 28);
        setFrame(icNode.addComponent(Sprite), 'bottle/icon_' + d.key, 140, 62);
        label(head, (G.lang === 'zh' ? d.zh : d.en), -150, 50, 250, 40,
            { size: 29, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        label(head, t(d.rarity, G.lang), -150, 16, 250, 30,
            { size: 20, color: d.color, hAlign: 'left', anchorX: 0 });
        ownedLb = label(head, '', 310, 50, 180, 34, { size: 23, color: '#C9D6E6', hAlign: 'right', anchorX: 1 });
        incLb = label(head, '', 314, 12, 190, 32, { size: 22, color: '#8CE7A2', hAlign: 'right', anchorX: 1 });
        succLb = label(head, '', 310, -26, 180, 32, { size: 20, color: '#9FB3CC', hAlign: 'right', anchorX: 1 });
        label(head, t('passive', G.lang) + '：' + (G.lang === 'zh' ? d.passiveZh : d.passiveEn),
            -296, -50, 400, 32, { size: 17, color: '#8CE7A2', hAlign: 'left', anchorX: 0 });
        y -= 160;

        /* ---- 购买卡 ---- */
        const buyCard = roundCard(holder, 0, y - 52, CW, 104, '#2A2230', C_LINE);
        buyInfo = label(buyCard, '', -296, 24, 420, 34, { size: 21, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
        buyPrice = label(buyCard, '', -296, -20, 420, 36, { size: 26, color: '#FFD75E', hAlign: 'left', anchorX: 0 });
        buyBtn = button(buyCard, {
            w: 210, h: 80, x: 204, y: 0,
            tex: 'ui/card_white', inset: [30, 30, 30, 30],
            sound: 'buy', name: 'buyBottle',
            onClick: () => {
                if (!G.buyBottle(curTier)) {
                    Toast.I?.show(t('not_enough', G.lang) + (G.lang === 'zh' ? '（金币）' : ' (coins)'), '#FFB0A0');
                    return;
                }
                refresh();
            },
        });
        buyBtnLb = label(buyBtn, '', 0, 2, 190, 52, { size: 26, color: '#FFFFFF' });
        y -= 116;

        /* ---- 词条分区标题 ---- */
        const sec = roundCard(holder, 0, y - 20, CW, 40, '#151D28');
        label(sec, G.lang === 'zh' ? '瓶子词条' : 'Bottle Perks', -296, 0, 300, 30,
            { size: 20, color: '#FFE9A8', hAlign: 'left', anchorX: 0 });
        label(sec, G.lang === 'zh' ? '用金币逐条强化' : 'Upgrade with coins', 296, 0, 300, 30,
            { size: 16, color: '#8FA3BC', hAlign: 'right', anchorX: 1 });
        y -= 48;

        /* ---- 词条行 ---- */
        for (const s of BOTTLE_STATS) {
            statRows.push(makeStatRow(holder, y - 52, tier, s, () => {
                for (const r of statRows) { refreshStatRow(r); }
                refresh();
            }));
            y -= 110;
        }

        const h = Math.abs(y) + 22;
        (holder.getComponent(UITransform) as any).setContentSize(CW, h);
        (parent.getComponent(UITransform) as any).setContentSize(CW + 36, h + 112);
        refresh();
    }

    rebuild();
    return refresh;
}

/* ------------------------------------------------------------------ *
 *  页 2：助手（消耗金币雇佣；容量 / 速度在技能树里用瓶盖升级）
 * ------------------------------------------------------------------ */
export function buildHelperTab(parent: Node): () => void {
    destroyChildren(parent);
    let y = 0;

    const card = roundCard(parent, 0, y - 88, CW, 176, C_CARD_HI, C_LINE);
    const icNode = nd(card, 'ic', 84, 110, -256, 8);
    setFrame(icNode.addComponent(Sprite), 'env/hand', 84, 110);
    const nameLb = label(card, '', -196, 58, 340, 40, { size: 28, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
    const infoLb = label(card, '', -196, -10, 316, 76, {
        size: 18, color: '#9FB3CC', hAlign: 'left', anchorX: 0, overflow: 'clamp',
    });
    infoLb.lineHeight = 24;
    const priceLb = label(card, '', 316, 58, 180, 36, { size: 23, color: '#FFD75E', hAlign: 'right', anchorX: 1 });
    const hireBtn = button(card, {
        w: 176, h: 78, x: 208, y: -38,
        tex: 'ui/card_white', inset: [30, 30, 30, 30],
        sound: 'buy', name: 'hire',
        onClick: () => {
            if (!G.buyHand()) { Toast.I?.show(t('not_enough', G.lang) + (G.lang === 'zh' ? '（金币）' : ' (coins)'), '#FFB0A0'); return; }
            refreshAll();
        },
    });
    const hireLb = label(hireBtn, '', 0, 2, 158, 48, { size: 24, color: '#FFFFFF' });
    y -= 188;

    const tip = roundCard(parent, 0, y - 66, CW, 132, C_CARD);
    const tipIc = nd(tip, 'ic', 74, 74, -256, 0);
    setFrame(tipIc.addComponent(Sprite), 'ui/icon_skill', 74, 74);
    label(tip, G.lang === 'zh' ? '容量 / 速度 / 恢复' : 'Capacity / Speed / Recovery',
        -196, 32, 320, 36, { size: 22, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
    const tipLb = label(tip, '', -196, -16, 400, 56, {
        size: 16, color: '#9FB3CC', hAlign: 'left', anchorX: 0, overflow: 'clamp',
    });
    tipLb.lineHeight = 22;
    y -= 144;

    const ms = roundCard(parent, 0, y - 54, CW, 108, C_CARD);
    label(ms, G.lang === 'zh' ? '可见手上限' : 'Visible hands', -296, 0, 240, 34,
        { size: 21, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
    const msLb = label(ms, '', 296, 0, 260, 40, { size: 26, color: '#7FE1FF', hAlign: 'right', anchorX: 1 });
    y -= 120;

    const h = Math.abs(y) + 24;
    (parent.getComponent(UITransform) as any).setContentSize(CW + 36, h);

    function refreshAll() {
        const unlocked = G.hasHelper;
        nameLb.string = t('helper_hand', G.lang);
        infoLb.string = unlocked
            ? (G.lang === 'zh'
                ? `自动翻瓶 · 已拥有 ${G.data.hands}/${G.maxHands} 只\n移动速度 ×${G.handSpeed.toFixed(2)} · 恢复速度 ×${G.handRecovery.toFixed(2)}`
                : `Auto flip · ${G.data.hands}/${G.maxHands}\nSpeed ×${G.handSpeed.toFixed(2)} · Recovery ×${G.handRecovery.toFixed(2)}`)
            : t('sk_unlock_hand_d', G.lang);
        const cost = G.handCost();
        const maxed = G.data.hands >= G.maxHands;
        priceLb.string = !unlocked ? '—' : (maxed ? t('max', G.lang) : '$' + fmt(cost));
        tint(priceLb, maxed ? '#8CE7A2' : (G.data.money >= cost ? '#FFD75E' : '#E8765A'));
        hireLb.string = !unlocked ? t('locked', G.lang) : (maxed ? t('max', G.lang) : t('buy_hand', G.lang));
        skinBtn(hireBtn, hireLb, maxed ? 'max' : (unlocked && G.data.money >= cost ? 'on' : 'off'));
        tipLb.string = G.lang === 'zh'
            ? '在「技能树」中用瓶盖解锁：助手之手 → 容量 → 移动速度 / 恢复速度'
            : 'Unlock in the skill tree with caps: Helper → Capacity → Speed / Recovery';
        msLb.string = String(HAND.visibleMax);
    }
    refreshAll();
    return refreshAll;
}

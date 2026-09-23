import { Node, Label, Sprite, UITransform } from 'cc';
import { BOTTLE_STATS, BOTTLE_STAT_VIEW, BottleStatDef, HAND, MACHINE, TIERS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { bar, button, destroyChildren, label, nd, setFrame, tint } from './UIKit';
import { Toast } from './Toast';

export const CW = 648;          // 内容宽

/**
 * 词条的**显示顺序**。
 *
 * ⚠️ 不能用 `BOTTLE_STATS` 的数组顺序直接画 —— 那个下标是存档 `tierStats` 的列号，
 *    重排会让老档的等级错位。`BOTTLE_STAT_VIEW`（GameConfig）只描述顺序：
 *    金币基础收益在最上、悬停翻转在最下（与原版截图一致），中间按解锁顺序排列。
 */
const VIEW_STATS: BottleStatDef[] = (() => {
    const byId: Record<string, BottleStatDef> = {};
    for (const s of BOTTLE_STATS) { byId[s.id] = s; }
    const out: BottleStatDef[] = [];
    for (const id of BOTTLE_STAT_VIEW) { if (byId[id]) { out.push(byId[id]); } }
    // 兜底：万一 VIEW 表漏了某条，补到末尾（不会发生，避免静默丢词条）
    for (const s of BOTTLE_STATS) { if (BOTTLE_STAT_VIEW.indexOf(s.id) < 0) { out.push(s); } }
    return out;
})();

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
/**
 * 科技树节点描述（GDD §5.1）
 * 一级数值 = base + L×step；展示按 unit 分档：
 *   percent → ×100 的百分数   count → 取整   mult → 乘数（{v} 另给「下一级的加成百分比」）
 *   px / seconds / flat → 原值
 */
export function skillDesc(d: { id: string; desc: string; unit: string; base: number; step: number }): string {
    const lv = G.skLv(d.id);
    const cur = d.base + lv * d.step;
    const next = d.base + (lv + 1) * d.step;
    const S = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString());
    const F = (v: number) => (d.unit === 'percent' ? S(v * 100) : d.unit === 'count' ? S(Math.floor(v)) : S(v));
    return t(d.desc, G.lang)
        .replace('{cur}', F(cur))
        .replace('{next}', F(next))
        .replace('{v}', d.unit === 'mult' ? S((next - 1) * 100) : F(cur))
        .replace('{d}', F(Math.abs(d.step)))
        .replace('{cd}', G.cokeCooldown.toFixed(0))
        .replace('{n}', String(G.berserkNeed));
}

/** 落地容差角文案（角度制判定，GDD §3.1-3） */
export function toleranceText(tier: number): string {
    return '±' + G.tierTolerance(tier).toFixed(0) + '°';
}

/**
 * 单瓶词条描述（§4.2 真实矩阵）
 * 效果值 = 等级 × 每级增量；unit 决定展示方式：
 *   percent → +{cur}%   mult → ×{cur}   count/flat → +{cur}   unlock → 纯文案
 */
export function statDesc(d: BottleStatDef, tier: number): string {
    if (d.once) { return t(d.desc, G.lang); }
    const p = d.tiers[Math.min(tier, d.tiers.length - 1)];
    const lv = G.statLv(tier, d.id);
    const cur = lv * p.step;
    const next = (lv + 1) * p.step;
    const S = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString());
    let body = t(d.desc, G.lang);
    if (d.unit === 'percent') {
        body = body.replace('{cur}', S(cur * 100)).replace('{next}', S(next * 100)).replace('{d}', S(p.step * 100));
    } else if (d.unit === 'mult') {
        body = body.replace('{cur}', S(1 + cur)).replace('{next}', S(1 + next)).replace('{d}', S(p.step));
    } else {
        body = body.replace('{cur}', S(cur)).replace('{next}', S(next)).replace('{d}', S(p.step));
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

/**
 * 词条行：图标 / 名称+等级 / 进度条 / 描述 / 价格按钮。
 *
 * ⚠️ 行高本来是 104、行距 110，结果：
 *   - 描述框只有 300×44（2 行），中文长句会把末尾的「）」挤到第二行当孤字，
 *     看起来就是「文本溢出去了」；
 *   - 名称在 y=32、按钮顶在 y=16，两者贴死，按钮底又正好压到卡片下沿。
 * 现在行高 118、行距 128，描述给到 320×54（3 行），按钮与名称之间留 8px。
 */
export function makeStatRow(parent: Node, y: number, tier: number, d: BottleStatDef,
    onChanged: () => void): StatRowUI {
    const card = roundCard(parent, 0, y - 59, CW, 118, C_CARD);

    const icNode = nd(card, 'ic', 64, 64, -268, 0);
    const icon = setFrame(icNode.addComponent(Sprite), d.icon, 64, 64);

    const name = label(card, '', -224, 38, 250, 32, { size: 21, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
    const lvBar = bar(card, 290, 10, -78, 14, '#4FB0E8', '#101722');
    const desc = label(card, '', -224, -24, 320, 54, {
        size: 15, color: '#9FB3CC', hAlign: 'left', anchorX: 0, overflow: 'clamp',
    });
    desc.lineHeight = 20;
    const lv = label(card, '', 224, 42, 180, 26, { size: 16, color: '#8FA3BC', hAlign: 'right', anchorX: 1 });

    const btn = button(card, {
        w: 176, h: 68, x: 224, y: -20,
        tex: 'ui/card_white', inset: [30, 30, 30, 30],
        sound: 'buy', name: 'st_' + d.id,
        onClick: () => {
            if (G.statMax(tier, d.id)) { return; }
            if (!G.tierResearched(tier)) {
                Toast.I?.show(G.lang === 'zh' ? '需先在「瓶子科技」研发该阶瓶子' : 'Research this tier in Bottle Tech first', '#FFD98A');
                return;
            }
            if (!G.upgradeStat(tier, d.id)) {
                const caps = G.statCurrency(d.id) === 'caps';
                Toast.I?.show(t('not_enough', G.lang)
                    + (G.lang === 'zh' ? (caps ? '（瓶盖）' : '（金币）') : (caps ? ' (caps)' : ' (coins)')), '#FFB0A0');
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
    const maxLv = G.statMaxLevel(r.tier, d.id);
    setFrame(r.icon, d.icon, 64, 64);

    r.name.string = t(d.name, G.lang);
    r.desc.string = maxed ? t('maxed', G.lang) : statDesc(d, r.tier);
    r.lv.string = d.once ? '' : (t('level', G.lang) + ' ' + lv + '/' + maxLv);
    tint(r.lv, maxed ? '#8CE7A2' : '#8FA3BC');
    r.lvBar.set(d.once ? (lv > 0 ? 1 : 0) : Math.min(1, lv / Math.max(1, maxLv)));

    const cost = G.statCost(r.tier, d.id);
    const caps = G.statCurrency(d.id) === 'caps';
    const afford = caps ? G.data.caps >= cost : G.data.money >= cost;
    if (!G.tierResearched(r.tier)) {
        // 该阶还没在「瓶子科技」里研发 → 词条按钮直接锁住
        r.btnLb.string = t('locked', G.lang);
        skinBtn(r.btn, r.btnLb, 'off');
    } else if (maxed) {
        r.btnLb.string = t('max', G.lang);
        skinBtn(r.btn, r.btnLb, 'max');
    } else {
        // 瓶盖消耗项（瓶盖收益 / 瓶盖掉落）用 C 前缀区分金币
        r.btnLb.string = (caps ? 'C ' : '$') + fmt(cost);
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
    /* 设施卡（瓶盖机器）：★ 原版是商店设施，$1,000 金币，不是技能树节点 */
    let facDesc: Label = null!;
    let facBtn: Node = null!;
    let facBtnLb: Label = null!;
    let statRows: StatRowUI[] = [];
    /* 分区标题文案：左「瓶子词条 x/12」右「下一阶段 Mx」，由 Drawer 的固定里程碑条补充 */
    let msPerks: Label = null!;
    let msPerksHint: Label = null!;
    /** 上一次「已解锁词条条数」——数量变了要重建列表（里程碑推进时） */
    let shownStats = -1;

    /** 设施卡刷新：未买 → 显示 $1,000 + 购买；已买 → 显示「已安装 · 传送带运转中」 */
    function refreshFacility() {
        if (!facDesc || !facDesc.isValid) { return; }
        const on = G.hasMachine;
        const price = MACHINE.buyPrice;
        facDesc.string = on
            ? (G.lang === 'zh'
                ? '已安装 · 传送带运转中，扣盖弹出的瓶盖会被自动回收入库'
                : 'Installed · the belt auto-collects caps from cap landings')
            : (G.lang === 'zh'
                ? '在桌台下方安装传送带与收集料斗。装好之后扣盖弹出的瓶盖才会被回收成瓶盖存款。'
                : 'Installs the conveyor belt under the desk. Caps only start dropping once it is installed.');
        facDesc.node.active = true;
        if (on) {
            facBtnLb.string = G.lang === 'zh' ? '已安装' : 'Installed';
            skinBtn(facBtn, facBtnLb, 'max');
        } else {
            // 一次性买断价用千分位原样显示（$1,000），跟原版截图一致；
            // 其它递增价格仍走 fmt() 的 K/M 缩写，保持 HUD 口径统一
            facBtnLb.string = '$' + String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            skinBtn(facBtn, facBtnLb, G.data.money >= price ? 'on' : 'off');
        }
    }

    function refresh() {
        if (!ownedLb || !ownedLb.isValid) { return; }
        // ★ 里程碑推进会导致「可见词条数」变化 → 整块重建（开局只有 2 条）
        if (G.statUnlockedCount !== shownStats) { rebuild(); return; }
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
        // 角度制判定：展示落地容差角（±18° × (1+0.1×精通)）
        succLb.string = (G.lang === 'zh' ? '容差 ' : 'Tol. ') + toleranceText(curTier);

        const locked = !G.tierResearched(curTier);
        const cost = G.bottleCost(curTier);
        buyInfo.string = locked
            ? t('locked_tier', G.lang)
            : (n === 0 ? t('unlock_bottle', G.lang).replace('{bottle}', G.lang === 'zh' ? d.zh : d.en) : t('buy_bottle', G.lang));
        buyPrice.string = locked ? '—' : (cost === 0 ? (G.lang === 'zh' ? '免费自带' : 'Free') : '$' + fmt(cost));
        tint(buyPrice, locked ? '#8FA3BC' : (G.data.money >= cost ? '#FFD75E' : '#E8765A'));
        buyBtnLb.string = n >= cap ? t('max', G.lang) : (n === 0 ? t('unlock', G.lang) : t('buy', G.lang));
        skinBtn(buyBtn, buyBtnLb, n >= cap ? 'max' : (!locked && G.data.money >= cost ? 'on' : 'off'));
        refreshFacility();

        // 分区标题：已解锁 / 总数 + 下一阶段
        if (msPerks && msPerks.isValid) {
            const next = G.msNext;
            msPerks.string = t('ms_perks', G.lang)
                .replace('{n}', String(shownStats)).replace('{m}', String(VIEW_STATS.length));
            msPerksHint.string = next
                ? t('ms_next', G.lang) + ' M' + next.n
                : t('ms_max', G.lang);
        }
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

        /* ---- 设施卡：瓶盖机器（★ 原版的商店设施，$1,000 金币） ----
         * 没买之前桌台下方什么都没有（CapMachine 整节点隐藏），扣盖也完全不产出瓶盖，
         * 所以这张卡是前期经济的关键一步。 */
        const fac = roundCard(holder, 0, y - 58, CW, 116, '#20242E', C_LINE);
        const facIc = nd(fac, 'ic', 78, 80, -256, 4);
        setFrame(facIc.addComponent(Sprite), 'env/machine', 78, 80);
        label(fac, t('cap_machine', G.lang), -196, 32, 320, 34,
            { size: 23, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        facDesc = label(fac, '', -196, -18, 322, 50, {
            size: 15, color: '#9FB3CC', hAlign: 'left', anchorX: 0, overflow: 'clamp',
        });
        facDesc.lineHeight = 20;
        facBtn = button(fac, {
            w: 176, h: 74, x: 224, y: 0,
            tex: 'ui/card_white', inset: [30, 30, 30, 30],
            sound: 'buy', name: 'buyMachine',
            onClick: () => {
                if (G.hasMachine) { return; }
                if (!G.buyMachine()) {
                    Toast.I?.show(t('not_enough', G.lang) + (G.lang === 'zh' ? '（金币）' : ' (coins)'), '#FFB0A0');
                    return;
                }
                Toast.I?.show(t('machine_installed', G.lang), '#8CE7A2');
                refreshFacility();
            },
        });
        facBtnLb = label(facBtn, '', 0, 2, 158, 48, { size: 23, color: '#FFFFFF' });
        y -= 128;

        /* ---- 词条分区标题 ---- */
        const sec = roundCard(holder, 0, y - 20, CW, 40, '#151D28');
        msPerks = label(sec, '', -296, 0, 380, 30,
            { size: 20, color: '#FFE9A8', hAlign: 'left', anchorX: 0 });
        msPerksHint = label(sec, '', 296, 0, 300, 30,
            { size: 16, color: '#8FA3BC', hAlign: 'right', anchorX: 1 });
        y -= 48;

        /* ---- 词条行（行高 118 + 行距 128，见 makeStatRow 注释）
         *      ★ 里程碑门控：没解锁的整条不画（开局 = 2 条） ---- */
        for (const s of VIEW_STATS) {
            if (!G.statUnlocked(s.id)) { continue; }
            statRows.push(makeStatRow(holder, y - 59, tier, s, () => {
                for (const r of statRows) { refreshStatRow(r); }
                refresh();
            }));
            y -= 128;
        }
        shownStats = statRows.length;

        /* ---- 未解锁提示：告诉玩家还差几条、下一个里程碑是几阶 ---- */
        const leftNs = VIEW_STATS.filter((s) => !G.statUnlocked(s.id)).map((s) => s.ms);
        if (leftNs.length > 0) {
            const tipCard = roundCard(holder, 0, y - 26, CW, 52, '#161E2A');
            label(tipCard, t('ms_perks_lock', G.lang)
                .replace('{n}', String(leftNs.length))
                .replace('{m}', String(Math.min.apply(null, leftNs))),
                -296, 0, 600, 32, { size: 17, color: '#8FA3BC', hAlign: 'left', anchorX: 0 });
            y -= 64;
        }

        // 末尾多留 28px：滚到底时最后一行不会贴着遮罩边缘被裁半边
        const h = Math.abs(y) + 28;
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
        // 已覆盖阶数（§5.1 分支 3 的六张自动化许可，T1 天生允许）
        const ok: string[] = [];
        for (let t = 0; t < 7; t++) { if (G.helperAllowed(t)) { ok.push('T' + (t + 1)); } }
        tipLb.string = G.lang === 'zh'
            ? `机械手可翻阶数：${ok.join(' ')}\n在「助手科技」用瓶盖研发：解锁 → 上限扩充 → 各阶自动化许可`
            : `Hands can flip: ${ok.join(' ')}\nResearch in Helper Tech: unlock → limit → tier permits`;
        msLb.string = String(HAND.visibleMax);
    }
    refreshAll();
    return refreshAll;
}

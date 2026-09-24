import { HAND, MACHINE, TIERS } from '../Core/GameConfig';
import { G, SKILL_BY_ID, UNLOCK_SKILL } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { Toast } from './Toast';
import { Ads } from './Ads';

/**
 * 购买引导（Guidance）—— 把「点不动」的原因说清楚，并给出可执行的去处。
 *
 * 背景（用户反馈原话：「未解锁的选项点击的时候提示却是金币不足，引导性不足，
 * 还有就是目前我貌似没法顺利解锁下一个选项，资源循环貌似有卡盾」）：
 * 原来所有失败分支都甩一句「资源不足（金币）」，玩家既不知道缺的是金币还是瓶盖、
 * 差多少，也不知道该去哪补 —— 于是把「还没研发」误读成「买不起」，
 * 以为整个循环卡死了。
 *
 * 这里只做三件事：
 *   ① 差额提示：`moneyShortToast` / `capsShortToast` 报出**还差多少**；
 *   ② 去处提示：`tierResearchToast` / `helperResearchToast` / `machineToast`
 *      说清要去哪个面板、花多少瓶盖，并**直接跳过去**（跳转靠 GameRoot 注入的桥）；
 *   ③ `nextGoalText()`：当前「最该做的一件事」，商城面板顶部常驻显示。
 *
 * ⚠️ 跳转用注入而不是直接 import —— SkillPanel 反向依赖 DrawerContent（skillDesc），
 *    Guidance 若再 import 两者会形成 ESM 循环依赖，Cocos 打包后可能拿到 undefined。
 */

/* ------------------------------------------------------------------ *
 *  导航桥（GameRoot 注入）
 * ------------------------------------------------------------------ */
export interface NavBridge {
    /** 打开技能树面板（page：0 瓶子 / 1 玩家 / 2 助手 / 3 特殊技能） */
    openTree: (page: number) => void;
    /** 收起商城面板（含遮罩一起收） */
    closeShop: () => void;
}

export const TREE_PAGE = { bottle: 0, player: 1, helper: 2, ability: 3 };

let bridge: NavBridge | null = null;

export function registerNav(b: NavBridge) { bridge = b; }

/** 先收起商城面板，再打开技能树对应页签 */
export function jumpToTree(page: number) {
    if (!bridge) { return; }
    bridge.closeShop();
    bridge.openTree(page);
}

/* ------------------------------------------------------------------ *
 *  差额提示
 * ------------------------------------------------------------------ */
function gapText(need: number, have: number, key: string): string {
    const gap = Math.max(0, Math.ceil(need - have));
    return t(key, G.lang).replace('{n}', fmt(gap));
}

/** 金币不够：报出差额（而不是笼统的「资源不足」） */
export function moneyShortToast(need: number) {
    Toast.I?.show(gapText(need, G.data.money, 'short_money'), '#FFB0A0');
}

/** 瓶盖不够：报出差额 */
export function capsShortToast(need: number) {
    Toast.I?.show(gapText(need, G.data.caps, 'short_caps'), '#FFB0A0');
}

/**
 * 金币不够 → **直接拉广告**（Ads 统一入口，★ 无二级确认窗）：
 * 点了带广告图标的选项就立刻播激励视频，看完补足到刚好够买
 * 并自动执行 `retry` —— 即「看完广告给货，不扣材料（金币）」。
 */
export function moneyShortAd(need: number, retry?: () => void) {
    Ads.I.show('money_gap', () => {
        const gap = Math.max(0, Math.ceil(need - G.data.money));
        if (gap > 0) {
            G.data.money += gap;
            G.data.stats.earned += gap;
            G.save();
            G.notify();
        }
        if (retry) { retry(); }
    });
}

/**
 * 瓶盖不够 → 同款**直接拉广告**（无二级确认窗）：看完补足瓶盖并自动执行 `retry` 给货。
 * 用于研发 / 科技节点 / 瓶盖词条等瓶盖消耗项。
 */
export function capsShortAd(need: number, retry?: () => void) {
    Ads.I.show('caps_gap', () => {
        const gap = Math.max(0, Math.ceil(need - G.data.caps));
        if (gap > 0) {
            G.data.caps += gap;
            G.save();
            G.notify();
        }
        if (retry) { retry(); }
    });
}

/* ------------------------------------------------------------------ *
 *  「没研发 / 没买设施」→ 说清去处并跳过去
 * ------------------------------------------------------------------ */

/** 研发某个技能节点的完整引导语（含技能树页签名与瓶盖价） */
export function researchText(id: string, treeKey: string): string {
    const def = SKILL_BY_ID[id];
    // ⚠️ 技能名是给树节点**卡片排版**用的：T2~T7 写成「研发 T2\n铜质能量瓶」（含换行）。
    //    直接塞进单行提示会变成「去研发『研发 T2 铜质能量瓶』」—— 重复且带换行，
    //    所以有 `tier` 的节点一律改用瓶子的名字（铜质能量瓶）。
    const name = def
        ? (def.tier ? TIERS[def.tier].zh : t(def.name, G.lang).replace(/\n/g, ' '))
        : id;
    const cost = def ? fmt(def.baseCost) : '?';
    return t('research_in_tree', G.lang)
        .replace('{tree}', t(treeKey, G.lang))
        .replace('{name}', name)
        .replace('{cost}', cost);
}

/** 该阶瓶子还没在「瓶子科技」研发 → 提示 + 跳到瓶子科技页 */
export function tierResearchToast(tier: number, jump = true) {
    const id = UNLOCK_SKILL[tier];
    if (!id) { return; }
    Toast.I?.show(researchText(id, 'tree_page_bottle'), '#FFD98A');
    if (jump) { jumpToTree(TREE_PAGE.bottle); }
}

/** 助手还没解锁 → 提示 + 跳到助手科技页 */
export function helperResearchToast(jump = true) {
    Toast.I?.show(researchText('h_unlock', 'tree_page_helper'), '#FFD98A');
    if (jump) { jumpToTree(TREE_PAGE.helper); }
}

/** 瓶盖机器是商店设施（$1,000 金币），不是技能树节点 */
export function machineToast() {
    Toast.I?.show(t('need_machine', G.lang), '#FFD98A');
}

/* ------------------------------------------------------------------ *
 *  「下一步」—— 面板顶部常驻的一行引导
 * ------------------------------------------------------------------ */

/**
 * 当前最该做的一件事。优先级：
 *   ① 还没买瓶盖机器（没它就完全不产瓶盖，后面全部卡死）
 *   ② 还有没研发的阶数（= 用户说的「下一个选项」）
 *   ③ 助手没解锁
 *   ④ 助手解锁了但一只都没雇
 */
export function nextGoalText(): string {
    if (!G.hasMachine) { return t('goal_machine', G.lang); }

    // 「研发了但一只都没买」是另一个易卡点：玩家会以为研发完就该出现瓶子了，
    // 实际上研发只是解锁**购买资格**，还要再花金币买一只才会出现在桌面上。
    for (let i = 1; i < 7; i++) {
        if (G.tierResearched(i) && G.data.bottles[i] === 0) {
            return t('goal_buy_tier', G.lang)
                .replace('{t}', String(i + 1))
                .replace('{name}', TIERS[i].zh)
                .replace('{cost}', fmt(G.bottleCost(i)));
        }
    }

    const nt = G.nextUnlockTier();
    if (nt > 0) {
        const def = SKILL_BY_ID[UNLOCK_SKILL[nt]];
        return t('goal_research', G.lang)
            .replace('{cost}', def ? fmt(def.baseCost) : '?')
            .replace('{t}', String(nt + 1))
            // 同样用瓶子名而不是技能卡片的「研发 T2\n铜质能量瓶」（见 researchText 注释）
            .replace('{name}', TIERS[nt].zh);
    }

    if (!G.hasHelper) {
        const def = SKILL_BY_ID['h_unlock'];
        return t('goal_helper', G.lang).replace('{cost}', def ? fmt(def.baseCost) : '?');
    }
    if (G.data.hands < 1) {
        return t('goal_helper_buy', G.lang).replace('{cost}', fmt(HAND.price));
    }
    return t('goal_done', G.lang);
}

/** 瓶盖机器的采购价（供面板/提示复用，避免各处写死 1000） */
export const MACHINE_PRICE = MACHINE.buyPrice;

/** 供无头验收脚本读取，方便断言引导文案 */
export function debugGoal() {
    return {
        goal: nextGoalText(),
        hasMachine: G.hasMachine,
        hasHelper: G.hasHelper,
        nextTier: G.nextUnlockTier(),
        caps: Math.floor(G.data.caps),
        money: Math.floor(G.data.money),
    };
}

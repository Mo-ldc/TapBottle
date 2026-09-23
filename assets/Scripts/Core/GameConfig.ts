/**
 * GameConfig —— 静态配置数据表
 * 数值来源：GDD_Bottle_Flip_Inc_Cocos.md（单一真理源）
 *  - 七阶瓶子规格：§4.1
 *  - 单瓶升级词条：§4.2（8 个维度）
 *  - 三大终极技能：§5.1
 *  - 助手系统：§6
 *  - 竖屏布局：§2.2 / §7.1
 */

export const DESIGN_W = 720;
export const DESIGN_H = 1280;

/** 基础金币倍率的基准值（GDD 中为倍率，这里换算成实际金币） */
export const BASE_INCOME = 12;

/* ================================================================== *
 *  七阶瓶子（GDD §4.1）
 * ================================================================== */
export interface TierDef {
    tier: number;
    key: string;
    zh: string;
    en: string;
    rarity: string;         // 稀有度文案 key
    color: string;
    art: number;            // 瓶身贴图索引 bottle/body_{art}
    mult: number;           // 基础金币倍率
    unlockCost: number;     // 解锁（首只）价格
    growth: number;         // 同阶追加购买价格增长
    success: number;        // 默认着陆成功率
    cap: number;            // 默认最大拥有上限
    passiveZh: string;
    passiveEn: string;
}

export const RARITY_COLOR: Record<string, string> = {
    Common: '#9BA7B4',
    Rare: '#C2803F',
    Epic: '#BFCBD6',
    Legendary: '#F0C24B',
    Mythic: '#E8556D',
    Divine: '#3FCF86',
    Celestial: '#59D6F2',
};

export const TIERS: TierDef[] = [
    {
        tier: 0, key: 'classic', zh: '普通塑料瓶', en: 'Common Bottle', rarity: 'Common', color: RARITY_COLOR.Common,
        art: 0, mult: 1.0, unlockCost: 0, growth: 1.14, success: 0.35, cap: 3,
        passiveZh: '基础款，易翻转', passiveEn: 'Starter bottle',
    },
    {
        tier: 1, key: 'bronze', zh: '铜质能量瓶', en: 'Bronze Energy Bottle', rarity: 'Rare', color: RARITY_COLOR.Rare,
        art: 1, mult: 3.5, unlockCost: 1000, growth: 1.15, success: 0.38, cap: 4,
        passiveZh: '扣盖金币加成 +25%', passiveEn: 'Cap landing coins +25%',
    },
    {
        tier: 2, key: 'silver', zh: '白银汽水瓶', en: 'Silver Soda Bottle', rarity: 'Epic', color: RARITY_COLOR.Epic,
        art: 2, mult: 12.0, unlockCost: 25000, growth: 1.16, success: 0.42, cap: 5,
        passiveZh: '额外 +10% 连续翻转率', passiveEn: '+10% flip again chance',
    },
    {
        tier: 3, key: 'gold', zh: '黄金尊享瓶', en: 'Gold Premium Bottle', rarity: 'Legendary', color: RARITY_COLOR.Legendary,
        art: 3, mult: 45.0, unlockCost: 500000, growth: 1.17, success: 0.46, cap: 6,
        passiveZh: '扣盖时必定额外掉落 1 瓶盖', passiveEn: 'Cap landing always drops +1 cap',
    },
    {
        tier: 4, key: 'ruby', zh: '红宝石烈酒瓶', en: 'Ruby Spirit Bottle', rarity: 'Mythic', color: RARITY_COLOR.Mythic,
        art: 5, mult: 180.0, unlockCost: 1.5e7, growth: 1.18, success: 0.50, cap: 7,
        passiveZh: '狂暴期间收益额外 +50%', passiveEn: 'Berserk income +50%',
    },
    {
        tier: 5, key: 'emerald', zh: '翡翠神圣瓶', en: 'Emerald Divine Bottle', rarity: 'Divine', color: RARITY_COLOR.Divine,
        art: 4, mult: 800.0, unlockCost: 5.0e8, growth: 1.19, success: 0.55, cap: 8,
        passiveZh: '决意值积攒速度 +25%', passiveEn: 'Resolve gain +25%',
    },
    {
        tier: 6, key: 'diamond', zh: '钻石天界瓶', en: 'Diamond Celestial Bottle', rarity: 'Celestial', color: RARITY_COLOR.Celestial,
        art: 6, mult: 3500.0, unlockCost: 2.0e10, growth: 1.20, success: 0.60, cap: 10,
        passiveZh: '全场全瓶子收益 +100%', passiveEn: 'All bottles income +100%',
    },
];

/* ================================================================== *
 *  单瓶升级词条（GDD §4.2）—— 8 个维度，消耗金币
 * ================================================================== */
export interface BottleStatDef {
    id: string;
    name: string;           // 文案 key
    desc: string;
    icon: string;
    max: number;
    baseCost: number;
    growth: number;
    step: number;
    unit: 'percent' | 'count' | 'pp' | 'flat';
}

export const BOTTLE_STATS: BottleStatDef[] = [
    { id: 'income', name: 'bs_income', desc: 'bs_income_d', icon: 'stat/income', max: 200, baseCost: 60, growth: 1.28, step: 0.25, unit: 'percent' },
    { id: 'bonus', name: 'bs_bonus', desc: 'bs_bonus_d', icon: 'stat/bonus', max: 40, baseCost: 150, growth: 1.32, step: 0.08, unit: 'percent' },
    { id: 'speed', name: 'bs_speed', desc: 'bs_speed_d', icon: 'stat/flipspeed', max: 20, baseCost: 200, growth: 1.34, step: 0.04, unit: 'percent' },
    { id: 'capgain', name: 'bs_capgain', desc: 'bs_capgain_d', icon: 'stat/capgain', max: 20, baseCost: 260, growth: 1.34, step: 1, unit: 'flat' },
    { id: 'limit', name: 'bs_limit', desc: 'bs_limit_d', icon: 'stat/buyable', max: 10, baseCost: 4000, growth: 2.40, step: 1, unit: 'count' },
    { id: 'mastery', name: 'bs_mastery', desc: 'bs_mastery_d', icon: 'stat/mastery', max: 25, baseCost: 120, growth: 1.30, step: 0.02, unit: 'pp' },
    { id: 'double', name: 'bs_double', desc: 'bs_double_d', icon: 'stat/plusincome', max: 15, baseCost: 500, growth: 1.36, step: 0.02, unit: 'percent' },
    { id: 'again', name: 'bs_again', desc: 'bs_again_d', icon: 'stat/chance', max: 12, baseCost: 700, growth: 1.38, step: 0.02, unit: 'percent' },
];

/** 高阶瓶子的升级更贵：按阶数放大 */
export function tierCostScale(tier: number): number { return Math.pow(14, tier); }

/* ================================================================== *
 *  科技树（消耗瓶盖，GDD §5）
 * ================================================================== */
export type TreeId = 'bottle' | 'player' | 'helper' | 'ability';
/**
 * 数值展示单位：
 *  flat  → 直接显示数值        percent → 显示为 +v%
 *  mult  → 显示为 +(v-1)%      size    → 显示为 ×v
 *  count → 整数个数            seconds → 秒
 *  unlock→ 解锁型
 */
export type SkillUnit = 'flat' | 'percent' | 'mult' | 'size' | 'count' | 'seconds' | 'unlock';

export interface SkillDef {
    id: string;
    tree: TreeId;
    name: string;
    desc: string;
    icon: string;
    max: number;
    baseCost: number;
    growth: number;
    base: number;
    step: number;
    unit: SkillUnit;
    unlockId?: string;
}

export const SKILLS: SkillDef[] = [
    /* ---- 根节点：技能树正中，最先解锁（免费） ---- */
    { id: 'sk_root', tree: 'bottle', name: 'sk_root', desc: 'sk_root_d', icon: 'bottle/icon_classic', max: 1, baseCost: 0, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'root' },

    /* ---- 瓶子科技（全局增益） ---- */
    { id: 'g_bonus', tree: 'bottle', name: 'sk_bonus', desc: 'sk_bonus_d', icon: 'stat/bonus', max: 40, baseCost: 30, growth: 1.30, base: 0, step: 0.05, unit: 'percent' },
    { id: 'g_crit', tree: 'bottle', name: 'sk_crit', desc: 'sk_crit_d', icon: 'stat/plusincome', max: 20, baseCost: 60, growth: 1.32, base: 0.18, step: 0.02, unit: 'percent' },
    { id: 'g_critmoney', tree: 'bottle', name: 'sk_critmoney', desc: 'sk_critmoney_d', icon: 'stat/income', max: 25, baseCost: 80, growth: 1.34, base: 5, step: 0.4, unit: 'flat' },
    { id: 'g_capgain', tree: 'bottle', name: 'sk_capgain', desc: 'sk_capgain_d', icon: 'stat/capgain', max: 20, baseCost: 50, growth: 1.32, base: 1, step: 1, unit: 'flat' },

    /* ---- 玩家科技 ---- */
    { id: 'p_cursor', tree: 'player', name: 'sk_cursor', desc: 'sk_cursor_d', icon: 'env/cursor', max: 1, baseCost: 25, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'cursor' },
    { id: 'p_cursorsize', tree: 'player', name: 'sk_cursorsize', desc: 'sk_cursorsize_d', icon: 'stat/size', max: 10, baseCost: 20, growth: 1.45, base: 1.0, step: 0.12, unit: 'size' },
    { id: 'p_idle', tree: 'player', name: 'sk_idle', desc: 'sk_idle_d', icon: 'stat/time', max: 1, baseCost: 120, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'idle' },
    { id: 'p_idletime', tree: 'player', name: 'sk_idletime', desc: 'sk_idletime_d', icon: 'stat/duration', max: 12, baseCost: 60, growth: 1.45, base: 30, step: 5, unit: 'seconds' },
    { id: 'p_idlerecov', tree: 'player', name: 'sk_idlerecovery', desc: 'sk_idlerecovery_d', icon: 'stat/recovery', max: 10, baseCost: 70, growth: 1.48, base: 1.0, step: 0.12, unit: 'size' },
    { id: 'p_conveyor', tree: 'player', name: 'sk_conveyor', desc: 'sk_conveyor_d', icon: 'env/belt', max: 12, baseCost: 90, growth: 1.48, base: 1.0, step: 0.08, unit: 'size' },
    { id: 'p_gate', tree: 'player', name: 'sk_gate', desc: 'sk_gate_d', icon: 'stat/unlock', max: 1, baseCost: 260, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'gate' },
    { id: 'p_gatechance', tree: 'player', name: 'sk_gatechance', desc: 'sk_gatechance_d', icon: 'stat/chance', max: 10, baseCost: 140, growth: 1.5, base: 0.10, step: 0.03, unit: 'percent' },
    { id: 'p_machine', tree: 'player', name: 'sk_machine', desc: 'sk_machine_d', icon: 'env/machine', max: 1, baseCost: 180, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'machine' },

    /* ---- 助手科技 ---- */
    { id: 'h_unlock', tree: 'helper', name: 'sk_unlock_hand', desc: 'sk_unlock_hand_d', icon: 'env/hand', max: 1, baseCost: 60, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'helper' },
    { id: 'h_max', tree: 'helper', name: 'sk_maxhand', desc: 'sk_maxhand_d', icon: 'stat/size', max: 12, baseCost: 50, growth: 1.55, base: 1, step: 1, unit: 'count' },
    { id: 'h_speed', tree: 'helper', name: 'sk_movespeed', desc: 'sk_movespeed_d', icon: 'stat/movespeed', max: 20, baseCost: 40, growth: 1.42, base: 1.0, step: 0.08, unit: 'size' },
    { id: 'h_recovery', tree: 'helper', name: 'sk_recovery', desc: 'sk_recovery_d', icon: 'stat/recovery', max: 15, baseCost: 55, growth: 1.45, base: 1.0, step: 0.10, unit: 'size' },

    /* ---- 特殊技能 ---- */
    { id: 'a_coke', tree: 'ability', name: 'sk_coke', desc: 'sk_coke_d', icon: 'ability/flyingcoke', max: 1, baseCost: 200, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'flyingcoke' },
    { id: 'a_cokecd', tree: 'ability', name: 'sk_cokecd', desc: 'sk_cokecd_d', icon: 'stat/duration', max: 9, baseCost: 120, growth: 1.5, base: 60, step: -5, unit: 'seconds' },
    { id: 'a_cokecount', tree: 'ability', name: 'sk_cokecount', desc: 'sk_cokecount_d', icon: 'stat/flipcount', max: 2, baseCost: 300, growth: 1.8, base: 1, step: 1, unit: 'count' },
    { id: 'a_berserk', tree: 'ability', name: 'sk_berserk', desc: 'sk_berserk_d', icon: 'ability/berserk', max: 1, baseCost: 400, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'berserk' },
    { id: 'a_berserkneed', tree: 'ability', name: 'sk_berserkneed', desc: 'sk_berserkneed_d', icon: 'stat/chance', max: 1, baseCost: 900, growth: 1, base: 3, step: -1, unit: 'count' },
    { id: 'a_berserkflips', tree: 'ability', name: 'sk_berserkflips', desc: 'sk_berserkflips_d', icon: 'stat/flipcount', max: 10, baseCost: 160, growth: 1.5, base: 15, step: 5, unit: 'count' },
    { id: 'a_berserkinc', tree: 'ability', name: 'sk_berserkinc', desc: 'sk_berserkinc_d', icon: 'stat/bonus', max: 12, baseCost: 220, growth: 1.55, base: 3.0, step: 0.75, unit: 'mult' },
    { id: 'a_samurai', tree: 'ability', name: 'sk_samurai', desc: 'sk_samurai_d', icon: 'ability/samurai', max: 1, baseCost: 700, growth: 1, base: 0, step: 1, unit: 'unlock', unlockId: 'samurai' },
    { id: 'a_samuraidur', tree: 'ability', name: 'sk_samuraidur', desc: 'sk_samuraidur_d', icon: 'stat/duration', max: 8, baseCost: 260, growth: 1.55, base: 6, step: 2, unit: 'seconds' },
    { id: 'a_samuraigauge', tree: 'ability', name: 'sk_samuraigauge', desc: 'sk_samuraigauge_d', icon: 'stat/resolve', max: 8, baseCost: 300, growth: 1.55, base: 1.0, step: 0.2, unit: 'size' },
];

export const TREE_ZH: Record<TreeId, string> = { bottle: '瓶子科技', player: '玩家科技', helper: '助手科技', ability: '特殊技能' };
export const TREE_EN: Record<TreeId, string> = { bottle: 'Bottle', player: 'Player', helper: 'Helper', ability: 'Abilities' };

/* ------------------------------------------------------------------ *
 *  技能树「节点图」拓扑（参考 Bottle Flip Inc 的原版技能树）
 *   col / row 是网格坐标：col 向右为正，row 向上为正
 *   parent = null 表示该页的入口节点
 * ------------------------------------------------------------------ */
export interface SkillNodeDef {
    id: string;
    icon: string;
    col: number;
    row: number;
    parent: string | null;
}

/** 页 1：瓶子科技（中心 = 最先解锁的根节点） */
export const SKILL_GRAPH: SkillNodeDef[] = [
    { id: 'sk_root', icon: 'bottle/icon_classic', col: 0, row: 0, parent: null },

    // 上左：瓶子收益线
    { id: 'g_bonus', icon: 'stat/bonus', col: -1, row: 1, parent: 'sk_root' },
    { id: 'g_crit', icon: 'stat/plusincome', col: -2, row: 2, parent: 'g_bonus' },
    { id: 'g_critmoney', icon: 'stat/income', col: -2, row: 3, parent: 'g_crit' },

    // 上右：瓶盖产量 → 履带机器线
    { id: 'g_capgain', icon: 'stat/capgain', col: 1, row: 1, parent: 'sk_root' },
    { id: 'p_machine', icon: 'env/machine', col: 2, row: 2, parent: 'g_capgain' },
    { id: 'p_conveyor', icon: 'env/belt', col: 2, row: 3, parent: 'p_machine' },
    { id: 'p_gatechance', icon: 'stat/chance', col: 2, row: 4, parent: 'p_conveyor' },
    { id: 'p_gate', icon: 'stat/unlock', col: 1, row: 5, parent: 'p_gatechance' },

    // 下左：助手线
    { id: 'h_unlock', icon: 'env/hand', col: -1, row: -1, parent: 'sk_root' },
    { id: 'h_max', icon: 'stat/size', col: -2, row: -2, parent: 'h_unlock' },
    { id: 'h_speed', icon: 'stat/movespeed', col: -2, row: -3, parent: 'h_max' },
    { id: 'h_recovery', icon: 'stat/recovery', col: -1, row: -4, parent: 'h_speed' },

    // 下右：光标 / 放置线
    { id: 'p_cursor', icon: 'env/cursor', col: 1, row: -1, parent: 'sk_root' },
    { id: 'p_cursorsize', icon: 'stat/size', col: 2, row: -2, parent: 'p_cursor' },
    { id: 'p_idle', icon: 'stat/time', col: 2, row: -3, parent: 'p_cursorsize' },
    { id: 'p_idletime', icon: 'stat/duration', col: 1, row: -4, parent: 'p_idle' },
    { id: 'p_idlerecov', icon: 'stat/recovery', col: 0, row: -5, parent: 'p_idletime' },
];

/** 页 2：特殊技能（row 越大越靠上；入口 a_coke 放在最上面，打开页签就能看到） */
export const ABILITY_GRAPH: SkillNodeDef[] = [
    { id: 'a_coke', icon: 'ability/flyingcoke', col: 0, row: 6, parent: null },
    { id: 'a_cokecd', icon: 'stat/duration', col: -1, row: 5, parent: 'a_coke' },
    { id: 'a_cokecount', icon: 'stat/flipcount', col: 1, row: 5, parent: 'a_coke' },
    { id: 'a_berserk', icon: 'ability/berserk', col: 0, row: 4, parent: 'a_coke' },
    { id: 'a_berserkneed', icon: 'stat/chance', col: -1, row: 3, parent: 'a_berserk' },
    { id: 'a_berserkinc', icon: 'stat/bonus', col: 1, row: 3, parent: 'a_berserk' },
    { id: 'a_berserkflips', icon: 'stat/flipcount', col: 0, row: 2, parent: 'a_berserk' },
    { id: 'a_samurai', icon: 'ability/samurai', col: 0, row: 1, parent: 'a_berserk' },
    { id: 'a_samuraidur', icon: 'stat/duration', col: -1, row: 0, parent: 'a_samurai' },
    { id: 'a_samuraigauge', icon: 'stat/resolve', col: 1, row: 0, parent: 'a_samurai' },
];

/** 技能树节点尺寸（设计像素）—— 5 列 × 最宽 11 行 */
export const NODE_SIZE = 112;
export const NODE_STEP_X = 120;
export const NODE_STEP_Y = 124;

/* ================================================================== *
 *  三大终极技能（GDD §5.1）
 * ================================================================== */
export const ABILITY = {
    coke: { cdBase: 60, cdMin: 15, countMax: 3, flightTime: 4.6 },
    berserk: { needBase: 3, flipsBase: 15, bonusBase: 3.0, bonusMax: 12.0, speedMul: 1.5, pitch: 1.2 },
    samurai: { gaugeMax: 100, gainSuccess: 1, gainCap: 5, incomeBonus: 6.0, freezeTime: 0.9, shakeTime: 0.3 },
};

/* ================================================================== *
 *  助手（GDD §6）
 * ================================================================== */
export const HAND = {
    price: 400,
    priceGrowth: 1.25,
    interval: 1.4,
    visibleMax: 10,
    /** 助手容量里程碑（索引 = h_max 等级）：1 → 30 → 60 → 100（GDD §6.1） */
    maxTable: [1, 8, 30, 38, 46, 54, 60, 70, 80, 90, 96, 100, 100],
};

/* ================================================================== *
 *  瓶盖机器
 * ================================================================== */
export const MACHINE = {
    capUnitBase: 1,
    /** 履带运送速度（设计像素 / 秒）——压慢一点，让带上同时有更多瓶盖在运 */
    beltSpeed: 150,
    /** 瓶盖上带前先从瓶子飞向履带底部入口的时长 */
    flyTime: 0.40,
    /** 履带上同时存在的瓶盖上限（防节点爆炸） */
    maxChips: 46,
    /** 闸门在履带上的位置：0 = 底部入口，1 = 顶部回收口 */
    gateAt: 0.46,
    /** 闸门翻倍倍率 */
    gateMult: 2,
};

/* ================================================================== *
 *  成就（24 项）
 * ================================================================== */
export interface AchDef { id: number; title: string; desc: string; }
export const ACHIEVEMENTS: AchDef[] = [
    { id: 1, title: 'AchTitle1', desc: 'AchDesc1' },
    { id: 2, title: 'AchTitle2', desc: 'AchDesc2' },
    { id: 3, title: 'AchTitle3', desc: 'AchDesc3' },
    { id: 4, title: 'AchTitle4', desc: 'AchDesc4' },
    { id: 5, title: 'AchTitle5', desc: 'AchDesc5' },
    { id: 6, title: 'AchTitle6', desc: 'AchDesc6' },
    { id: 7, title: 'AchTitle7', desc: 'AchDesc7' },
    { id: 8, title: 'AchTitle8', desc: 'AchDesc8' },
    { id: 9, title: 'AchTitle9', desc: 'AchDesc9' },
    { id: 10, title: 'AchTitle10', desc: 'AchDesc10' },
    { id: 11, title: 'AchTitle11', desc: 'AchDesc11' },
    { id: 12, title: 'AchTitle12', desc: 'AchDesc12' },
    { id: 13, title: 'AchTitle13', desc: 'AchDesc13' },
    { id: 14, title: 'AchTitle14', desc: 'AchDesc14' },
    { id: 15, title: 'AchTitle15', desc: 'AchDesc15' },
    { id: 16, title: 'AchTitle16', desc: 'AchDesc16' },
    { id: 17, title: 'AchTitle17', desc: 'AchDesc17' },
    { id: 18, title: 'AchTitle18', desc: 'AchDesc18' },
    { id: 19, title: 'AchTitle19', desc: 'AchDesc19' },
    { id: 20, title: 'AchTitle20', desc: 'AchDesc20' },
    { id: 21, title: 'AchTitle21', desc: 'AchDesc21' },
    { id: 22, title: 'AchTitle22', desc: 'AchDesc22' },
    { id: 23, title: 'AchTitle23', desc: 'AchDesc23' },
    { id: 24, title: 'AchTitle24', desc: 'AchDesc24' },
];

/* ================================================================== *
 *  竖屏四段式布局（GDD §2.2 / §7.1）
 *   顶部安全区 88 / TopHUD 120 / 主舞台 680 / Tab 导航 100 / 抽屉 380 / 底部安全 64
 * ================================================================== */
export const LAYOUT = {
    /* --- 自适应留白（设计像素）--- */
    safeTop: 90,                     // 屏幕顶 -> 顶部 UI 块上沿
    safeBottom: 110,                 // 屏幕底 -> 底部 UI 块下沿

    hudY: 494,                       // 顶部资源条中心
    hudH: 112,
    stageTop: 438,                   // 资源条下沿

    statusY: 425,                    // 狂暴 / 决意 提示行

    /* --- 中部桌面（居中略偏右，给左侧履带让位） --- */
    tableX: 30,
    tableY: 92,
    tableWidth: 500,
    tableHeight: 640,

    /* --- 左侧竖向瓶盖履带 --- */
    railX: -296,
    railW: 128,
    recycleY: 366,                   // 顶部回收槽中心
    beltTop: 296,                    // 履带上端（回收口）
    beltBottom: -240,                // 履带下端（瓶盖入口）

    /* --- 底部四段 --- */
    quickBuyY: -276,                 // 快捷购买卡
    abilityY: -372,                  // 三大技能条
    staminaY: -424,                  // 放置体力条
    navY: -484,                      // 主导航

    // 抽屉加高后（430 → 600）滚动区从 338 涨到 496，升级列表终于不用一直搓
    drawerH: 600,
    // 顶沿停在 y=+12（露出桌面下半部与瓶盖履带底部）
    drawerOpenY: -288,
    // 收起时抽屉头的上沿要落在底部导航下沿（-530）之下，否则会盖住导航文字
    drawerClosedY: -856,

    /* --- 瓶子排布（世界层绝对设计坐标） --- */
    rowBaseline: [300, 155, 10, -135],
    rowCount: 4,
    colCount: 6,
    rowSpacingX: 80,
    bottleH: 160,
};

/**
 * 自适应锚点（设计坐标系）—— GameRoot.applySafeLayout 用它
 * 把上下两块 UI 钉在屏幕边缘，并把中部舞台填满剩余区域。
 */
export const SAFE_BLOCKS = {
    /** 顶部 UI 块（HUD 条）的上沿 = hudY + hudH/2 */
    topY: 550,
    /** 顶部 UI 块下沿 = hudY - hudH/2，也是中部舞台上沿 */
    topBottomY: 438,
    /** 底部 UI 块上沿（快捷购买卡上沿）= quickBuyY + 42 */
    botTopY: -234,
    /** 底部 UI 块下沿（主导航下沿）= navY - 46 */
    botBottomY: -530,
};

/**
 * 世界内容包络 = 左侧履带 + 桌面 + 瓶子活动区。
 * 自适应缩放/居中都以它为基准，保证「瓶子活动区 + 履带」整体落在屏幕中间。
 */
export const WORLD_ENV = { x0: -364, x1: 284, y0: -262, y1: 440 };

/* ================================================================== *
 *  瓶子自由活动区
 *  桌面就是「翻转后能跳到的随机落点集合」——瓶子每次落地都会重新随机取一个点，
 *  允许互相重叠堆叠（和原版一样，瓶身会叠在一起）。
 *  取值已按瓶身外扩留边（平躺时横向可伸出 ~105px，站立时上下 ~55/105px），
 *  保证瓶子基本都落在桌面范围内。
 * ================================================================== */
export const PLAY_AREA = {
    x0: -105, x1: 165,
    y0: -155, y1: 285,
};

/** 可见瓶子上限（超出的静默结算） */
export const VISIBLE_BOTTLES = 24;

/* ================================================================== *
 *  对象池容量（性能：所有高频特效一律复用节点，绝不运行时 new/destroy）
 * ================================================================== */
export const POOL = {
    /** 履带上同时存在的瓶盖上限 = 池容量，超出直接入账 */
    chip: 72,
    /** 同时存在的飘字上限 */
    floatText: 26,
    /** 瓶盖爆散粒子（一次扣盖最多 12 颗） */
    burst: 72,
    /** 星光 */
    sparkle: 24,
    /** 冲击波 */
    shockwave: 10,
};

/**
 * 瓶盖染色（履带上的瓶盖统一用一张贴图 bottle/capchip_0，
 * 靠 Sprite.color 染色区分品阶——染色是逐顶点数据，不会破坏合批）
 */
export const CHIP_TINT: string[] = [
    '#FFFFFF', '#E8C39A', '#DCE6F0', '#F2C64B', '#E8556D', '#7BE0A8', '#9FE8FF',
];

export const SAVE_KEY = 'tapbottle.save.v1';
export const SAVE_VERSION = 4;

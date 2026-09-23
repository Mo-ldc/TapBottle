/**
 * GameConfig —— 静态配置数据表
 *
 * ★ 数值唯一真理源：GDD_Bottle_Flip_Inc_Cocos_v1.1.md（原版二进制提取的真实数据）
 *  - 七阶瓶子规格：§4.1（GameStatSO_Balanced, PID 769）
 *  - 单瓶 11 大升级词条 × 7 阶真实矩阵：§4.2
 *  - 商店阶梯定价：§4.4
 *  - 四大技能树真实节点：§5.1
 *  - 结算 / 落地判定公式：§3.1 §4.3
 *
 * ⚠️ GDD 自身有两处不一致，这里一律以 §4.2「真实全量参数总矩阵表」为准：
 *  ① §4.5 的举例（Income Base=10 / Speed=80 / Mastery=300…）与 §4.2（40 / 35 / 50）冲突；
 *  ② T4~T7 多行是整齐的 `Base: $10, R: 1.50`，疑似反编译缺失字段的填充值（按原文保留，待复核）。
 */

export const DESIGN_W = 720;
export const DESIGN_H = 1280;

/** T1 单次基础金币（原版 BaseIncome = $1.0，§4.1） */
export const BASE_INCOME = 1.0;

/* ================================================================== *
 *  七阶瓶子（GDD §4.1 —— 全部为原版真实值）
 * ================================================================== */
export interface TierDef {
    tier: number;
    key: string;
    zh: string;
    en: string;
    rarity: string;         // 稀有度文案 key
    color: string;
    art: number;            // 瓶身贴图索引 bottle/body_{art}
    mass: number;           // 质量 1.0~2.5（越重落地越稳，§3.1-2）
    techCost: number;       // 科技树解锁消耗（瓶盖），T1 = 0 自带
    shopBase: number;       // 商店首购金币（§4.4）
    shopGrowth: number;     // 购买价格增长系数 R
    timesIncome: number;    // 收益倍率 TimesIncome
    baseIncome: number;     // 单次基础金币 BaseIncome
    cap: number;            // 同屏默认上限（原版全阶 30）
    hoverCost: number;      // 悬停翻转解锁金币
    critMult: number;       // 扣盖倍率（5.0，T2 铜瓶 6.0）
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
        tier: 0, key: 'classic', zh: '普通塑料瓶', en: 'Classic Bottle', rarity: 'Common', color: RARITY_COLOR.Common,
        art: 0, mass: 1.0, techCost: 0, shopBase: 7, shopGrowth: 1.26,
        timesIncome: 1.0, baseIncome: 1.0, cap: 30, hoverCost: 100, critMult: 5.0,
        passiveZh: '基础款，质量轻、起步翻转', passiveEn: 'Starter bottle, light body',
    },
    {
        tier: 1, key: 'bronze', zh: '铜质能量瓶', en: 'Bronze Energy Bottle', rarity: 'Rare', color: RARITY_COLOR.Rare,
        art: 1, mass: 1.2, techCost: 1600, shopBase: 2000, shopGrowth: 1.20,
        timesIncome: 2.0, baseIncome: 5.0, cap: 30, hoverCost: 6000, critMult: 6.0,
        passiveZh: '扣盖金币基础倍率提升为 6.0×', passiveEn: 'Cap landing multiplier ×6.0',
    },
    {
        tier: 2, key: 'silver', zh: '白银汽水瓶', en: 'Silver Soda Bottle', rarity: 'Epic', color: RARITY_COLOR.Epic,
        art: 2, mass: 1.4, techCost: 4800, shopBase: 3000, shopGrowth: 1.20,
        timesIncome: 3.0, baseIncome: 20.0, cap: 30, hoverCost: 16000, critMult: 5.0,
        passiveZh: '基础收益跃升至 $20，扣盖产出大增', passiveEn: 'Base income jumps to $20',
    },
    {
        tier: 3, key: 'gold', zh: '黄金尊享瓶', en: 'Gold Premium Bottle', rarity: 'Legendary', color: RARITY_COLOR.Legendary,
        art: 3, mass: 1.7, techCost: 10000, shopBase: 50, shopGrowth: 1.10,
        timesIncome: 4.0, baseIncome: 50.0, cap: 30, hoverCost: 10000, critMult: 5.0,
        passiveZh: '扣盖时必定额外掉落 1 枚瓶盖', passiveEn: 'Cap landing always drops +1 cap',
    },
    {
        tier: 4, key: 'ruby', zh: '红宝石烈酒瓶', en: 'Ruby Spirit Bottle', rarity: 'Mythic', color: RARITY_COLOR.Mythic,
        art: 5, mass: 2.0, techCost: 20000, shopBase: 150, shopGrowth: 1.10,
        timesIncome: 5.0, baseIncome: 150.0, cap: 30, hoverCost: 25000, critMult: 5.0,
        passiveZh: '狂暴期间收益额外 +50%', passiveEn: 'Berserk income +50%',
    },
    {
        tier: 5, key: 'emerald', zh: '翡翠神圣瓶', en: 'Emerald Divine Bottle', rarity: 'Divine', color: RARITY_COLOR.Divine,
        art: 4, mass: 2.2, techCost: 45000, shopBase: 500, shopGrowth: 1.10,
        timesIncome: 6.0, baseIncome: 500.0, cap: 30, hoverCost: 100000, critMult: 5.0,
        passiveZh: '决意值积攒速度 +25%', passiveEn: 'Resolve gain +25%',
    },
    {
        tier: 6, key: 'diamond', zh: '钻石天界瓶', en: 'Diamond Celestial Bottle', rarity: 'Celestial', color: RARITY_COLOR.Celestial,
        art: 6, mass: 2.5, techCost: 90000, shopBase: 2500, shopGrowth: 1.10,
        timesIncome: 7.0, baseIncome: 2500.0, cap: 30, hoverCost: 230000, critMult: 5.0,
        passiveZh: '全场所有瓶子总收益永久翻倍', passiveEn: 'All bottles income ×2',
    },
];

/* ================================================================== *
 *  单瓶 11 大升级词条 × 7 阶真实矩阵（GDD §4.2）
 *  价格：Cost(L) = base × r^L
 *  效果：add → base + L×step ；mul → base × (1 + L×step)
 * ================================================================== */
export interface StatTierParam { base: number; max: number; r: number; step: number; }

export interface BottleStatDef {
    id: string;
    name: string;           // 文案 key
    desc: string;
    icon: string;
    unit: 'flat' | 'percent' | 'mult' | 'count' | 'seconds' | 'px' | 'unlock';
    mode: 'add' | 'mul';
    currency: 'money' | 'caps';
    /** 一次性解锁项（悬停翻转模式） */
    once?: boolean;
    /**
     * 解锁门控：需要达到的**里程碑阶段号**（GDD §7 的 24 阶）。
     * 0 = 开局就可见。
     *
     * ★ 原版升级面板开局只有「收入 / 悬停」两条，其余词条随进度逐条开放 ——
     *   这里就把「进度」定义成里程碑，见 `MILESTONES`。
     */
    ms: number;
    tiers: StatTierParam[];
}

/** 11 项升级 + 1 项一次性「悬停翻转」解锁（§4.2 / §4.4-3） */
export const BOTTLE_STATS: BottleStatDef[] = [
    {
        // 一次性：解锁该阶瓶子的「手指悬停即翻转」
        id: 'hover', name: 'bs_hover', desc: 'bs_hover_d', icon: 'env/cursor',
        unit: 'unlock', mode: 'add', currency: 'money', once: true, ms: 0,
        tiers: [100, 6000, 16000, 10000, 25000, 100000, 230000]
            .map(v => ({ base: v, max: 1, r: 1, step: 1 })),
    },
    {
        id: 'purchase', name: 'bs_purchase', desc: 'bs_purchase_d', icon: 'stat/buyable',
        unit: 'percent', mode: 'mul', currency: 'money', ms: 1,
        // 每级把「商店购买价格增长系数」压低 1%
        tiers: [
            { base: 7, max: 30, r: 1.26, step: -0.01 }, { base: 2000, max: 10, r: 1.20, step: -0.01 },
            { base: 3000, max: 10, r: 1.20, step: -0.01 }, { base: 50, max: 10, r: 1.10, step: -0.01 },
            { base: 150, max: 10, r: 1.10, step: -0.01 }, { base: 500, max: 10, r: 1.10, step: -0.01 },
            { base: 2500, max: 10, r: 1.10, step: -0.01 },
        ],
    },
    {
        id: 'income', name: 'bs_income', desc: 'bs_income_d', icon: 'stat/income',
        unit: 'flat', mode: 'add', currency: 'money', ms: 0,
        tiers: [
            { base: 40, max: 20, r: 1.60, step: 1 }, { base: 400, max: 20, r: 1.60, step: 5 },
            { base: 3200, max: 20, r: 1.60, step: 20 }, { base: 1500, max: 20, r: 1.60, step: 1 },
            { base: 4500, max: 20, r: 1.60, step: 1 }, { base: 15000, max: 20, r: 1.60, step: 1 },
            { base: 75000, max: 20, r: 1.60, step: 1 },
        ],
    },
    {
        id: 'capincome', name: 'bs_capincome', desc: 'bs_capincome_d', icon: 'stat/capgain',
        unit: 'flat', mode: 'add', currency: 'caps', ms: 12,
        tiers: [
            { base: 20, max: 10, r: 1.20, step: 1 }, { base: 160, max: 10, r: 1.20, step: 5 },
            { base: 500, max: 10, r: 1.30, step: 20 }, { base: 10, max: 10, r: 1.50, step: 1 },
            { base: 10, max: 10, r: 1.50, step: 1 }, { base: 10, max: 10, r: 1.50, step: 1 },
            { base: 10, max: 10, r: 1.50, step: 1 },
        ],
    },
    {
        id: 'multiplier', name: 'bs_multiplier', desc: 'bs_multiplier_d', icon: 'stat/bonus',
        unit: 'percent', mode: 'mul', currency: 'money', ms: 3,
        tiers: [
            { base: 40, max: 10, r: 1.10, step: 0.10 }, { base: 420, max: 10, r: 1.20, step: 0.10 },
            { base: 700, max: 10, r: 1.30, step: 0.10 }, { base: 100, max: 10, r: 1.00, step: 0.10 },
            { base: 100, max: 10, r: 1.00, step: 0.10 }, { base: 100, max: 10, r: 1.00, step: 0.10 },
            { base: 100, max: 10, r: 1.50, step: 0.10 },
        ],
    },
    {
        id: 'speed', name: 'bs_speed', desc: 'bs_speed_d', icon: 'stat/flipspeed',
        unit: 'mult', mode: 'mul', currency: 'money', ms: 2,
        tiers: [
            { base: 35, max: 10, r: 1.30, step: 0.10 }, { base: 200, max: 10, r: 1.20, step: 0.10 },
            { base: 600, max: 10, r: 1.30, step: 0.10 }, { base: 10, max: 10, r: 1.50, step: 0.10 },
            { base: 10, max: 10, r: 1.50, step: 0.10 }, { base: 10, max: 10, r: 1.50, step: 0.10 },
            { base: 10, max: 10, r: 1.50, step: 0.10 },
        ],
    },
    {
        id: 'capgain', name: 'bs_capgain', desc: 'bs_capgain_d', icon: 'stat/capgain',
        unit: 'count', mode: 'add', currency: 'caps', ms: 13,
        tiers: [
            { base: 200, max: 4, r: 2.00, step: 1 }, { base: 750, max: 5, r: 2.00, step: 1 },
            { base: 2500, max: 4, r: 2.00, step: 1 }, { base: 10, max: 4, r: 2.00, step: 1 },
            { base: 10, max: 4, r: 2.00, step: 1 }, { base: 10, max: 4, r: 2.00, step: 1 },
            { base: 10, max: 4, r: 2.00, step: 1 },
        ],
    },
    {
        id: 'limit', name: 'bs_limit', desc: 'bs_limit_d', icon: 'stat/buyable',
        unit: 'count', mode: 'add', currency: 'money', ms: 5,
        tiers: [
            { base: 70, max: 4, r: 1.40, step: 5 }, { base: 410, max: 4, r: 1.20, step: 5 },
            { base: 1200, max: 4, r: 1.30, step: 5 }, { base: 10, max: 4, r: 1.50, step: 5 },
            { base: 10, max: 4, r: 1.50, step: 5 }, { base: 10, max: 4, r: 1.50, step: 5 },
            { base: 10, max: 4, r: 1.50, step: 5 },
        ],
    },
    {
        id: 'mastery', name: 'bs_mastery', desc: 'bs_mastery_d', icon: 'stat/mastery',
        unit: 'percent', mode: 'mul', currency: 'money', ms: 4,
        tiers: [
            { base: 50, max: 10, r: 1.10, step: 0.10 }, { base: 900, max: 10, r: 1.20, step: 0.10 },
            { base: 2200, max: 10, r: 1.30, step: 0.10 }, { base: 10, max: 10, r: 1.50, step: 0.10 },
            { base: 10, max: 10, r: 1.50, step: 0.10 }, { base: 10, max: 10, r: 1.50, step: 0.10 },
            { base: 10, max: 10, r: 1.50, step: 0.10 },
        ],
    },
    {
        id: 'double', name: 'bs_double', desc: 'bs_double_d', icon: 'stat/plusincome',
        unit: 'percent', mode: 'mul', currency: 'money', ms: 11,
        tiers: [
            { base: 1200, max: 3, r: 1.26, step: 0.10 }, { base: 4200, max: 3, r: 1.26, step: 0.10 },
            { base: 8400, max: 3, r: 1.26, step: 0.10 }, { base: 10, max: 10, r: 1.50, step: 0.10 },
            { base: 10, max: 10, r: 1.50, step: 0.10 }, { base: 10, max: 10, r: 1.50, step: 0.10 },
            { base: 10, max: 10, r: 1.50, step: 0.10 },
        ],
    },
    {
        id: 'again', name: 'bs_again', desc: 'bs_again_d', icon: 'stat/chance',
        unit: 'percent', mode: 'add', currency: 'money', ms: 9,
        tiers: [
            { base: 700, max: 5, r: 1.40, step: 0.02 }, { base: 5000, max: 5, r: 1.20, step: 0.02 },
            { base: 8300, max: 5, r: 1.25, step: 0.02 }, { base: 10, max: 5, r: 1.50, step: 0.02 },
            { base: 10, max: 5, r: 1.50, step: 0.02 }, { base: 10, max: 5, r: 1.50, step: 0.02 },
            { base: 10, max: 5, r: 1.50, step: 0.02 },
        ],
    },
    {
        id: 'random', name: 'bs_random', desc: 'bs_random_d', icon: 'stat/flipcount',
        unit: 'percent', mode: 'add', currency: 'money', ms: 7,
        tiers: [
            { base: 400, max: 5, r: 1.40, step: 0.02 }, { base: 2200, max: 5, r: 1.25, step: 0.02 },
            { base: 4400, max: 5, r: 1.25, step: 0.02 }, { base: 10, max: 5, r: 1.50, step: 0.02 },
            { base: 10, max: 5, r: 1.50, step: 0.02 }, { base: 10, max: 5, r: 1.50, step: 0.02 },
            { base: 10, max: 5, r: 1.50, step: 0.02 },
        ],
    },
];

/**
 * 升级面板的**显示顺序**（与存储顺序解耦）。
 *
 * ⚠️ `BOTTLE_STATS` 的数组下标就是存档 `tierStats[tier][i]` 的列号，
 *    **不能重排**；所以显示顺序单独用这张表描述。
 *
 * 顺序 = 原版截图口径：**金币基础收益在最上、悬停翻转在最下**，
 * 中间按「解锁顺序 / 首次可负担价格」从便宜到贵排列。
 */
export const BOTTLE_STAT_VIEW: string[] = [
    'income', 'purchase', 'speed', 'multiplier', 'mastery', 'limit',
    'random', 'again', 'double', 'capincome', 'capgain', 'hover',
];

/* ================================================================== *
 *  里程碑成长系统（GDD §7 —— 原版 MilestoneSO 真实 24 阶阈值）
 *
 *  成长模型：StartValue 10 / Multiplier 1.50 / Additive 5 / Incremental 0.01，
 *  阈值直接取 §7.2 的 **24 阶全量对照表**（自原版二进制提取，非等比简化）。
 *
 *  它同时承担「单瓶词条」的门控：开局只开放「金币基础收益 + 悬停翻转」，
 *  其余 10 条按 `BottleStatDef.ms` 逐条开放。
 * ================================================================== */
export interface MilestoneDef {
    /** 阶段号 1..24 */
    n: number;
    /** 目标值（进度 = max(累计翻转次数, 累计收益 = 金币流水 + 瓶盖流水)） */
    need: number;
    /** 阶段奖励 / 达成行为（GDD §7.2 原文口径，用于提示与统计页） */
    zh: string;
    en: string;
}

export const MILESTONES: MilestoneDef[] = [
    { n: 1,  need: 10,      zh: '基础收益统计开启', en: 'Basic earnings tracked' },
    { n: 2,  need: 20,      zh: '初见瓶盖掉落', en: 'First caps drop' },
    { n: 3,  need: 35,      zh: '商店初级升级开放', en: 'Basic shop upgrades' },
    { n: 4,  need: 59,      zh: '单瓶属性强化开启', en: 'Per-bottle perks open' },
    { n: 5,  need: 95,      zh: '光标范围研发解锁', en: 'Cursor range research' },
    { n: 6,  need: 151,     zh: '首只助手资本积累', en: 'Capital for first hand' },
    { n: 7,  need: 238,     zh: '推进科技树研发', en: 'Tech tree unlocked' },
    { n: 8,  need: 377,     zh: '购买首只助手机械手', en: 'First mech hand' },
    { n: 9,  need: 597,     zh: '自动化挂机体验开启', en: 'Automation online' },
    { n: 10, need: 948,     zh: '研发解锁 T2 铜质能量瓶', en: 'Unlock T2 Bronze' },
    { n: 11, need: 1512,    zh: '瓶盖制造机激活', en: 'Cap machine active' },
    { n: 12, need: 2424,    zh: '解锁飞天可乐技能', en: 'Unlock Sky Cola' },
    { n: 13, need: 3907,    zh: '研发解锁 T3 白银汽水瓶', en: 'Unlock T3 Silver' },
    { n: 14, need: 6335,    zh: '双倍增益闸门激活', en: 'Double gate active' },
    { n: 15, need: 10331,   zh: '触发狂暴连击机制', en: 'Berserk combo' },
    { n: 16, need: 16948,   zh: '解锁武士处决技能', en: 'Unlock Samurai' },
    { n: 17, need: 27969,   zh: '研发解锁 T4 黄金尊享瓶', en: 'Unlock T4 Gold' },
    { n: 18, need: 46433,   zh: '助手机械手突破 40 只', en: '40 mech hands' },
    { n: 19, need: 77548,   zh: '研发解锁 T5 红宝石烈酒瓶', en: 'Unlock T5 Ruby' },
    { n: 20, need: 130285,  zh: '天界收益翻倍', en: 'Celestial income x2' },
    { n: 21, need: 220187,  zh: '研发解锁 T6 翡翠神圣瓶', en: 'Unlock T6 Emerald' },
    { n: 22, need: 374324,  zh: '科技树核心节点点满', en: 'Core tree maxed' },
    { n: 23, need: 640098,  zh: '全屏百手狂舞', en: 'Hundred hands' },
    { n: 24, need: 1100974, zh: '100% 究极通关 · 纪念金杯', en: '100% completion' },
];

/* ================================================================== *
 *  四大技能树（GDD §5.1 —— 消耗瓶盖，原版真实节点）
 * ================================================================== */
export type TreeId = 'bottle' | 'player' | 'helper' | 'ability';

/**
 * 数值展示单位：
 *  flat  → 直接显示数值        percent → 显示为 +v%
 *  mult  → 显示为 +(v-1)×      size    → 显示为 ×v
 *  count → 整数个数            seconds → 秒        px → 像素半径
 *  unlock→ 解锁型
 */
export type SkillUnit = 'flat' | 'percent' | 'mult' | 'size' | 'count' | 'seconds' | 'px' | 'unlock';

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
    /** 解锁哪一阶瓶子的购买资格（bottle 分支用） */
    tier?: number;
}

export const SKILLS: SkillDef[] = [
    /* ---- 分支 1：瓶子科技（研发解锁各阶瓶子购买资格，§4.1 科技树解锁成本） ---- */
    { id: 'ul_t2', tree: 'bottle', name: 'sk_ul_t2', desc: 'sk_ul_t2_d', icon: 'bottle/icon_bronze', max: 1, baseCost: 1600, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't2', tier: 1 },
    { id: 'ul_t3', tree: 'bottle', name: 'sk_ul_t3', desc: 'sk_ul_t3_d', icon: 'bottle/icon_silver', max: 1, baseCost: 4800, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't3', tier: 2 },
    { id: 'ul_t4', tree: 'bottle', name: 'sk_ul_t4', desc: 'sk_ul_t4_d', icon: 'bottle/icon_gold', max: 1, baseCost: 10000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't4', tier: 3 },
    { id: 'ul_t5', tree: 'bottle', name: 'sk_ul_t5', desc: 'sk_ul_t5_d', icon: 'bottle/icon_ruby', max: 1, baseCost: 20000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't5', tier: 4 },
    { id: 'ul_t6', tree: 'bottle', name: 'sk_ul_t6', desc: 'sk_ul_t6_d', icon: 'bottle/icon_emerald', max: 1, baseCost: 45000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't6', tier: 5 },
    { id: 'ul_t7', tree: 'bottle', name: 'sk_ul_t7', desc: 'sk_ul_t7_d', icon: 'bottle/icon_diamond', max: 1, baseCost: 90000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't7', tier: 6 },

    /* ---- 分支 2：玩家科技 ---- */
    { id: 'p_cursor', tree: 'player', name: 'sk_cursor', desc: 'sk_cursor_d', icon: 'env/cursor', max: 1, baseCost: 500, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'cursor' },
    { id: 'p_cursorsize', tree: 'player', name: 'sk_cursorsize', desc: 'sk_cursorsize_d', icon: 'stat/size', max: 10, baseCost: 3000, growth: 1.15, base: 55, step: 2.75, unit: 'px' },
    { id: 'p_sizelimit', tree: 'player', name: 'sk_sizelimit', desc: 'sk_sizelimit_d', icon: 'stat/buyable', max: 6, baseCost: 2000, growth: 1.30, base: 5, step: 5, unit: 'count' },
    { id: 'p_idle', tree: 'player', name: 'sk_idle', desc: 'sk_idle_d', icon: 'stat/time', max: 1, baseCost: 1000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'idle' },
    { id: 'p_idlemove', tree: 'player', name: 'sk_idlemove', desc: 'sk_idlemove_d', icon: 'stat/movespeed', max: 15, baseCost: 1000, growth: 1.50, base: 3, step: 0.15, unit: 'flat' },
    { id: 'p_idletime', tree: 'player', name: 'sk_idletime', desc: 'sk_idletime_d', icon: 'stat/duration', max: 25, baseCost: 800, growth: 1.50, base: 5, step: 0.5, unit: 'seconds' },
    { id: 'p_idlerecov', tree: 'player', name: 'sk_idlerecovery', desc: 'sk_idlerecovery_d', icon: 'stat/recovery', max: 15, baseCost: 1000, growth: 1.50, base: 5, step: -0.25, unit: 'seconds' },
    { id: 'p_stability', tree: 'player', name: 'sk_stability', desc: 'sk_stability_d', icon: 'stat/resolve', max: 10, baseCost: 1000, growth: 1.40, base: 0, step: 0.05, unit: 'percent' },
    // ⚠️ 原版里「瓶盖机器」**不是**技能树节点，而是商店设施（$1,000 金币，见 MACHINE.buyPrice）。
    //    所以这里没有 p_machine；机器衍生的两个加成节点直接挂到 p_stability 下。
    { id: 'p_machineinc', tree: 'player', name: 'sk_machineinc', desc: 'sk_machineinc_d', icon: 'stat/capgain', max: 10, baseCost: 10000, growth: 1.46, base: 0, step: 0.10, unit: 'percent' },
    { id: 'p_machinespeed', tree: 'player', name: 'sk_machinespeed', desc: 'sk_machinespeed_d', icon: 'env/belt', max: 30, baseCost: 1000, growth: 1.10, base: 0, step: 0.10, unit: 'percent' },
    { id: 'p_gateunlock', tree: 'player', name: 'sk_gateunlock', desc: 'sk_gateunlock_d', icon: 'stat/unlock', max: 1, baseCost: 8000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'gate' },
    { id: 'p_gatechance', tree: 'player', name: 'sk_gatechance', desc: 'sk_gatechance_d', icon: 'stat/chance', max: 10, baseCost: 8200, growth: 1.10, base: 0, step: 0.10, unit: 'percent' },

    /* ---- 分支 3：助手科技 ---- */
    { id: 'h_unlock', tree: 'helper', name: 'sk_unlock_hand', desc: 'sk_unlock_hand_d', icon: 'env/hand', max: 1, baseCost: 1200, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'helper' },
    { id: 'h_price', tree: 'helper', name: 'sk_handprice', desc: 'sk_handprice_d', icon: 'stat/buyable', max: 10, baseCost: 4000, growth: 1.10, base: 0, step: -0.005, unit: 'percent' },
    { id: 'h_speed', tree: 'helper', name: 'sk_movespeed', desc: 'sk_movespeed_d', icon: 'stat/movespeed', max: 15, baseCost: 800, growth: 1.15, base: 4, step: 0.2, unit: 'flat' },
    { id: 'h_repick', tree: 'helper', name: 'sk_repick', desc: 'sk_repick_d', icon: 'stat/time', max: 15, baseCost: 10, growth: 1.10, base: 1.5, step: -0.15, unit: 'seconds' },
    { id: 'h_recovery', tree: 'helper', name: 'sk_recovery', desc: 'sk_recovery_d', icon: 'stat/recovery', max: 15, baseCost: 800, growth: 1.15, base: 5, step: -0.25, unit: 'seconds' },
    { id: 'h_limit', tree: 'helper', name: 'sk_handlimit', desc: 'sk_handlimit_d', icon: 'stat/size', max: 18, baseCost: 1800, growth: 1.30, base: 10, step: 5, unit: 'count' },
    { id: 'h_bronze', tree: 'helper', name: 'sk_bronze', desc: 'sk_bronze_d', icon: 'bottle/icon_bronze', max: 1, baseCost: 3000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t1', tier: 1 },
    { id: 'h_silver', tree: 'helper', name: 'sk_silver', desc: 'sk_silver_d', icon: 'bottle/icon_silver', max: 1, baseCost: 7000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t2', tier: 2 },
    { id: 'h_gold', tree: 'helper', name: 'sk_gold', desc: 'sk_gold_d', icon: 'bottle/icon_gold', max: 1, baseCost: 15000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t3', tier: 3 },
    { id: 'h_ruby', tree: 'helper', name: 'sk_ruby', desc: 'sk_ruby_d', icon: 'bottle/icon_ruby', max: 1, baseCost: 68000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t4', tier: 4 },
    { id: 'h_emerald', tree: 'helper', name: 'sk_emerald', desc: 'sk_emerald_d', icon: 'bottle/icon_emerald', max: 1, baseCost: 32000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t5', tier: 5 },
    { id: 'h_diamond', tree: 'helper', name: 'sk_diamond', desc: 'sk_diamond_d', icon: 'bottle/icon_diamond', max: 1, baseCost: 145000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t6', tier: 6 },

    /* ---- 分支 4：特殊技能 ---- */
    { id: 'a_coke', tree: 'ability', name: 'sk_coke', desc: 'sk_coke_d', icon: 'ability/flyingcoke', max: 1, baseCost: 4000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'flyingcoke' },
    { id: 'a_cokecd', tree: 'ability', name: 'sk_cokecd', desc: 'sk_cokecd_d', icon: 'stat/duration', max: 3, baseCost: 4000, growth: 1.00, base: 75, step: -20, unit: 'seconds' },
    { id: 'a_cokecount', tree: 'ability', name: 'sk_cokecount', desc: 'sk_cokecount_d', icon: 'stat/flipcount', max: 9, baseCost: 3000, growth: 1.00, base: 1, step: 1, unit: 'count' },
    { id: 'a_berserk', tree: 'ability', name: 'sk_berserk', desc: 'sk_berserk_d', icon: 'ability/berserk', max: 1, baseCost: 12000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'berserk' },
    { id: 'a_berserkflips', tree: 'ability', name: 'sk_berserkflips', desc: 'sk_berserkflips_d', icon: 'stat/flipcount', max: 3, baseCost: 12200, growth: 1.15, base: 2, step: 1, unit: 'count' },
    { id: 'a_berserkinc', tree: 'ability', name: 'sk_berserkinc', desc: 'sk_berserkinc_d', icon: 'stat/bonus', max: 3, baseCost: 12200, growth: 1.15, base: 1.0, step: 1.5, unit: 'mult' },
    { id: 'a_samurai', tree: 'ability', name: 'sk_samurai', desc: 'sk_samurai_d', icon: 'ability/samurai', max: 1, baseCost: 18000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'samurai' },
    { id: 'a_samuraidur', tree: 'ability', name: 'sk_samuraidur', desc: 'sk_samuraidur_d', icon: 'stat/duration', max: 3, baseCost: 19000, growth: 1.15, base: 0.8, step: 0.3, unit: 'seconds' },
    { id: 'a_samuraigain', tree: 'ability', name: 'sk_samuraigain', desc: 'sk_samuraigain_d', icon: 'stat/bonus', max: 3, baseCost: 19000, growth: 1.15, base: 1.0, step: 0.3, unit: 'mult' },
];

export const TREE_ZH: Record<TreeId, string> = { bottle: '瓶子科技', player: '玩家科技', helper: '助手科技', ability: '特殊技能' };
export const TREE_EN: Record<TreeId, string> = { bottle: 'Bottle', player: 'Player', helper: 'Helper', ability: 'Abilities' };

/* ------------------------------------------------------------------ *
 *  技能树节点图（col 向右为正 / row 向上为正；parent = null 为分支入口）
 *  画布按 CANVAS_W 640 / NODE_STEP_X 120 → 可见 5 列（col -2..2）
 * ------------------------------------------------------------------ */
export interface SkillNodeDef {
    id: string;
    icon: string;
    col: number;
    row: number;
    parent: string | null;
}

/** 分支 1：瓶子科技 —— T2~T7 逐阶研发解锁（之字形链） */
export const SKILL_GRAPH: SkillNodeDef[] = [
    { id: 'ul_t2', icon: 'bottle/icon_bronze', col: -1, row: 5, parent: null },
    { id: 'ul_t3', icon: 'bottle/icon_silver', col: 1, row: 4, parent: 'ul_t2' },
    { id: 'ul_t4', icon: 'bottle/icon_gold', col: -1, row: 3, parent: 'ul_t3' },
    { id: 'ul_t5', icon: 'bottle/icon_ruby', col: 1, row: 2, parent: 'ul_t4' },
    { id: 'ul_t6', icon: 'bottle/icon_emerald', col: -1, row: 1, parent: 'ul_t5' },
    { id: 'ul_t7', icon: 'bottle/icon_diamond', col: 1, row: 0, parent: 'ul_t6' },
];

/** 分支 2：玩家科技 —— 光标 / 挂机 / 稳定性 / 瓶盖机 + 闸门 四条线 */
export const PLAYER_GRAPH: SkillNodeDef[] = [
    { id: 'p_cursor', icon: 'env/cursor', col: 0, row: 4, parent: null },

    { id: 'p_cursorsize', icon: 'stat/size', col: -2, row: 3, parent: 'p_cursor' },
    { id: 'p_sizelimit', icon: 'stat/buyable', col: -2, row: 2, parent: 'p_cursorsize' },

    { id: 'p_idle', icon: 'stat/time', col: 0, row: 3, parent: 'p_cursor' },
    { id: 'p_idlemove', icon: 'stat/movespeed', col: 0, row: 2, parent: 'p_idle' },
    { id: 'p_idletime', icon: 'stat/duration', col: -1, row: 1, parent: 'p_idlemove' },
    { id: 'p_idlerecov', icon: 'stat/recovery', col: -1, row: 0, parent: 'p_idletime' },

    { id: 'p_stability', icon: 'stat/resolve', col: 2, row: 3, parent: 'p_cursor' },
    // 机器本体在商店买（$1,000），树上只留它的两个加成节点，直接挂在稳定性下方
    { id: 'p_machineinc', icon: 'stat/capgain', col: 2, row: 2, parent: 'p_stability' },
    { id: 'p_machinespeed', icon: 'env/belt', col: 1, row: 0, parent: 'p_machineinc' },
    { id: 'p_gateunlock', icon: 'stat/unlock', col: 2, row: -1, parent: 'p_machinespeed' },
    { id: 'p_gatechance', icon: 'stat/chance', col: 2, row: -2, parent: 'p_gateunlock' },
];

/** 分支 3：助手科技 —— 基础强化 + 六阶自动化许可 */
export const HELPER_GRAPH: SkillNodeDef[] = [
    { id: 'h_unlock', icon: 'env/hand', col: 0, row: 5, parent: null },

    { id: 'h_price', icon: 'stat/buyable', col: -2, row: 4, parent: 'h_unlock' },
    { id: 'h_speed', icon: 'stat/movespeed', col: 0, row: 4, parent: 'h_unlock' },
    { id: 'h_repick', icon: 'stat/time', col: 2, row: 4, parent: 'h_unlock' },

    { id: 'h_recovery', icon: 'stat/recovery', col: -2, row: 3, parent: 'h_price' },
    { id: 'h_limit', icon: 'stat/size', col: 2, row: 3, parent: 'h_repick' },

    { id: 'h_bronze', icon: 'bottle/icon_bronze', col: 2, row: 2, parent: 'h_limit' },
    { id: 'h_silver', icon: 'bottle/icon_silver', col: 1, row: 2, parent: 'h_bronze' },
    { id: 'h_gold', icon: 'bottle/icon_gold', col: 0, row: 2, parent: 'h_silver' },
    { id: 'h_emerald', icon: 'bottle/icon_emerald', col: -1, row: 2, parent: 'h_gold' },
    { id: 'h_ruby', icon: 'bottle/icon_ruby', col: -2, row: 2, parent: 'h_emerald' },
    { id: 'h_diamond', icon: 'bottle/icon_diamond', col: -2, row: 1, parent: 'h_ruby' },
];

/** 分支 4：特殊技能 —— 飞天可乐 → 狂暴 → 武士处决 */
export const ABILITY_GRAPH: SkillNodeDef[] = [
    { id: 'a_coke', icon: 'ability/flyingcoke', col: 0, row: 8, parent: null },
    { id: 'a_cokecd', icon: 'stat/duration', col: -2, row: 7, parent: 'a_coke' },
    { id: 'a_cokecount', icon: 'stat/flipcount', col: 2, row: 7, parent: 'a_coke' },
    { id: 'a_berserk', icon: 'ability/berserk', col: 0, row: 6, parent: 'a_coke' },
    { id: 'a_berserkflips', icon: 'stat/flipcount', col: -2, row: 5, parent: 'a_berserk' },
    { id: 'a_berserkinc', icon: 'stat/bonus', col: 2, row: 5, parent: 'a_berserk' },
    { id: 'a_samurai', icon: 'ability/samurai', col: 0, row: 4, parent: 'a_berserk' },
    { id: 'a_samuraidur', icon: 'stat/duration', col: -2, row: 3, parent: 'a_samurai' },
    { id: 'a_samuraigain', icon: 'stat/bonus', col: 2, row: 3, parent: 'a_samurai' },
];

/** 技能树节点尺寸（设计像素） */
export const NODE_SIZE = 112;
// 列距 130：卡片宽 112，留 18px 缝，相邻节点的名称文字不会贴在一起（原来 120 → 只差 8px）
export const NODE_STEP_X = 130;
export const NODE_STEP_Y = 124;

/* ================================================================== *
 *  三大终极技能参数（GDD §5.1 分支 4 / §5.2）
 * ================================================================== */
export const ABILITY = {
    /** 飞天可乐：基础冷却 75s，每级 −20s（3 级）；生成数量 1 + L（9 级，最多 10 瓶） */
    coke: { cdBase: 75, cdMin: 15, countBase: 1, countMax: 10, flightTime: 4.6 },
    /** 狂暴：连续扣盖 3 次激活；有效翻转 2 + L（3 级 → 5）；收益倍率 1.0 + 1.5L（→ 5.5×） */
    berserk: {
        need: 3, flipsBase: 2, flipsMax: 5,
        multBase: 1.0, multStep: 1.5, multMax: 5.5, speedMul: 1.5, pitch: 1.2,
    },
    /** 武士处决：定格 0.8s + 0.3L（3 级 → 1.7s）；收益 1.0 + 0.3L；扣盖积攒 +15% */
    samurai: {
        gaugeMax: 100, gainSuccess: 1, gainCap: 15,
        durBase: 0.8, durStep: 0.3, gainBase: 1.0, gainStep: 0.3,
        freezeTime: 0.9, shakeTime: 0.3,
    },
};

/* ================================================================== *
 *  助手（GDD §4.4-2 / §5.1 分支 3）
 * ================================================================== */
export const HAND = {
    unlockCaps: 1200,
    price: 4000,
    priceGrowth: 1.10,
    /** 目标重选时间基准（秒） */
    interval: 1.5,
    /** 同屏可见上限（防节点爆炸，超出静默结算） */
    visibleMax: 10,
    /** 初始持有上限 10 只，h_limit 每级 +5（18 级 → 100） */
    limitBase: 10,
    limitStep: 5,
    speedBase: 4.0,
    recoveryBase: 5.0,
};

/* ================================================================== *
 *  瓶盖机器 / 双倍闸门（GDD §4.4-3 / §6.3）
 * ================================================================== */
export const MACHINE = {
    /**
     * 商店购买价（金币）。
     * ★ 原版流程：瓶盖机器是**商店设施**，$1,000 金币一次性买断；
     *   买之前桌台下方是空的（不画履带），而且扣盖**完全不产出瓶盖**。
     */
    buyPrice: 1000,
    capUnitBase: 1,
    /** 履带运送速度（设计像素 / 秒）——再乘科技树 MachineSpeed +10%/级 */
    beltSpeed: 150,
    flyTime: 0.40,
    maxChips: 46,
    /** 闸门在履带上的位置：0 = 底部入口，1 = 顶部回收口 */
    gateAt: 0.46,
    /** 闸门翻倍倍率 */
    gateMult: 2,
};

/* ================================================================== *
 *  悬停翻转 / 落地判定（GDD §3.1）
 * ================================================================== */
export const FLIP = {
    /** 基础容差角 18.0°（§3.1-3） */
    toleranceBase: 18.0,
    /** 落地精通每级 +10% 容差角 */
    toleranceStep: 0.10,
    /** 空中翻转角度偏差基准（度）—— 按质量与稳定性科技修正 */
    angleVarBase: 24,
    angleVarPerTier: -1.2,
    /** 稳定性科技每级 −5% 角度偏差 */
    stabilityStep: 0.05,
    /** 失败后自动扶正时间（秒，§3.1-3） */
    recoverTime: 0.40,
};

/* ================================================================== *
 *  成就（24 项，文案 key 与原版一一对应）
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
 *  竖屏四段式布局（沿用已验收的参数）
 * ================================================================== */
export const LAYOUT = {
    safeTop: 90,
    safeBottom: 110,

    hudY: 494,
    hudH: 112,
    stageTop: 438,

    statusY: 425,

    tableX: 30,
    tableY: 92,
    tableWidth: 500,
    tableHeight: 640,

    railX: -296,
    railW: 128,
    recycleY: 366,
    beltTop: 296,
    beltBottom: -240,

    quickBuyY: -276,
    abilityY: -372,
    staminaY: -424,
    navY: -484,

    drawerH: 820,

    rowBaseline: [300, 155, 10, -135],
    rowCount: 4,
    colCount: 6,
    rowSpacingX: 80,
    bottleH: 160,
};

export const SAFE_BLOCKS = {
    topY: 550,
    topBottomY: 438,
    botTopY: -234,
    botBottomY: -530,
};

export const WORLD_ENV = { x0: -364, x1: 284, y0: -262, y1: 440 };

export const PLAY_AREA = {
    x0: -105, x1: 165,
    y0: -155, y1: 285,
};

/** 可见瓶子上限（超出的静默结算） */
export const VISIBLE_BOTTLES = 24;

/* ================================================================== *
 *  对象池容量（高性能：高频特效一律复用节点）
 * ================================================================== */
export const POOL = {
    chip: 72,
    floatText: 26,
    burst: 72,
    sparkle: 24,
    shockwave: 10,
};

/** 瓶盖染色（统一一张贴图 + Sprite.color 染色，不破坏合批） */
export const CHIP_TINT: string[] = [
    '#FFFFFF', '#E8C39A', '#DCE6F0', '#F2C64B', '#E8556D', '#7BE0A8', '#9FE8FF',
];

export const SAVE_KEY = 'tapbottle.save.v1';
export const SAVE_VERSION = 5;

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
        // ★ 第十七轮口径：**翻转精通**决定成功率 —— 每级 +5%，满 10 级 = 100%（FLIP.successBase/Step）
        //   `base` 在本表里同时当**价格基数**用（见 State.statCost），所以这里不能写 0.5；
        //   效果值不走 statValue，统一由 G.successChance(tier) 计算。
        id: 'mastery', name: 'bs_mastery', desc: 'bs_mastery_d', icon: 'stat/mastery',
        unit: 'percent', mode: 'add', currency: 'money', ms: 4,
        tiers: [
            { base: 50, max: 10, r: 1.10, step: 0.05 }, { base: 900, max: 10, r: 1.20, step: 0.05 },
            { base: 2200, max: 10, r: 1.30, step: 0.05 }, { base: 10, max: 10, r: 1.50, step: 0.05 },
            { base: 10, max: 10, r: 1.50, step: 0.05 }, { base: 10, max: 10, r: 1.50, step: 0.05 },
            { base: 10, max: 10, r: 1.50, step: 0.05 },
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

/**
 * **技能树 · 瓶子模块**的节点顺序（★ 原版 `BottleSkillTreeUpgradeUI` 的 UpgradeType 顺序）。
 *
 * 原版每阶瓶子都有一棵独立的 10 节点天赋树，dump 出来的顺序是：
 *   Unlock → Income → IncomeBonus → Speed → CapGain → BuyableLimit
 *   → FlipMastery → DoubleIncome → FlipAgain → RandomFlip → (FlipMode 悬停)
 * 其中 Unlock 由 BottomPanel 单独处理（用研发节点），这里只列**词条**部分；
 * `capincome`（瓶盖机收入）是升级页的全局项，不在瓶子树里。
 */
export const BOTTLE_TREE_ORDER: string[] = [
    'income', 'multiplier', 'speed', 'capgain', 'limit',
    'mastery', 'double', 'again', 'random', 'hover',
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
    { id: 'ul_t2', tree: 'bottle', name: 'sk_ul_t2', desc: 'sk_ul_t2_d', icon: 'bottle/body_1', max: 1, baseCost: 1600, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't2', tier: 1 },
    { id: 'ul_t3', tree: 'bottle', name: 'sk_ul_t3', desc: 'sk_ul_t3_d', icon: 'bottle/body_2', max: 1, baseCost: 4800, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't3', tier: 2 },
    { id: 'ul_t4', tree: 'bottle', name: 'sk_ul_t4', desc: 'sk_ul_t4_d', icon: 'bottle/body_3', max: 1, baseCost: 10000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't4', tier: 3 },
    { id: 'ul_t5', tree: 'bottle', name: 'sk_ul_t5', desc: 'sk_ul_t5_d', icon: 'bottle/body_5', max: 1, baseCost: 20000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't5', tier: 4 },
    { id: 'ul_t6', tree: 'bottle', name: 'sk_ul_t6', desc: 'sk_ul_t6_d', icon: 'bottle/body_4', max: 1, baseCost: 45000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't6', tier: 5 },
    { id: 'ul_t7', tree: 'bottle', name: 'sk_ul_t7', desc: 'sk_ul_t7_d', icon: 'bottle/body_6', max: 1, baseCost: 90000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 't7', tier: 6 },

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
    { id: 'h_bronze', tree: 'helper', name: 'sk_bronze', desc: 'sk_bronze_d', icon: 'bottle/body_1', max: 1, baseCost: 3000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t1', tier: 1 },
    { id: 'h_silver', tree: 'helper', name: 'sk_silver', desc: 'sk_silver_d', icon: 'bottle/body_2', max: 1, baseCost: 7000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t2', tier: 2 },
    { id: 'h_gold', tree: 'helper', name: 'sk_gold', desc: 'sk_gold_d', icon: 'bottle/body_3', max: 1, baseCost: 15000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t3', tier: 3 },
    { id: 'h_ruby', tree: 'helper', name: 'sk_ruby', desc: 'sk_ruby_d', icon: 'bottle/body_5', max: 1, baseCost: 68000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t4', tier: 4 },
    { id: 'h_emerald', tree: 'helper', name: 'sk_emerald', desc: 'sk_emerald_d', icon: 'bottle/body_4', max: 1, baseCost: 32000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t5', tier: 5 },
    { id: 'h_diamond', tree: 'helper', name: 'sk_diamond', desc: 'sk_diamond_d', icon: 'bottle/body_6', max: 1, baseCost: 145000, growth: 1, base: 0, step: 0, unit: 'unlock', unlockId: 'h_t6', tier: 6 },

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
    { id: 'ul_t2', icon: 'bottle/body_1', col: -1, row: 5, parent: null },
    { id: 'ul_t3', icon: 'bottle/body_2', col: 1, row: 4, parent: 'ul_t2' },
    { id: 'ul_t4', icon: 'bottle/body_3', col: -1, row: 3, parent: 'ul_t3' },
    { id: 'ul_t5', icon: 'bottle/body_5', col: 1, row: 2, parent: 'ul_t4' },
    { id: 'ul_t6', icon: 'bottle/body_4', col: -1, row: 1, parent: 'ul_t5' },
    { id: 'ul_t7', icon: 'bottle/body_6', col: 1, row: 0, parent: 'ul_t6' },
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

    { id: 'h_bronze', icon: 'bottle/body_1', col: 2, row: 2, parent: 'h_limit' },
    { id: 'h_silver', icon: 'bottle/body_2', col: 1, row: 2, parent: 'h_bronze' },
    { id: 'h_gold', icon: 'bottle/body_3', col: 0, row: 2, parent: 'h_silver' },
    { id: 'h_emerald', icon: 'bottle/body_4', col: -1, row: 2, parent: 'h_gold' },
    { id: 'h_ruby', icon: 'bottle/body_5', col: -2, row: 2, parent: 'h_emerald' },
    { id: 'h_diamond', icon: 'bottle/body_6', col: -2, row: 1, parent: 'h_ruby' },
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
    /** 闸门在履带上的位置：0 = 右端入料机，1 = 左端出售箱 */
    gateAt: 0.46,
    /** 闸门翻倍倍率 */
    gateMult: 2,

    /* ---- 横置履带几何（局部坐标原点 = 履带中线）：右入料机 → 履带（向左）→ 左出售箱 ----
     * ★ 第十轮按参考图重排：三段总宽 654（设计宽 720，左右各留 33），
     *   高度 148 收进 LAYOUT.beltH(124) 的视觉带宽里。
     *   ★ 第十四轮按用户口径镜像方向：瓶盖飞向**右端深色入料机**（黑色滚轮），
     *     通过履带向左运到**左端出售箱**（木箱 + 瓶盖图示）回收计费。
     */
    binW: 150, binH: 148, binX: -252,
    beltW: 340, beltH: 86,
    feederW: 150, feederH: 148, feederX: 252,
    /** 瓶盖入料口 x（右端深色入料机左侧，落在带面内 10px） */
    beltEntryX: 160,
    /** 瓶盖回收口 x（左端出售箱右侧） */
    beltExitX: -160,
    /** 上下两根横木轨（连接出售箱与入料机） */
    railW: 654, railH: 32, railY: 59,
};

/* ================================================================== *
 *  悬停翻转 / 落地判定（GDD §3.1；★ 第十七轮改为**纯概率制**）
 * ================================================================== */
/**
 * ★ 用户口径（第十七轮）：落地判定不再走「角度容差」，改成**纯概率**，七阶共用一套口径：
 *   · 成功树立 = **50%**，其中 **倒立（扣盖）10% / 正立 40%**，失败 50%；
 *   · 各阶「翻转精通」每级 **+5% 成功率**，满 **10 级 = 100%**（必成立）；
 *   · 所有瓶子一个口径，成功率只由该阶精通等级决定。
 * 判定与动画解耦：先掷出 crit / ok / fail，再让瓶子演对应的落地姿态（Bottle.flip(outcome)）。
 */
export const FLIP = {
    /** 基础成功树立概率 50% */
    successBase: 0.50,
    /** 精通每级 +5% 成功率 */
    successStep: 0.05,
    /**
     * 成功池内部的再分配：**倒立（扣盖）占 20% / 正立占 80%**。
     *
     * ★ 口径：基础 10% : 40% = **1:4**，归一化后比值固定 ——
     *   两者占比之和恒 = 1，且 倒立概率 + 正立概率 ≡ 成功率（精通只抬水位、不改比例）。
     */
    critShareOfSuccess: 0.20,
    /** 精通等级上限（七阶一致，满级 100%） */
    masteryMax: 10,
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
 *  竖屏布局（★ 2026-09-23 第八轮：按新参考图整屏重排为「木牌顶栏 + 满屏木桌 +
 *  桌底横置履带 + 商城/技能/等级底栏」四段式）
 *
 *  纵向预算（设计高 1280，y 以屏幕中心为 0）：
 *    +640 ┬ 顶部安全留白 90
 *    +550 ┤ 木牌顶栏（backButton + 金币/瓶盖筹码 + 工具按钮）h=134
 *    +416 ┤ 木桌区（猫爪挂牌 + 绿叶 + 瓶子活动区）
 *     -73 ┤ 快捷购买卡顶  ← 底部块从这里开始，随 navDY 一起贴屏幕底
 *    -151 ┤ 能力条 104
 *    -261 ┤ 履带（横置：左机器盒 + 中段履带 + 右滚筒）h=150
 *    -431 ┤ 底栏（商城 / 技能 / 1级 / 2级 / ▲）h=78
 *    -530 ┴ 底部安全留白 110
 * ================================================================== */
export const LAYOUT = {
    safeTop: 90,
    /**
     * ⚠️ 底部安全留白从 110 收到 24：底栏下面是**常驻的内嵌升级面板**
     *    （见 panelY / panelH），它必须整块落在屏幕内。
     */
    safeBottom: 24,

    /* ---- 顶部木牌 ---- */
    /** 木牌中线 */
    barY: 520,
    barH: 134,
    /** 木牌左右各伸出屏幕这么多（参考图里木牌是通栏的） */
    barBleed: 26,
    /** 返回按钮 */
    backX: -287, backSize: 96,
    /** 两枚筹码：底板中心 / 宽度 / 高度；图标贴左端 */
    chipH: 58,
    chipW: 169,
    coinChipX: -96.5,
    capChipX: 96.5,
    /**
     * 工具按钮（成就/统计/语言）在木牌右端。
     * ⚠️ 右端必须留出安全边距：设计区右边界是 +360，最右一枚按钮的右沿 = toolX+2*step+size/2，
     *    曾经 toolX=228 → 358，只差 2px 就贴到屏幕边，截图里看着像被切掉一半。
     *    现在 214 → 344，右侧留 16px。
     */
    toolX: 214, toolStepX: 52, toolSize: 52,

    /** 狂暴 / 决意 状态行（木牌下方的木桌上，收窄避免压到两侧猫爪挂牌） */
    statusY: 386,

    /* ---- 底部块（挂在 navRoot，随 navDY 贴屏幕底） ----
     * ★ 第十轮重排：底栏下面多出一块**常驻的内嵌升级面板**（商店 / 天赋），
     *   所以整条底部块整体上移、并各自压缩高度。纵向串联（不许重叠）：
     *     abilityY -136 (h110) → -81 … -191
     *     beltY    -256 (h124) → -194 … -318
     *     navY     -356 (h 72) → -320 … -392
     *     panelY   -508 (h216) → -400 … -616   ← 屏幕最底
     */
    /** 能力条（自下而上第三层） */
    abilityY: -136,
    /** 履带中线（用户反馈「太靠下」→ 整体上移 80） */
    beltY: -256,
    beltH: 124,
    navY: -356,
    navH: 72,
    /**
     * 内嵌升级面板（商店 / 天赋列表）。
     * ⚠️ 这不是二级弹窗：它常驻在底栏下方，切页签/换下拉项都只重画这块内容。
     */
    panelY: -508,
    panelH: 216,

    rowBaseline: [300, 155, 10, -135],
    rowCount: 4,
    colCount: 6,
    rowSpacingX: 80,
    /**
     * 单只瓶子高度（设计像素）。
     * ★ 用户要求「瓶子太大了，缩小到现在的 0.6」→ 160 × 0.6 = 96。
     *   `Bottle.BOTTLE_SCALE = LAYOUT.bottleH / ART_H`，命中判定/影子/姿态补偿
     *   全部由这个常量推导，改一处即可。
     */
    bottleH: 96,
};

/**
 * 上下两大块的边界（applySafeLayout 靠它把两块 UI 钉到安全区、把舞台塞进中间）。
 * topY / botBottomY 是**外沿**，用来和屏幕安全区对齐。
 */
export const SAFE_BLOCKS = {
    /** 顶栏顶边 = barY + barH/2 */
    topY: 587,
    /** 顶栏底边 */
    topBottomY: 453,
    /**
     * 底部块顶边。
     *
     * ⚠️ 底部块最上面的元素现在是**能力条**（abilityY -136 + 110/2 = -81），
     *    这里留 4px 余量 → -85。改任何一个 y 都要回来跟着改，
     *    否则展开态白留高度（瓶子活动区白变小）或反过来切到能力条。
     */
    botTopY: -85,
    /** 底部块底边（内嵌面板底） */
    botBottomY: -616,
};

/** 中部舞台包络（只装瓶子与地面特效；履带在 UI 层，不参与缩放） */
export const WORLD_ENV = { x0: -320, x1: 320, y0: -150, y1: 340 };

export const PLAY_AREA = {
    x0: -150, x1: 150,
    y0: -90, y1: 270,
};

/**
 * 同屏瓶子配额 —— **逐阶独立**（超出的折算成桌面右上角的「+N」角标）。
 *
 * ★ 用户口径（第十九轮）：「各种瓶子之间应该是互不干扰」。
 *   原来是一个**全局总上限 24**、按「高阶优先」分配名额：
 *     · 桌上已经有 24 只 T1 时买一只 T2 → 总名额不够，**当场删掉一只 T1** 换上 T2
 *       （玩家看到的是「买了高级瓶，普通瓶消失了」= 被替换）；
 *     · 紧接着再买 T1 → 名额还是满的，`wantVis` 和现有数量完全一致 → **一只新瓶子都不建**，
 *       飞入动画也永远等不到落点（玩家看到的是「点了没反应」）。
 *   现在每阶各有一份自己的配额，买任何一阶都动不到别的阶，也永远不会「买了不出现」。
 *
 * 配额随阶递减：低阶便宜、是早期主力（会买很多），高阶贵、数量天然少。
 * 全阶买满时桌面最多 24+12+8+6+4+3+3 = 60 只 —— 这是桌面能承受的视觉上限。
 */
export const VISIBLE_PER_TIER: number[] = [24, 12, 8, 6, 4, 3, 3];

/**
 * 列表行里的**瓶子短名**（底栏面板一行 2 格，名称栏只有 ~178px 宽；
 * 用全名「红宝石烈酒瓶·金币基础收益」会被 SHRINK 压成蚂蚁字 —— 用户反馈「看不清」的根因之一）。
 */
export const TIER_SHORT_ZH: string[] = ['普通', '铜瓶', '银瓶', '金瓶', '红瓶', '翡瓶', '钻瓶'];
export const TIER_SHORT_EN: string[] = ['Basic', 'Bronze', 'Silver', 'Gold', 'Ruby', 'Emerald', 'Diamond'];

/**
 * 抓取光圈（商店设施）。
 * ★ 用户口径（第十九轮）：光圈解锁**从技能树挪到商店**直接购买 ——
 *   买下后手指就带光圈跟随（`State.hasCursor` 仍然读 p_cursor 这个科技节点，
 *   所以「手部模块/挂机模块的解锁条件」等既有门控全部照旧生效）。
 */
export const CURSOR = { buyPrice: 500 };

/**
 * 世界层的自适应变换（由 GameRoot.applySafeLayout 写入）。
 *
 * UI 层的元素（横置履带在 navRoot 里，不随舞台缩放）要接住世界坐标事件时必须换算：
 *   屏幕设计坐标 = worldLocal * s + (ox, oy)
 * 其中 (ox, oy) = worldLayer 在同一父节点（shakeHolder）下的位置。
 * navDY 是底部块的位移，用来把屏幕坐标再落到 navRoot 局部空间。
 */
export const WORLD_XFORM = { s: 1, ox: 0, oy: 0, navDY: 0 };

/** 世界局部坐标 → 屏幕设计坐标 */
export function worldToScreen(x: number, y: number): { x: number, y: number } {
    return { x: x * WORLD_XFORM.s + WORLD_XFORM.ox, y: y * WORLD_XFORM.s + WORLD_XFORM.oy };
}

/** 屏幕设计坐标 → 世界局部坐标 */
export function screenToWorld(x: number, y: number): { x: number, y: number } {
    const s = WORLD_XFORM.s || 1;
    return { x: (x - WORLD_XFORM.ox) / s, y: (y - WORLD_XFORM.oy) / s };
}

/* ================================================================== *
 *  对象池容量（高性能：高频特效一律复用节点）
 * ================================================================== */
export const POOL = {
    // 单次扣盖最多可见 CAP_FX.maxVisible 枚，且多只助手可能同时结算 → 池子要够深
    chip: 110,
    floatText: 26,
    burst: 72,
    sparkle: 24,
    shockwave: 10,
};

/** 瓶盖染色（统一一张贴图 + Sprite.color 染色，不破坏合批） */
/* ================================================================== *
 *  瓶盖（扣盖落地产出的实体瓶盖）
 * ================================================================== */

/**
 * 每阶瓶子「扣盖落地一次」产出的**基础**瓶盖枚数（原版 `BottleData.BaseCapGain`）。
 *
 * ★ 从原版二进制实测（`GameStatSO_Balanced` 的 7 条 BottleData 头字段连续序列化区，
 *   sharedassets1.assets，字段相对记录头偏移 +0x28）：
 *     T1..T7 的 BaseCapGain **全部是 1**。
 *
 * ★ 本作的两处**有意偏离**（都在下面写清了口径，想还原改一行即可）：
 *   ① 逐阶递增 —— 用户要求「每种瓶子产生对应颜色的盖子，每一级盖子比前面一级多」；
 *   ② 低阶给得比原版慷慨 —— 见下一段，这是为了解决「资源循环卡住」。
 *
 * ---- 为什么要抬高低阶产出（2026-09-23 实测校准） ----
 * 无头跑真实构建产物 2 万次翻转的实测：扣盖率 45.2%、正立 41.8%、翻倒 13%，
 * 平均 $2.68/次点击。于是：
 *   · 攒 $1,000 买履带            ≈   364 次点击（约 4 分钟）—— 这一段没问题；
 *   · 原版口径（T1 = 1 枚）的瓶盖流速 ≈ 0.45 枚/点击
 *     → 研发 T2 要 1,600 瓶盖    ≈ 3,500 次点击（约 36 分钟）。
 * 而 `MILESTONES` 里 M10「研发解锁 T2 铜质能量瓶」的阈值是 948 进度，
 * 按金币流水折算 ≈ 350 次点击 —— **里程碑在 350 次点击就报「该解锁 T2 了」，
 * 实际却要 3,500 次点击才买得起，差了 10 倍**，玩家感觉就是「循环卡死了」。
 * 把 T1 基础产出提到 4 枚（流速 1.8 枚/点击）后：
 *   · 研发 T2（1,600 瓶盖）   ≈ 890 次点击（约 9 分钟）；
 *   · T2 的瓶盖流速 2.7 枚/点击 → 研发 T3（4,800 瓶盖）≈ 1,780 次点击（约 18 分钟）。
 * 前两步落进「一次会话内能摸到」的区间，之后靠助手之手（h_unlock，1,200 瓶盖）
 * 把翻转吞吐从 1.6 次/秒拉到 6~60 次/秒，循环就自己转起来了。
 *
 * ⚠️ 想还原原版口径：`[1, 1, 1, 1, 1, 1, 1]`
 * ⚠️ 想回到「逐阶递增但不加速」：`[1, 2, 3, 4, 5, 6, 7]`
 *    单次扣盖的实际上限仍受同阶 `capgain` 词条（+1/级）与 T4 被动（+1）影响，
 *    与原版一样是「基础值 + 词条 + 被动」。
 */
export const CAP_GAIN_BASE: number[] = [4, 6, 8, 11, 14, 18, 22];

/**
 * 每阶瓶盖的颜色 = 该阶瓶身的**主色调**（用 PIL 从 `bottle/body_N.png` 采样得出），
 * 保证「哪种瓶子掉哪种颜色的盖子」。
 */
export const CAP_COLOR: string[] = [
    '#EDF2F7',  // T1 普通塑料瓶：透明
    '#7BC24E',  // T2 铜质能量瓶：绿
    '#48A8D8',  // T3 白银汽水瓶：蓝
    '#E8A838',  // T4 黄金尊享瓶：琥珀
    '#F2D43C',  // T5 红宝石烈酒瓶：金
    '#E8654F',  // T6 翡翠神圣瓶：红
    '#C89BF0',  // T7 钻石天界瓶：彩虹（每颗再从 CAP_RAINBOW 里随机取色）
];

/** T7 彩虹瓶的瓶盖配色池（逐颗随机，做出「彩盖」的感觉） */
export const CAP_RAINBOW: string[] = ['#FF7BA8', '#FFD24A', '#7BE0A8', '#6FC8F5', '#C89BF0'];

/** 瓶盖表现参数（爆散 → 飞向履带 → 上带行进 三段） */
export const CAP_FX = {
    /** ① 爆散段时长（秒）：从瓶口炸开、四散弹跳 */
    burstTime: 0.34,
    /** 爆散初速（设计像素 / 秒） */
    burstSpeed: 210,
    /** 爆散段重力 */
    burstGravity: -980,
    /** ② 飞向履带段时长 —— 多颗之间按序号错开，形成「一串」 */
    flyTime: 0.42,
    flyStagger: 0.035,
    /** 飞向履带时抛物线拱高 */
    flyArc: 150,
    /** 单次扣盖最多**可见**的瓶盖数（超出的直接结算，避免对象池被打爆） */
    maxVisible: 10,
};

/* ================================================================== *
 *  广告商业化（UI/Ads.ts 统一入口，所有广告都从这里走）
 * ================================================================== */
/** 单次广告增益时长（秒）：金币翻倍 / 瓶盖翻倍 / 光圈变大，3 分钟 */
export const AD_BUFF_SEC = 180;
/** 离线收益广告倍率（看完广告 → 离线收益 ×3） */
export const OFFLINE_AD_MULT = 3;

export const SAVE_KEY = 'tapbottle.save.v1';
export const SAVE_VERSION = 5;

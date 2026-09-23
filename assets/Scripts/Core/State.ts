import {
    ABILITY, ACHIEVEMENTS, AD_BUFF_SEC, BOTTLE_STATS, CAP_GAIN_BASE, FLIP, HAND, MACHINE, MILESTONES, MilestoneDef,
    SKILLS, SkillDef, TIERS, TreeId,
} from './GameConfig';
import { SaveData, defaultSave, loadSave, writeSave, clearSave } from './Save';
import { clamp, clamp01 } from './Util';

/** 单次翻转结果 */
export interface FlipResult {
    amount: number;
    caps: number;
    crit: boolean;      // 扣盖暴击
    success: boolean;
    /** true = 瓶盖已投入履带，要运到顶部回收后才计入 caps */
    deferred: boolean;
}

/** 落地判定三态（GDD §3.1-3） */
export type Outcome = 'crit' | 'ok' | 'fail';

/** 运行时状态：数值派生与全部操作 */
export class State {
    data: SaveData = defaultSave();

    private dirty = true;
    private listeners: Array<() => void> = [];

    onFlip: ((tier: number, r: FlipResult) => void) | null = null;
    onAch: ((id: number) => void) | null = null;
    onBerserk: (() => void) | null = null;
    /** 新达成里程碑（参数 = 阶段号 1..24）；GameRoot 用它弹提示 */
    onMilestone: ((n: number) => void) | null = null;

    /** 履带在途瓶盖总量（回收后并入 data.caps；存档时一并写入防丢失） */
    pendingCaps = 0;

    /* -------- 会话内（不存档） -------- */
    berserkFlips = 0;
    berserkStreak = 0;
    samuraiGauge = 0;
    samuraiTimer = 0;
    samuraiArmed = false;
    idleStamina = 1;
    idleOn = false;

    private epsAcc = 0;
    private cpsAcc = 0;
    private epsTimer = 0;
    /** 已经「播报过」的里程碑阶段号（只用于去重提示，门控一律走派生值） */
    private msSeen = 0;
    /** 上次算过的进度值（tick 每帧调用 syncMilestones 的短路条件） */
    private msProgressSeen = -1;

    get lang() { return this.data.settings.lang; }

    addListener(fn: () => void) { this.listeners.push(fn); this.dirty = true; }
    clearListeners() { this.listeners.length = 0; this.dirty = true; }
    notify() { this.dirty = true; for (const f of this.listeners) { f(); } }

    /* ================= 科技树（消耗瓶盖，GDD §5.1） ================= */
    sk(id: string): number {
        const def = SKILL_BY_ID[id];
        if (!def) { return 0; }
        return def.base + (this.data.skills[id] || 0) * def.step;
    }
    skLv(id: string): number { return this.data.skills[id] || 0; }

    /**
     * 「新」标签的通用已读查询 —— 商店 / 升级 / 技能树共用一份 `seenModules`。
     * id 命名见 Save.ts 的字段注释；**不在集合里的可见项 = 新出现的**。
     */
    itemSeen(id: string): boolean { return (this.data.seenModules || []).indexOf(id) >= 0; }
    markItemSeen(id: string) {
        if (!this.data.seenModules) { this.data.seenModules = []; }
        if (this.data.seenModules.indexOf(id) < 0) { this.data.seenModules.push(id); }
    }
    /** 首次进游戏的一次性「已读基线」（把当时可见的商店/升级项标为已见，避免开局满屏「新」） */
    get seenBaseline() { return this.data.seenBaseline > 0; }
    markBaseline(ids: string[]) {
        for (const id of ids) { this.markItemSeen(id); }
        this.data.seenBaseline = 1;
        this.save();
    }
    skMax(id: string): boolean {
        const def = SKILL_BY_ID[id];
        return !def ? true : this.skLv(id) >= def.max;
    }
    skCost(id: string): number {
        const def = SKILL_BY_ID[id];
        if (!def) { return Infinity; }
        return Math.ceil(def.baseCost * Math.pow(def.growth, this.skLv(id)));
    }
    skDef(id: string): SkillDef | undefined { return SKILL_BY_ID[id]; }
    treeOf(id: string): TreeId | null { return SKILL_BY_ID[id] ? SKILL_BY_ID[id].tree : null; }
    /** 升级科技节点（消耗瓶盖） */
    upgradeSkill(id: string): boolean {
        const def = SKILL_BY_ID[id];
        if (!def || this.skMax(id)) { return false; }
        if (!this.spendCaps(this.skCost(id))) { return false; }
        this.data.skills[id] = this.skLv(id) + 1;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ================= 单瓶词条（11 项 + 悬停解锁，GDD §4.2） ================= */
    private statIdx(id: string): number { return STAT_INDEX[id] ?? -1; }
    statLv(tier: number, id: string): number {
        const i = this.statIdx(id);
        if (i < 0) { return 0; }
        return this.data.tierStats[tier][i] || 0;
    }
    private statParam(tier: number, id: string) {
        const def = STAT_BY_ID[id];
        if (!def) { return null; }
        return def.tiers[Math.min(tier, def.tiers.length - 1)];
    }
    statMaxLevel(tier: number, id: string): number {
        const p = this.statParam(tier, id);
        return p ? p.max : 0;
    }
    statMax(tier: number, id: string): boolean {
        return this.statLv(tier, id) >= this.statMaxLevel(tier, id);
    }
    statCost(tier: number, id: string): number {
        const p = this.statParam(tier, id);
        if (!p) { return Infinity; }
        return Math.ceil(p.base * Math.pow(p.r, this.statLv(tier, id)));
    }
    statCurrency(id: string): 'money' | 'caps' {
        const def = STAT_BY_ID[id];
        return def ? def.currency : 'money';
    }
    /** 词条当前值（add: base + L×step ；mul: base×(1+L×step)） */
    statValue(tier: number, id: string): number {
        const p = this.statParam(tier, id);
        if (!p) { return 0; }
        const def = STAT_BY_ID[id];
        const lv = this.statLv(tier, id);
        return def && def.mode === 'mul' ? p.base * (1 + lv * p.step) : p.base + lv * p.step;
    }
    upgradeStat(tier: number, id: string): boolean {
        if (this.statMax(tier, id)) { return false; }
        if (!this.statUnlocked(id)) { return false; }         // 里程碑没到 → 面板里根本没有这条
        if (!this.tierResearched(tier)) { return false; }     // 未研发的阶数不能升级词条
        const cost = this.statCost(tier, id);
        const ok = this.statCurrency(id) === 'caps' ? this.spendCaps(cost) : this.spendMoney(cost);
        if (!ok) { return false; }
        const i = this.statIdx(id);
        this.data.tierStats[tier][i] = this.statLv(tier, id) + 1;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ---- 悬停翻转：每阶瓶子各自一次性解锁（§4.2 / §4.4-3） ---- */
    hoverUnlocked(tier: number): boolean { return this.statLv(tier, 'hover') > 0; }
    hoverCost(tier: number): number { return TIERS[tier].hoverCost; }
    /** 是否至少有一阶在手的瓶子解锁了悬停（决定光标圈要不要出现） */
    get anyHover(): boolean {
        for (let t = 0; t < 7; t++) { if (this.hoverable(t)) { return true; } }
        return false;
    }
    /** 该阶瓶子能否被「光标悬停」触发 */
    hoverable(tier: number): boolean { return this.data.bottles[tier] > 0 && this.hoverUnlocked(tier); }
    buyHover(tier: number): boolean {
        if (this.hoverUnlocked(tier)) { return false; }
        if (!this.spendMoney(this.hoverCost(tier))) { return false; }
        const i = this.statIdx('hover');
        this.data.tierStats[tier][i] = 1;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ================= 瓶子数值（GDD §4.1 / §4.3） ================= */
    /** M_global：钻石天界瓶在场 → 全场总收益 ×2（T7 被动） */
    get globalMul(): number { return this.data.bottles[6] > 0 ? 2 : 1; }
    /** 该阶单次基础金币（基础收益词条 + 收益倍率乘数词条 + 全局被动） */
    bottleIncome(tier: number): number {
        const d = TIERS[tier];
        const incStep = this.statParam(tier, 'income')!.step;
        const base = d.baseIncome + this.statLv(tier, 'income') * incStep;
        const bonus = this.statLv(tier, 'multiplier') * 0.10;   // 每级 +10%
        return base * (1 + bonus) * this.globalMul;
    }
    /** 全场收益（含所有瓶子） */
    get totalIncomePerFlip(): number {
        let s = 0;
        for (let t = 0; t < 7; t++) { s += this.data.bottles[t] * this.bottleIncome(t); }
        return s;
    }
    /** 落地容差角（§3.1-3：18° × (1 + 0.10 × 精通等级)） */
    tierTolerance(tier: number): number {
        return FLIP.toleranceBase * (1 + FLIP.toleranceStep * this.statLv(tier, 'mastery'));
    }
    /** 扣盖倍率 M_landing（5.0，T2 铜瓶 6.0） */
    critMult(tier: number): number { return TIERS[tier].critMult; }
    /** 该阶可否再购买（同屏上限 30 + 上限词条 +5/级 + 科技树 +5/级） */
    tierCap(tier: number): number {
        return TIERS[tier].cap + this.statLv(tier, 'limit') * 5 + this.skLv('p_sizelimit') * 5;
    }
    /** 翻转速度倍率（每级 +10%） */
    tierFlipSpeed(tier: number): number { return 1 + this.statLv(tier, 'speed') * 0.10; }
    /** 双倍收益几率（每级 +10%） */
    tierDoubleChance(tier: number): number { return clamp01(this.statLv(tier, 'double') * 0.10); }
    /** 连环二次翻转几率（每级 +2%） */
    tierAgainChance(tier: number): number { return clamp01(this.statLv(tier, 'again') * 0.02); }
    /** 随机连锁翻转几率（每级 +2%） */
    tierRandomChance(tier: number): number { return clamp01(this.statLv(tier, 'random') * 0.02); }
    /**
     * 扣盖落地产出的瓶盖枚数。
     *
     * = 该阶基础值 `CAP_GAIN_BASE[tier]`（逐阶递增，原版是七阶全 1，见 GameConfig 注释）
     *   + 该阶「扣盖掉落」词条等级（每级 +1）
     *   + T4 黄金瓶被动 +1
     *
     * ★ 只有 outcome === 'crit'（瓶口朝下 / 完美姿态）才会走到这里 —— 见 doFlipResult；
     *   而且没买瓶盖机器时 doFlipResult 会把结果清零，所以「没解锁传送带」或
     *   「瓶子没倒立扣盖」这两种情况**一律不产出瓶盖、也不会有任何瓶盖特效**。
     */
    tierCapGain(tier: number): number {
        const t = Math.max(0, Math.min(6, tier));
        return CAP_GAIN_BASE[t] + this.statLv(t, 'capgain') + (t >= 3 ? 1 : 0);
    }
    /** 扣盖时额外获得的瓶盖收益（caps 货币词条，结算时折算进金币） */
    tierCapIncome(tier: number): number {
        return this.statLv(tier, 'capincome') * this.statParam(tier, 'capincome')!.step;
    }
    /** 传送带每颗瓶盖的价值（MachineIncomeUpgrade 每级 +10%） */
    get capUnit(): number { return MACHINE.capUnitBase * (1 + this.skLv('p_machineinc') * 0.10); }
    /**
     * 商店购买单价：base × R^k
     *
     * ★ k 的口径（用原版截图实测校准）：**已购买次数**。
     *   T1 开局自带 1 只且不计数 → n=1、已购买 0 次 → 商店显示 **$7**（= base），
     *   正好对上 GDD §4.1「商店第2瓶 $7」与原版截图的「普通瓶 1/30 $7」。
     *   原来是 k = n+1（多乘了一次 R），1/30 时显示成了 $9。
     *   T2+ 没有免费瓶，n 就是已购买次数 → 首次购买 = base（如铜瓶 $2,000）。
     */
    bottleCost(tier: number): number {
        const d = TIERS[tier];
        const n = this.data.bottles[tier];
        if (tier === 0 && n === 0) { return 0; }        // T1 首只自带免费
        const r = Math.max(1.02, d.shopGrowth + this.statLv(tier, 'purchase') * (-0.01));
        const bought = Math.max(0, n - (tier === 0 ? 1 : 0));
        return Math.ceil(d.shopBase * Math.pow(r, bought));
    }
    /** 下一阶待研发的瓶子 */
    nextUnlockTier(): number {
        for (let t = 1; t < 7; t++) { if (!this.tierResearched(t)) { return t; } }
        return -1;
    }
    /** 该阶是否已在科技树研发（T1 恒 true） */
    tierResearched(tier: number): boolean {
        if (tier === 0) { return true; }
        return this.skLv(UNLOCK_SKILL[tier]) > 0;
    }
    canBuyBottle(tier: number): boolean {
        if (this.data.bottles[tier] >= this.tierCap(tier)) { return false; }
        if (!this.tierResearched(tier)) { return false; }
        if (tier === 0 && this.data.bottles[0] === 0) { return true; }
        return this.data.money >= this.bottleCost(tier);
    }
    buyBottle(tier: number): boolean {
        if (this.data.bottles[tier] >= this.tierCap(tier)) { return false; }
        if (!this.tierResearched(tier)) { return false; }
        const cost = this.bottleCost(tier);
        if (cost > 0 && !this.spendMoney(cost)) { return false; }
        this.data.bottles[tier]++;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ================= 助手（GDD §4.4-2 / §5.1 分支 3） ================= */
    get hasHelper() { return this.skLv('h_unlock') > 0; }
    get maxHands() { return HAND.limitBase + this.skLv('h_limit') * HAND.limitStep; }
    /** 寻路移速（4.0 × (1 + 0.05L)） */
    get handSpeed() { return this.sk('h_speed'); }
    /** 目标重选时间（1.5s − 0.15L） */
    get handInterval() { return Math.max(0.3, this.sk('h_repick')); }
    /** 疲劳恢复时间（5s − 0.25L） */
    get handRecovery() { return Math.max(0.5, this.sk('h_recovery')); }
    /** 助手单价：4000 × 1.10^N，h_price 每级压低 0.5% 增长 */
    handCost(): number {
        const r = Math.max(1.01, HAND.priceGrowth + this.skLv('h_price') * (-0.005));
        return Math.ceil(HAND.price * Math.pow(r, this.data.hands));
    }
    buyHand(): boolean {
        if (!this.hasHelper || this.data.hands >= this.maxHands) { return false; }
        if (!this.spendMoney(this.handCost())) { return false; }
        this.data.hands++;
        this.checkAch();
        this.notify();
        return true;
    }
    /** 该阶瓶子是否已被助手「自动化许可」覆盖（T1 天生允许） */
    helperAllowed(tier: number): boolean {
        if (tier === 0) { return true; }
        return this.skLv(HELPER_PERMIT[tier]) > 0;
    }

    /* ================= 玩家科技 ================= */
    get hasCursor() { return this.skLv('p_cursor') > 0; }
    get hasIdle() { return this.skLv('p_idle') > 0; }
    get hasGate() { return this.skLv('p_gateunlock') > 0; }
    /**
     * 瓶盖机器（桌台下方传送带）是否已安装。
     * ★ 原版流程：它**不是**技能树节点，而是在「商店」花 $1,000 金币买的设施；
     *   没买之前桌台下方是空的（不画履带），而且**扣盖根本不产出瓶盖** —— 见 doFlipResult。
     */
    get hasMachine() { return this.data.machine > 0; }
    /** 购买瓶盖机器（商店设施）。返回 false = 金币不够 */
    buyMachine(): boolean {
        if (this.data.machine > 0) { return false; }
        const price = MACHINE.buyPrice;
        if (this.data.money < price) { return false; }
        this.data.money -= price;
        this.data.machine = 1;
        this.save();
        this.notify();
        return true;
    }
    /** 光标吸附半径（px）：0.55m × (1 + 0.05L)；广告增益「光圈变大」期间 ×2 */
    get cursorRadius() { return this.sk('p_cursorsize') * (this.haloBuffOn ? 2 : 1); }

    /* ================= 广告增益（UI/Ads.ts 统一入口激活） ================= */
    /** 增益剩余秒数（0 = 未生效）。到期时间是绝对时间戳 → 离线也在倒计时 */
    adBuffLeft(kind: 'coin' | 'cap' | 'halo'): number {
        const end = (this.data.adBuffs && this.data.adBuffs[kind]) || 0;
        return Math.max(0, (end - Date.now()) / 1000);
    }
    get coinBuffOn(): boolean { return this.adBuffLeft('coin') > 0; }
    get capBuffOn(): boolean { return this.adBuffLeft('cap') > 0; }
    get haloBuffOn(): boolean { return this.adBuffLeft('halo') > 0; }
    /** 激活 / 续上一次 3 分钟增益 */
    activateAdBuff(kind: 'coin' | 'cap' | 'halo') {
        if (!this.data.adBuffs) { this.data.adBuffs = { coin: 0, cap: 0, halo: 0 }; }
        this.data.adBuffs[kind] = Date.now() + AD_BUFF_SEC * 1000;
        this.save();
        this.notify();
    }
    get idleDuration() { return this.sk('p_idletime'); }
    get idleRecovery() { return Math.max(0.5, this.sk('p_idlerecov')); }
    get idleMoveSpeed() { return this.sk('p_idlemove'); }
    /** 翻转稳定性（每级 +5% 抗扰度） */
    get stability() { return this.skLv('p_stability') * FLIP.stabilityStep; }
    /** 履带线速度倍率（每级 +10%） */
    get conveyorMul() { return 1 + this.skLv('p_machinespeed') * 0.10; }
    /** 闸门双倍概率（每级 +10%，满级 100%） */
    get gateChance() { return clamp01(this.skLv('p_gatechance') * 0.10); }

    /* ================= 三大终极技能（§5.1 分支 4 / §5.2） ================= */
    get cokeUnlocked() { return this.skLv('a_coke') > 0; }
    /** 冷却：75s − 20s/级（最低 15s） */
    get cokeCooldown() { return Math.max(ABILITY.coke.cdMin, this.sk('a_cokecd')); }
    /** 同屏可乐数量：1 + L（最多 10） */
    get cokeCount() { return Math.min(ABILITY.coke.countMax, Math.floor(this.sk('a_cokecount'))); }

    get berserkUnlocked() { return this.skLv('a_berserk') > 0; }
    /** 激活所需连续扣盖次数（固定 3） */
    get berserkNeed() { return ABILITY.berserk.need; }
    /** 狂暴有效翻转次数：2 + L（3 级 → 5） */
    get berserkFlipsMax() { return Math.min(ABILITY.berserk.flipsMax, Math.floor(this.sk('a_berserkflips'))); }
    /** 狂暴收益倍率 M_berserk：1.0 + 1.5L（3 级 → 5.5×），红宝石瓶再 ×1.5 */
    get berserkMult(): number {
        let m = this.sk('a_berserkinc');
        if (this.data.bottles[4] > 0) { m *= 1.5; }     // 红宝石瓶被动
        return m;
    }

    get samuraiUnlocked() { return this.skLv('a_samurai') > 0; }
    /** 定格时间：0.8s + 0.3L（3 级 → 1.7s） */
    get samuraiDuration() { return this.sk('a_samuraidur'); }
    /** 处决收益倍率 M_samurai：1.0 + 0.3L */
    get samuraiMult(): number { return this.sk('a_samuraigain'); }
    /** 决意积攒速度（翡翠瓶被动 +25%） */
    get samuraiGainMul(): number { return this.data.bottles[5] > 0 ? 1.25 : 1; }
    get samuraiActive() { return this.samuraiTimer > 0; }

    /* ================= 基础操作 ================= */
    spendMoney(v: number): boolean {
        if (this.data.money < v) { return false; }
        this.data.money -= v; this.notify(); return true;
    }
    spendCaps(v: number): boolean {
        if (this.data.caps < v) { return false; }
        this.data.caps -= v; this.notify(); return true;
    }

    /* ================= 落地判定（角度制，GDD §3.1-3） ================= */
    /**
     * 掷一次落地角度偏差（度，0~180）。
     * 物理近似：目标角取 0°（正立）或 180°（扣盖），叠加一个由质量 / 稳定性科技
     * 决定的近似正态误差；判定用容差角（落地精通）。
     */
    rollLanding(tier: number): number {
        const mass = TIERS[tier].mass;
        let sigma = FLIP.angleVarBase + FLIP.angleVarPerTier * tier;   // 24 → 16.8
        sigma /= Math.sqrt(mass);                                      // 越重落地越沉稳
        sigma *= Math.max(0.35, 1 - this.stability);                    // 稳定性科技 −5%/级
        const target = Math.random() < 0.5 ? 0 : 180;
        const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;   // 近似正态 (-1..1)
        return Math.min(180, Math.abs(target + g * sigma * 1.6));
    }
    /** 角度偏差 → 三态 */
    outcomeOf(tier: number, delta: number): Outcome {
        const tol = this.tierTolerance(tier);
        if (delta <= tol) { return 'ok'; }
        if (Math.abs(180 - delta) <= tol) { return 'crit'; }
        return 'fail';
    }
    /** 直接掷一次三态（内部就是角度制） */
    rollOutcome(tier: number): Outcome { return this.outcomeOf(tier, this.rollLanding(tier)); }

    /** 结算一次翻转（GDD §4.3 统一结算公式） */
    doFlipResult(tier: number, outcome: Outcome): FlipResult {
        this.data.stats.flips++;
        if (outcome === 'fail') {
            this.berserkStreak = 0;
            return { amount: 0, caps: 0, crit: false, success: false, deferred: false };
        }
        let amount = this.bottleIncome(tier);
        let caps = 0;

        // M_landing + 扣盖收益词条
        if (outcome === 'crit') {
            amount *= this.critMult(tier);
            amount += this.tierCapIncome(tier);
        }
        // M_double
        const pc = this.tierDoubleChance(tier);
        if (pc > 0 && Math.random() < pc) { amount *= 2; }
        // M_berserk / M_samurai（武士优先，不叠加）
        if (this.samuraiActive) {
            amount *= this.samuraiMult;
        } else if (this.berserkFlips > 0) {
            amount *= this.berserkMult;
            this.berserkFlips--;
        }
        // 广告增益「金币翻倍」：在原有结算的基础上再结算一倍（Ads.ts 统一入口激活）
        if (this.coinBuffOn) { amount *= 2; }

        this.data.money += amount;
        this.data.stats.earned += amount;
        this.data.stats.best = Math.max(this.data.stats.best, amount);
        this.epsAcc += amount;

        // 瓶盖结算
        //
        // ★ 用户口径（第十四轮）：**树立（ok）或倒立（crit）落地都获得 1 枚对应品质的瓶盖**，
        //   不再按阶给多枚。原版规则保留：没装瓶盖机器就压根没有瓶盖产出 —— 必须先到
        //   「商店」花 $1,000 装上传送带，瓶盖才会开始掉。装好后瓶盖要先沿履带运到
        //   出售箱才真正计入 caps。
        if (!this.hasMachine) { caps = 0; }
        else { caps = this.capBuffOn ? 2 : 1; }   // ok（树立）/ crit（倒立）都给 1 枚（广告「瓶盖翻倍」期间 ×2）；fail 在函数开头已提前返回
        // 装好机器后：瓶盖要先沿履带运到顶端回收槽才真正计入 caps
        const deferred = caps > 0;
        if (caps > 0) { this.pendingCaps += caps; }
        this.cpsAcc += caps;

        // 狂暴：连续扣盖计数
        if (this.berserkUnlocked && !this.samuraiActive) {
            if (outcome === 'crit') {
                this.berserkStreak++;
                if (this.berserkStreak >= this.berserkNeed) {
                    this.berserkStreak = 0;
                    this.berserkFlips = this.berserkFlipsMax;
                    if (this.onBerserk) { this.onBerserk(); }
                }
            } else {
                this.berserkStreak = 0;
            }
        }
        // 决意槽：成功 +1%，扣盖 +15%（翡翠瓶被动再 ×1.25）
        if (this.samuraiUnlocked && !this.samuraiActive) {
            const g = (outcome === 'crit' ? ABILITY.samurai.gainCap : ABILITY.samurai.gainSuccess)
                * this.samuraiGainMul / ABILITY.samurai.gaugeMax;
            this.samuraiGauge = clamp01(this.samuraiGauge + g);
        }

        const res: FlipResult = { amount, caps, crit: outcome === 'crit', success: true, deferred };
        if (this.onFlip) { this.onFlip(tier, res); }
        return res;
    }

    /** 履带回收口：把一颗瓶盖的值真正记入账 */
    recycleCaps(v: number) {
        if (v <= 0) { return; }
        this.data.caps += v;
        this.data.stats.capsEarned += v;
        this.pendingCaps = Math.max(0, this.pendingCaps - v);
    }

    fireSamurai(): boolean {
        if (!this.samuraiUnlocked || this.samuraiArmed || this.samuraiTimer > 0) { return false; }
        if (this.samuraiGauge < 1) { return false; }
        this.samuraiArmed = true;
        return true;
    }
    consumeSamurai() {
        this.samuraiArmed = false;
        this.samuraiGauge = 0;
        this.samuraiTimer = this.samuraiDuration;
    }

    /** 每秒理论收入（离线收益用） */
    get incomePerSec(): number {
        const flipRate = 1 / 0.62;
        return this.totalIncomePerFlip * flipRate * 0.55;
    }

    /* ================= 每帧 ================= */
    tick(dt: number) {
        this.data.stats.time += dt;
        if (this.samuraiTimer > 0) {
            this.samuraiTimer -= dt;
            if (this.samuraiTimer <= 0) { this.samuraiTimer = 0; }
        }
        if (this.hasIdle && this.idleOn) {
            this.idleStamina = Math.max(0, this.idleStamina - dt / Math.max(5, this.idleDuration));
        } else {
            this.idleStamina = clamp01(this.idleStamina + dt / Math.max(1, this.idleRecovery));
        }
        this.epsTimer += dt;
        if (this.epsTimer >= 1) {
            const k = 0.3;
            this.data.eps = this.data.eps * (1 - k) + (this.epsAcc / this.epsTimer) * k;
            this.data.cps = this.data.cps * (1 - k) + (this.cpsAcc / this.epsTimer) * k;
            this.epsAcc = 0; this.cpsAcc = 0; this.epsTimer = 0;
        }
        // 里程碑：每帧低成本短路检查（进度没变直接 return）
        this.syncMilestones();
    }

    /** 离线收益（GDD §6.2）：解锁挂机 100% 效率，否则 50% */
    applyOffline(): { money: number; caps: number; seconds: number } {
        const now = Date.now();
        const last = this.data.last || now;
        this.data.last = now;
        let dt = (now - last) / 1000;
        if (dt < 60) { return { money: 0, caps: 0, seconds: 0 }; }
        dt = Math.min(dt, 4 * 3600);
        const efficiency = this.hasIdle ? 1.0 : 0.5;
        const rate = this.data.eps > 0 ? Math.max(this.data.eps, this.incomePerSec * 0.2) : this.incomePerSec;
        const money = rate * dt * efficiency;
        const caps = this.data.cps * dt * efficiency;
        this.data.money += money;
        this.data.caps += caps;
        this.data.stats.earned += money;
        this.data.stats.capsEarned += caps;
        this.checkAch();
        this.syncMilestones(true);   // 离线期间跳过的阶段静默对齐，避免一进游戏刷一堆提示
        return { money, caps, seconds: dt };
    }

    /* ================= 里程碑成长（GDD §7，24 阶真实阈值） ================= */
    /**
     * 里程碑进度值。
     *
     * GDD §7.2 的「典型达成行为」列混用三种口径（前期「翻转 N 次」、中期「累计金币 N」、
     * 后期「累计瓶盖 N」），而原版只有一个单调递增的阶段号。这里取
     * **max(累计翻转次数, 累计收益 = 金币流水 + 瓶盖流水)**：
     *  - 普通瓶每次成功翻转保底 $1 起 → 前期与「翻转 N 次」等价；
     *  - 中后期流水的指数增长不会卡住阶段；
     *  - 用 `stats.earned` / `capsEarned`（只增不减的**流水**）而不是余额，花钱不会倒退。
     */
    get msProgress(): number {
        const s = this.data.stats;
        return Math.max(s.flips, s.earned + s.capsEarned);
    }
    /** 已达成的里程碑阶段号（0..24，0 = 一个都还没到） */
    get milestone(): number {
        const p = this.msProgress;
        let n = 0;
        for (const m of MILESTONES) { if (p >= m.need) { n = m.n; } else { break; } }
        return n;
    }
    /** 当前阶段的定义（0 阶 → null） */
    get msDef(): MilestoneDef | null {
        const n = this.milestone;
        return n > 0 ? MILESTONES[n - 1] : null;
    }
    /** 下一个目标（全达成 → null） */
    get msNext(): MilestoneDef | null {
        const n = this.milestone;
        return n < MILESTONES.length ? MILESTONES[n] : null;
    }
    /** 通往下一阶段的完成度 0..1 */
    get msRatio(): number {
        const n = this.milestone;
        const next = this.msNext;
        if (!next) { return 1; }
        const prev = n > 0 ? MILESTONES[n - 1].need : 0;
        return clamp01((this.msProgress - prev) / Math.max(1, next.need - prev));
    }
    /** 词条是否已解锁（★ 升级面板开局只放「收入 / 悬停」两条，其余靠里程碑开） */
    statUnlocked(id: string): boolean {
        const def = STAT_BY_ID[id];
        return !!def && def.ms <= this.milestone;
    }
    /** 已解锁的词条条数（用于面板分区标题「6/12」与变更重建检测） */
    get statUnlockedCount(): number {
        let n = 0;
        for (const s of BOTTLE_STATS) { if (s.ms <= this.milestone) { n++; } }
        return n;
    }
    /**
     * 推进里程碑。每次进度真的变化时调用（tick / 结算 / 离线）。
     * `silent = true` 用于读档：把 msSeen 对齐到当前阶段，避免一进游戏刷一堆提示。
     */
    syncMilestones(silent = false) {
        const p = this.msProgress;
        if (p === this.msProgressSeen) { return; }
        this.msProgressSeen = p;
        // 进度推进时通知监听器刷新（里程碑条、HUD 等）
        if (!silent) { this.notify(); }
        const n = this.milestone;
        if (n <= this.msSeen) { return; }
        this.msSeen = n;
        if (silent) { return; }
        if (this.onMilestone) { this.onMilestone(n); }
    }

    /* ================= 成就 ================= */
    hasAch(id: number): boolean { return this.data.ach.indexOf(id) >= 0; }
    private grant(id: number) {
        if (this.hasAch(id)) { return; }
        this.data.ach.push(id);
        if (this.onAch) { this.onAch(id); }
    }
    checkAch() {
        const s = this.data.stats;
        const b = this.data.bottles;
        const g = (id: number, cond: boolean) => { if (cond) { this.grant(id); } };
        g(1, s.flips > 0);
        g(2, s.capsEarned > 0);
        g(3, s.earned >= 1e4);
        g(4, b[1] > 0);
        g(5, this.data.hands >= 1);
        g(6, s.earned >= 1e5);
        g(7, b[2] > 0);
        g(8, s.capsEarned >= 1600);
        g(9, this.data.hands >= 10);
        g(10, s.flips >= 1e4);
        g(11, s.earned >= 1e6);
        g(12, b[3] > 0);
        g(13, s.capsEarned >= 10000);
        g(14, b[4] > 0);
        g(15, this.data.hands >= 30);
        g(16, s.earned >= 1e8);
        g(17, b[5] > 0);
        g(18, b[6] > 0);
        g(19, s.earned >= 1e10);
        g(20, s.flips >= 1e6);
        g(21, this.data.hands >= 100);
        g(22, ['a_coke', 'a_berserk', 'a_samurai'].every(k => this.skMax(k)));
        g(23, SKILLS.every(k => this.skMax(k.id)));
        g(24, this.data.ach.length >= 23);
    }

    /* ================= 存档 ================= */
    save() {
        this.data.last = Date.now();
        writeSave(this.data);
    }
    reset() {
        const st = this.data.settings;
        this.data = defaultSave();
        this.data.settings = st;
        this.pendingCaps = 0;
        this.berserkFlips = 0; this.berserkStreak = 0;
        this.samuraiGauge = 0; this.samuraiTimer = 0; this.samuraiArmed = false;
        this.idleStamina = 1;
        this.msSeen = 0; this.msProgressSeen = -1;
        clearSave();
        this.notify();
    }
}

/* ---------------- 索引 ---------------- */
export const SKILL_BY_ID: Record<string, SkillDef> = {};
for (const s of SKILLS) { SKILL_BY_ID[s.id] = s; }

export const STAT_INDEX: Record<string, number> = {};
for (let i = 0; i < BOTTLE_STATS.length; i++) { STAT_INDEX[BOTTLE_STATS[i].id] = i; }

export const STAT_BY_ID: Record<string, typeof BOTTLE_STATS[number]> = {};
for (const s of BOTTLE_STATS) { STAT_BY_ID[s.id] = s; }

/** 阶数 → 科技树解锁节点 id */
export const UNLOCK_SKILL: string[] = ['', 'ul_t2', 'ul_t3', 'ul_t4', 'ul_t5', 'ul_t6', 'ul_t7'];
/** 阶数 → 助手自动化许可节点 id */
export const HELPER_PERMIT: string[] = ['', 'h_bronze', 'h_silver', 'h_gold', 'h_ruby', 'h_emerald', 'h_diamond'];

export const ACH_BY_ID: Record<number, { title: string; desc: string }> = {};
for (const a of ACHIEVEMENTS) { ACH_BY_ID[a.id] = { title: a.title, desc: a.desc }; }

/** 全局单例 */
export const G = new State();
G.data = loadSave();

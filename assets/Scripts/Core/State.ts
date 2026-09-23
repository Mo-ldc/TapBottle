import {
    ABILITY, ACHIEVEMENTS, BASE_INCOME, BOTTLE_STATS, HAND, MACHINE, SKILLS, SkillDef,
    TIERS, tierCostScale,
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

/** 运行时状态：数值派生与全部操作 */
export class State {
    data: SaveData = defaultSave();

    private dirty = true;
    private listeners: Array<() => void> = [];

    onFlip: ((tier: number, r: FlipResult) => void) | null = null;
    onAch: ((id: number) => void) | null = null;
    onBerserk: (() => void) | null = null;

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

    get lang() { return this.data.settings.lang; }

    addListener(fn: () => void) { this.listeners.push(fn); this.dirty = true; }
    clearListeners() { this.listeners.length = 0; this.dirty = true; }
    notify() { this.dirty = true; for (const f of this.listeners) { f(); } }

    /* ================= 科技树 ================= */
    sk(id: string): number {
        const def = SKILL_BY_ID[id];
        if (!def) { return 0; }
        return def.base + (this.data.skills[id] || 0) * def.step;
    }
    skLv(id: string): number { return this.data.skills[id] || 0; }
    skMax(id: string): boolean {
        const def = SKILL_BY_ID[id];
        return !def ? true : this.skLv(id) >= def.max;
    }
    skCost(id: string): number {
        const def = SKILL_BY_ID[id];
        if (!def) { return Infinity; }
        return Math.ceil(def.baseCost * Math.pow(def.growth, this.skLv(id)));
    }
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

    /* ================= 单瓶词条 ================= */
    private statIdx(id: string): number { return STAT_INDEX[id] ?? -1; }
    statLv(tier: number, id: string): number {
        const i = this.statIdx(id);
        if (i < 0) { return 0; }
        return this.data.tierStats[tier][i] || 0;
    }
    statMax(tier: number, id: string): boolean {
        const def = STAT_BY_ID[id];
        return !def ? true : this.statLv(tier, id) >= def.max;
    }
    statCost(tier: number, id: string): number {
        const def = STAT_BY_ID[id];
        if (!def) { return Infinity; }
        const lv = this.statLv(tier, id);
        return Math.ceil(def.baseCost * Math.pow(def.growth, lv) * tierCostScale(tier));
    }
    upgradeStat(tier: number, id: string): boolean {
        if (this.statMax(tier, id)) { return false; }
        if (!this.spendMoney(this.statCost(tier, id))) { return false; }
        const i = this.statIdx(id);
        this.data.tierStats[tier][i] = this.statLv(tier, id) + 1;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ================= 瓶子数值 ================= */
    /** 单只该阶瓶子的基础金币（GDD §4.2：Income = 基础 × (1 + 等级×0.25)） */
    bottleIncome(tier: number): number {
        const d = TIERS[tier];
        const incLv = this.statLv(tier, 'income');
        const bonusLv = this.statLv(tier, 'bonus');
        let v = d.mult * BASE_INCOME * (1 + incLv * 0.25) * (1 + bonusLv * 0.08) * (1 + this.sk('g_bonus'));
        if (tier === 6) { v *= 2; }                 // 天界瓶被动：全场 +100%
        return v;
    }
    /** 全场收益（含所有瓶子） */
    get totalIncomePerFlip(): number {
        let s = 0;
        for (let t = 0; t < 7; t++) { s += this.data.bottles[t] * this.bottleIncome(t); }
        return s;
    }
    /** 该阶着陆成功率（GDD：35%→85%） */
    tierSuccess(tier: number): number {
        return clamp01(Math.min(0.85, TIERS[tier].success + this.statLv(tier, 'mastery') * 0.02));
    }
    /** 扣盖暴击概率 */
    get critChance(): number { return clamp01(this.sk('g_crit')); }
    /** 扣盖暴击倍率 */
    critMult(tier: number): number {
        let m = this.sk('g_critmoney');
        if (tier >= 1) { m *= 1.25; }               // 铜瓶被动：扣盖金币 +25%
        return m;
    }
    /** 该阶可否再购买 */
    tierCap(tier: number): number { return TIERS[tier].cap + this.statLv(tier, 'limit'); }
    tierFlipSpeed(tier: number): number { return 1 + this.statLv(tier, 'speed') * 0.04; }
    tierDoubleChance(tier: number): number { return clamp01(this.statLv(tier, 'double') * 0.02); }
    tierAgainChance(tier: number): number {
        let c = this.statLv(tier, 'again') * 0.02;
        if (tier >= 2) { c += 0.10; }               // 白银瓶被动
        return clamp01(c);
    }
    tierCapGain(tier: number): number {
        return this.statLv(tier, 'capgain') + (tier >= 3 ? 1 : 0);   // 黄金瓶被动
    }
    /** 传送带每颗瓶盖的价值（随累计收益成长） */
    get capUnit(): number { return 1 + Math.floor(Math.log10(1 + this.data.stats.earned / 1000)); }
    /** 解锁下一阶所需金币 */
    nextUnlockTier(): number {
        for (let t = 1; t < 7; t++) { if (this.data.bottles[t] === 0) { return t; } }
        return -1;
    }
    bottleCost(tier: number): number {
        const n = this.data.bottles[tier];
        const d = TIERS[tier];
        if (n === 0) { return d.unlockCost; }
        return Math.ceil(d.unlockCost * Math.pow(d.growth, n));
    }
    canBuyBottle(tier: number): boolean {
        const n = this.data.bottles[tier];
        if (n >= this.tierCap(tier)) { return false; }
        if (n === 0 && this.nextUnlockTier() !== tier) { return false; }
        return this.data.money >= this.bottleCost(tier);
    }
    buyBottle(tier: number): boolean {
        const n = this.data.bottles[tier];
        if (n >= this.tierCap(tier)) { return false; }
        if (n === 0 && this.nextUnlockTier() !== tier) { return false; }
        if (!this.spendMoney(this.bottleCost(tier))) { return false; }
        this.data.bottles[tier]++;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ================= 助手 ================= */
    get hasHelper() { return this.skLv('h_unlock') > 0; }
    get maxHands() { return HAND.maxTable[Math.min(this.skLv('h_max'), HAND.maxTable.length - 1)]; }
    get handSpeed() { return this.sk('h_speed'); }
    get handRecovery() { return this.sk('h_recovery'); }
    handCost(): number { return Math.ceil(HAND.price * Math.pow(HAND.priceGrowth, this.data.hands)); }
    buyHand(): boolean {
        if (!this.hasHelper || this.data.hands >= this.maxHands) { return false; }
        if (!this.spendMoney(this.handCost())) { return false; }
        this.data.hands++;
        this.checkAch();
        this.notify();
        return true;
    }

    /* ================= 玩家科技 ================= */
    get hasCursor() { return this.skLv('p_cursor') > 0; }
    get hasIdle() { return this.skLv('p_idle') > 0; }
    get hasGate() { return this.skLv('p_gate') > 0; }
    get hasMachine() { return this.skLv('p_machine') > 0; }
    get cursorSize() { return this.sk('p_cursorsize'); }
    get idleDuration() { return this.sk('p_idletime'); }
    get idleRecovery() { return this.sk('p_idlerecovery'); }
    get conveyorMul() { return this.sk('p_conveyor'); }
    get gateChance() { return clamp01(this.sk('p_gatechance')); }

    /* ================= 技能 ================= */
    get cokeUnlocked() { return this.skLv('a_coke') > 0; }
    get cokeCooldown() { return Math.max(ABILITY.coke.cdMin, this.sk('a_cokecd')); }
    get cokeCount() { return Math.min(ABILITY.coke.countMax, Math.floor(this.sk('a_cokecount'))); }
    get berserkUnlocked() { return this.skLv('a_berserk') > 0; }
    get berserkNeed() { return Math.max(2, Math.floor(this.sk('a_berserkneed'))); }
    get berserkFlipsMax() { return Math.floor(this.sk('a_berserkflips')); }
    get berserkBonus(): number {
        let b = this.sk('a_berserkinc');
        if (this.data.bottles[4] > 0) { b += 0.5; }   // 红宝石瓶被动
        return b;
    }
    get samuraiUnlocked() { return this.skLv('a_samurai') > 0; }
    get samuraiDuration() { return this.sk('a_samuraidur'); }
    get samuraiGainMul(): number {
        let m = this.sk('a_samuraigauge');
        if (this.data.bottles[5] > 0) { m *= 1.25; }  // 翡翠瓶被动
        return m;
    }
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

    /** GDD §3.1：先判定姿态（扣盖暴击 / 正立成功 / 倾覆失败） */
    rollOutcome(tier: number): 'crit' | 'ok' | 'fail' {
        const r = Math.random();
        const crit = this.critChance;
        if (r < crit) { return 'crit'; }
        if (r < crit + this.tierSuccess(tier) * (1 - crit)) { return 'ok'; }
        return 'fail';
    }

    /** 结算一次翻转 */
    doFlipResult(tier: number, outcome: 'crit' | 'ok' | 'fail'): FlipResult {
        this.data.stats.flips++;
        if (outcome === 'fail') {
            this.berserkStreak = 0;
            return { amount: 0, caps: 0, crit: false, success: false, deferred: false };
        }
        let amount = this.bottleIncome(tier);
        let caps = 0;

        if (outcome === 'crit') {
            amount *= this.critMult(tier);
            caps = MACHINE.capUnitBase + this.sk('g_capgain') + this.tierCapGain(tier);
        }
        if (Math.random() < this.tierDoubleChance(tier)) { amount *= 2; }
        if (this.samuraiActive) {
            amount *= (1 + ABILITY.samurai.incomeBonus);
        } else if (this.berserkFlips > 0) {
            amount *= (1 + this.berserkBonus);
            this.berserkFlips--;
        }

        this.data.money += amount;
        this.data.stats.earned += amount;
        this.data.stats.best = Math.max(this.data.stats.best, amount);
        this.epsAcc += amount;

        // 瓶盖结算：解锁履带机器后必须先运到顶端回收才算到手；
        // 未解锁时直接入账（否则前期无法积累瓶盖去解锁机器）
        const deferred = caps > 0 && this.hasMachine;
        if (caps > 0) {
            if (deferred) {
                this.pendingCaps += caps;
            } else {
                this.data.caps += caps;
                this.data.stats.capsEarned += caps;
            }
        }
        this.cpsAcc += caps;

        // 狂暴：连续扣盖计数（GDD §5.1-2）
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
        // 决意槽（GDD §5.1-3）：成功 +1，扣盖 +5
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
        let s = 0;
        for (let t = 0; t < 7; t++) {
            s += this.data.bottles[t] * this.bottleIncome(t);
        }
        const avgSuccess = 0.5 + this.critChance * (this.critMult(0) - 0.5);
        return s * flipRate * avgSuccess;
    }

    /* ================= 每帧 ================= */
    tick(dt: number) {
        this.data.stats.time += dt;
        if (this.samuraiTimer > 0) {
            this.samuraiTimer -= dt;
            if (this.samuraiTimer <= 0) { this.samuraiTimer = 0; }
        }
        if (this.hasIdle && this.idleOn) {
            this.idleStamina = Math.max(0, this.idleStamina - dt / Math.max(10, this.idleDuration));
        } else {
            this.idleStamina = clamp01(this.idleStamina + dt * 0.05 * this.idleRecovery);
        }
        this.epsTimer += dt;
        if (this.epsTimer >= 1) {
            const k = 0.3;
            this.data.eps = this.data.eps * (1 - k) + (this.epsAcc / this.epsTimer) * k;
            this.data.cps = this.data.cps * (1 - k) + (this.cpsAcc / this.epsTimer) * k;
            this.epsAcc = 0; this.cpsAcc = 0; this.epsTimer = 0;
        }
    }

    /** GDD §6.2 离线收益 */
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
        return { money, caps, seconds: dt };
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
        g(3, s.earned >= 1e5);
        g(4, b[1] > 0);
        g(5, this.data.hands >= 1);
        g(6, s.earned >= 1e6);
        g(7, b[2] > 0);
        g(8, s.capsEarned >= 1e5);
        g(9, this.data.hands >= 30);
        g(10, s.flips >= 1e5);
        g(11, s.earned >= 1e7);
        g(12, b[3] > 0);
        g(13, s.capsEarned >= 1e6);
        g(14, b[4] > 0);
        g(15, this.data.hands >= 60);
        g(16, s.earned >= 1e8);
        g(17, b[5] > 0);
        g(18, b[6] > 0);
        g(19, s.earned >= 1e9);
        g(20, s.flips >= 1e6);
        g(21, this.data.hands >= 100);
        g(22, ['a_coke', 'a_berserk', 'a_samurai'].every(k => this.skMax(k)));
        g(23, SKILLS.every(k => this.skMax(k.id)));
        g(24, this.data.ach.length >= 23);
    }

    /* ================= 存档 ================= */
    save() {
        this.data.last = Date.now();
        this.data.pendingCaps = this.pendingCaps;   // 在途瓶盖一并存，读档时结算
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

export const ACH_BY_ID: Record<number, { title: string; desc: string }> = {};
for (const a of ACHIEVEMENTS) { ACH_BY_ID[a.id] = { title: a.title, desc: a.desc }; }

/** 全局单例 */
export const G = new State();
G.data = loadSave();

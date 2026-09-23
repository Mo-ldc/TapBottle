import { sys } from 'cc';
import { BOTTLE_STATS, SAVE_KEY, SAVE_VERSION, TIERS } from './GameConfig';
import { Lang } from './Locale';

export interface SaveData {
    v: number;
    money: number;
    caps: number;
    /** 正在履带上运送、尚未回收的瓶盖（读档时并入 caps） */
    pendingCaps: number;
    /** 每阶拥有的瓶子数量（7） */
    bottles: number[];
    /** 每阶 8 个升级词条的等级（7 × 8） */
    tierStats: number[][];
    hands: number;
    skills: Record<string, number>;
    ach: number[];
    stats: { flips: number; earned: number; capsEarned: number; time: number; best: number };
    settings: {
        hideIncome: boolean; hideCaps: boolean; hideHand: boolean;
        master: number; music: number; sfx: number; lang: Lang;
    };
    last: number;
    eps: number;
    cps: number;
}

function emptyTierStats(): number[][] {
    const out: number[][] = [];
    for (let t = 0; t < TIERS.length; t++) {
        const row: number[] = [];
        for (let i = 0; i < BOTTLE_STATS.length; i++) { row.push(0); }
        out.push(row);
    }
    return out;
}

export function defaultSave(): SaveData {
    return {
        v: SAVE_VERSION,
        money: 0,
        caps: 0,
        pendingCaps: 0,
        bottles: [1, 0, 0, 0, 0, 0, 0],
        tierStats: emptyTierStats(),
        hands: 0,
        skills: {},
        ach: [],
        stats: { flips: 0, earned: 0, capsEarned: 0, time: 0, best: 0 },
        settings: {
            hideIncome: false, hideCaps: false, hideHand: false,
            master: 0.9, music: 0.5, sfx: 0.9, lang: 'zh',
        },
        last: 0,
        eps: 0,
        cps: 0,
    };
}

function normalize(o: any): SaveData {
    const d = defaultSave();
    if (!o || typeof o !== 'object') { return d; }
    const m: SaveData = Object.assign(d, o);
    m.settings = Object.assign(defaultSave().settings, o.settings || {});
    m.stats = Object.assign(defaultSave().stats, o.stats || {});
    m.skills = o.skills && typeof o.skills === 'object' ? o.skills : {};
    if (!Array.isArray(m.ach)) { m.ach = []; }
    if (!Array.isArray(m.bottles) || m.bottles.length !== TIERS.length) { m.bottles = d.bottles; }
    if (!Array.isArray(o.tierStats) || o.tierStats.length !== TIERS.length) {
        m.tierStats = emptyTierStats();
    } else {
        m.tierStats = o.tierStats.map((row: any) => {
            const r: number[] = [];
            for (let i = 0; i < BOTTLE_STATS.length; i++) {
                r.push(typeof row?.[i] === 'number' ? row[i] : 0);
            }
            return r;
        });
    }
    // 数值兜底
    if (typeof m.money !== 'number' || !isFinite(m.money)) { m.money = 0; }
    if (typeof m.caps !== 'number' || !isFinite(m.caps)) { m.caps = 0; }
    // 读档时履带是空的：把在途瓶盖直接结算，避免玩家丢资源
    if (typeof m.pendingCaps !== 'number' || !isFinite(m.pendingCaps) || m.pendingCaps < 0) { m.pendingCaps = 0; }
    if (m.pendingCaps > 0) { m.caps += m.pendingCaps; m.pendingCaps = 0; }
    m.v = SAVE_VERSION;
    return m;
}

export function loadSave(): SaveData {
    try {
        const raw = sys.localStorage.getItem(SAVE_KEY);
        if (!raw) { return defaultSave(); }
        return normalize(JSON.parse(raw));
    } catch (e) {
        console.warn('[Save] load failed', e);
        return defaultSave();
    }
}

export function writeSave(data: SaveData): void {
    try {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[Save] write failed', e);
    }
}

export function clearSave(): void {
    try { sys.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

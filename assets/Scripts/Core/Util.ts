import { Color, Vec3 } from 'cc';
import { Lang } from './Locale';

/** 大数格式化：1.23K / 4.56M / 7.89B ... */
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n: number, digits = 2): string {
    if (!isFinite(n)) { return '∞'; }
    const neg = n < 0;
    n = Math.abs(n);
    if (n < 1000) {
        let s: string;
        if (n === Math.floor(n)) { s = String(n); }
        else { s = n.toFixed(n < 10 ? 1 : 0); }
        return neg ? '-' + s : s;
    }
    let i = 0;
    while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
    const s = n.toFixed(n < 10 ? digits : (n < 100 ? 1 : 0)) + UNITS[i];
    return neg ? '-' + s : s;
}

/** 时间格式化 1h 23m 45s */
export function fmtTime(sec: number): string {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) { return `${h}h ${m}m`; }
    if (m > 0) { return `${m}m ${s}s`; }
    return `${s}s`;
}

export function clamp(v: number, a: number, b: number): number {
    return v < a ? a : (v > b ? b : v);
}

export function clamp01(v: number): number { return clamp(v, 0, 1); }

export function randRange(a: number, b: number): number { return a + Math.random() * (b - a); }

export function chance(p: number): boolean { return Math.random() < p; }

export function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/** 每帧平滑插值系数 */
export function damp(cur: number, target: number, speed: number, dt: number): number {
    return cur + (target - cur) * (1 - Math.exp(-speed * dt));
}

export function hex(c: string): Color {
    const col = new Color();
    Color.fromHEX(col, c);
    return col;
}

export function v3(x: number, y: number, z = 0): Vec3 { return new Vec3(x, y, z); }

/** 在数组里按权重随机 */
export function weightedIndex(weights: number[]): number {
    let sum = 0;
    for (const w of weights) { sum += w; }
    if (sum <= 0) { return 0; }
    let r = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) { return i; }
    }
    return weights.length - 1;
}

/** 数字缓动滚动显示 */
export function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
export function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }
export function easeInQuad(t: number): number { return t * t; }
export function easeOutBack(t: number): number {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function langOf(s: string): Lang { return s === 'en' ? 'en' : 'zh'; }

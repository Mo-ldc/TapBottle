import { _decorator, Component, Node, Sprite, Label, UIOpacity, Vec3 } from 'cc';
import { CAP_COLOR, POOL } from '../Core/GameConfig';
import { Pool } from '../Core/Pool';
import { hex } from '../Core/Util';
import { label, nd, setFrame, TEXT_SS } from '../UI/Base/UIKit';

const { ccclass } = _decorator;

const K_TEXT = 0;
const K_SPRITE = 1;

/**
 * 飘字预制体 key —— 必须与 `Core/Prefabs.ts` 的 `PREFAB_PATHS` 里那条**逐字一致**，
 * 否则 `Pool.acquire` 拿不到（表现为飘字全部消失，但控制台只有一条 missing prefab 警告）。
 */
const PF_FLOAT_TEXT = 'UI/FloatText';

interface FxItem {
    node: Node;
    op: UIOpacity;
    lb: Label | null;
    sp: Sprite | null;
    kind: number;
    active: boolean;
    t: number;
    dur: number;
    x0: number; y0: number;
    vx: number; vy: number; g: number;
    rise: number;
    spin: number;
    s0: number; sMid: number; s1: number;
    fadeStart: number;
    a0: number;
}

function newItem(node: Node | null, kind: number, lb: Label | null, sp: Sprite | null): FxItem {
    // 预制体（FloatText.prefab）里已烘好 UIOpacity；运行时现建的兜底节点才需要补一个
    const op = node ? (node.getComponent(UIOpacity) || node.addComponent(UIOpacity)) : null!;
    if (node) { node.active = false; }
    return {
        node: node as Node, op, lb, sp, kind, active: false, t: 0, dur: 1,
        x0: 0, y0: 0, vx: 0, vy: 0, g: 0, rise: 0, spin: 0,
        s0: 1, sMid: 1, s1: 1, fadeStart: 0.5, a0: 1,
    };
}

/**
 * 表现层：飘字 / 瓶盖爆散 / 星光 / 冲击波 / 闪屏 / 震屏
 *
 * 性能约定（重要）：
 *  1. 所有节点**预建进对象池**，运行时只切换 active + 改数值，绝不 new / destroy / 起 tween；
 *  2. 分成 **精灵层** 与 **文字层** 两个容器：同层相邻节点贴图/字体一致，才能被合批；
 *     文字层在上，保证飘字永远压住粒子；
 *  3. 动画在 update 里手算（位置/缩放/角速度/透明度），零 GC。
 */
@ccclass('FxLayer')
export class FxLayer extends Component {
    static I: FxLayer = null!;

    private spriteLayer: Node = null!;
    private labelLayer: Node = null!;

    private texts: FxItem[] = [];
    private bursts: FxItem[] = [];
    private sparkles: FxItem[] = [];
    private waves: FxItem[] = [];
    private flashes: FxItem[] = [];

    private shakeT = 0;
    private shakeAmp = 0;
    private shakeBase = new Vec3();
    private root: Node = null!;

    onLoad() {
        FxLayer.I = this;
        this.buildLayers();
    }

    /** 精灵层在下、文字层在上 —— 同层相邻即可合批 */
    private buildLayers() {
        this.spriteLayer = nd(this.node, 'fxSprites', 720, 1280, 0, 0);
        this.labelLayer = nd(this.node, 'fxLabels', 720, 1280, 0, 0);

        // 预建：闪屏（全屏白块）
        const fn = nd(this.spriteLayer, 'flash', 1000, 1900, 0, 0);
        const fs = fn.addComponent(Sprite);
        setFrame(fs, 'ui/pixel/px_white2', 1000, 1900);
        this.flashes.push(newItem(fn, K_SPRITE, null, fs));
    }

    bindRoot(root: Node) { this.shakeBase = root.position.clone(); this.root = root; }

    /* ---------------- 池 ---------------- */

    private acquire(pool: FxItem[], cap: number, make: () => FxItem): FxItem | null {
        for (let i = 0; i < pool.length; i++) { if (!pool[i].active) { return pool[i]; } }
        if (pool.length >= cap) { return null; }
        const it = make();
        pool.push(it);
        return it;
    }

    private allocSprite(pool: FxItem[], cap: number, path: string, w: number, h: number): FxItem | null {
        return this.acquire(pool, cap, () => {
            const n = nd(this.spriteLayer, path, w, h, 0, 0);
            const sp = n.addComponent(Sprite);
            setFrame(sp, path, w, h);
            return newItem(n, K_SPRITE, null, sp);
        });
    }

    /** 复用前的统一复位 */
    private reset(it: FxItem, x: number, y: number, dur: number) {
        it.active = true;
        it.t = 0;
        it.dur = dur;
        it.x0 = x; it.y0 = y;
        it.vx = 0; it.vy = 0; it.g = 0; it.rise = 0; it.spin = 0;
        it.s0 = 1; it.sMid = 1; it.s1 = 1;
        it.fadeStart = 0.5; it.a0 = 1;
        it.node.active = true;
        it.node.setPosition(x, y, 0);
        it.node.angle = 0;
        it.node.setScale(1, 1, 1);
        it.op.opacity = 255;
    }

    /* ---------------- 飘字（金币 / 瓶盖 / 提示） ---------------- */

    /**
     * 飘字（金币 `+$12` / 瓶盖 `+1` / 提示文本）——**节点来自预制体对象池**。
     *
     * ★ 第三十九轮改动：以前节点是这里 `nd()+label()` 现建、由 FxItem 数组切 active
     *   做「伪池化」——同屏飘字一多，节点只会越建越多（Label/UIOpacity/顶点数据都不回收），
     *   长局等于稳定泄漏。现在统一走 `Prefabs/UI/FloatText` + `Pool.acquire/release`：
     *   播完立即归还，稳态下**零 instantiate**，FxItem 退化为纯元数据（不再持有节点）。
     *
     * ⚠️ 字号/行高必须 ×TEXT_SS：预制体里的 Label 是按 UIKit 的超采样口径烘的
     *   （盒子 ×2、fontSize ×2、节点 scale 0.5），直接写 `lb.fontSize = size` 会显示成一半大。
     */
    floatText(x: number, y: number, text: string, color: string, size = 34, dy = 90, dur = 0.85): Node | null {
        const it = this.allocText();
        if (!it) { return null; }
        const lb = it.lb!;
        lb.string = text;
        lb.fontSize = size * TEXT_SS;
        lb.lineHeight = size * 1.15 * TEXT_SS;
        this.reset(it, x, y, dur);
        lb.color = hex(color);
        it.rise = dy;
        it.fadeStart = 0.42;
        return it.node;
    }

    /**
     * 取一条空闲的飘字项：元数据对象复用 + 节点从 Pool 借。
     * 返回 null 表示「同屏飘字已达 POOL.floatText 上限」或池不可用，调用方直接放弃这一次。
     */
    private allocText(): FxItem | null {
        let it: FxItem | null = null;
        for (let i = 0; i < this.texts.length; i++) {
            if (!this.texts[i].active) { it = this.texts[i]; break; }
        }
        if (!it) {
            if (this.texts.length >= POOL.floatText) { return null; }
            it = newItem(null, K_TEXT, null, null);
            this.texts.push(it);
        }
        let n = Pool.acquire(PF_FLOAT_TEXT, this.labelLayer);
        if (!n) {
            // 预制体没就绪（独立预览 Game 场景、没经过 Load 场景的预载）→ 退回运行时现建，
            // 保证特效不消失。归还时同样进 Pool，下一次就能直接复用这个节点。
            n = nd(this.labelLayer, 'ft', 300, 60, 0, 0);
            label(n, '', 0, 0, 300, 60, { size: 30, color: '#FFFFFF', outline: '#141821', outlineWidth: 3 });
        }
        const lb = n.getComponentInChildren(Label);
        if (!lb) {
            console.warn('[Fx] FloatText 预制体里没有 Label，飘字节点已退回池');
            Pool.release(PF_FLOAT_TEXT, n);
            return null;
        }
        it.node = n;
        it.op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
        it.lb = lb;
        it.sp = null;
        return it;
    }

    /**
     * 预热飘字节点（进场景后一次性建好，避免第一只瓶子落地时 instantiate 掉帧）。
     * 预制体没加载完时 `Pool.warm` 会静默返回，不会报错。
     */
    warmup(count = 8) { Pool.warm(PF_FLOAT_TEXT, count); }

    /* ---------------- 瓶盖爆散 ---------------- */

    /**
     * 瓶盖爆散（一次性喷 N 枚瓶盖粒子）。
     *
     * ⚠️ 现在**没有调用点**：实体瓶盖的爆散由 `CapMachine.spawnChips` 的爆散段负责，
     *    它才知道「这一下到底有没有产出瓶盖」。保留此方法仅供特效复用。
     */
    burst(x: number, y: number, count = 7, tier = 0) {
        const tint = hex(CAP_COLOR[Math.min(6, Math.max(0, tier))]);
        for (let i = 0; i < count; i++) {
            const it = this.allocSprite(this.bursts, POOL.burst, 'bottle/capchip_6', 34, 30);
            if (!it) { return; }
            this.reset(it, x, y, 0.6 + Math.random() * 0.35);
            const ang = (-150 + Math.random() * 240) * Math.PI / 180;
            const spd = 160 + Math.random() * 220;
            it.vx = Math.cos(ang) * spd;
            it.vy = Math.abs(Math.sin(ang)) * spd;
            it.g = -900;
            it.spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360);
            it.fadeStart = 0.5;
            it.sp!.color = tint;
        }
    }

    /* ---------------- 星光 ---------------- */

    sparkle(x: number, y: number, size = 70, color = '#FFF6C0') {
        const it = this.allocSprite(this.sparkles, POOL.sparkle, 'env/star', 64, 64);
        if (!it) { return; }
        const k = size / 64;
        this.reset(it, x, y, 0.46);
        it.s0 = 0.25 * k; it.sMid = 1.1 * k; it.s1 = 0.55 * k;
        it.spin = 220;
        it.fadeStart = 0.5;
        it.sp!.color = hex(color);
    }

    /* ---------------- 冲击波 ---------------- */

    shockwave(x: number, y: number, maxR = 420, dur = 0.45, color = '#FFFFFF') {
        const it = this.allocSprite(this.waves, POOL.shockwave, 'env/shockwave', 64, 64);
        if (!it) { return; }
        const k = maxR / 64;
        this.reset(it, x, y, dur);
        it.s0 = 1; it.sMid = (1 + k) * 0.5; it.s1 = k;
        it.fadeStart = 0;
        it.sp!.color = hex(color);
    }

    /* ---------------- 闪屏 ---------------- */

    flash(color: string, alpha = 90, dur = 0.3) {
        const it = this.acquire(this.flashes, 3, () => {
            const n = nd(this.spriteLayer, 'flash', 1000, 1900, 0, 0);
            const sp = n.addComponent(Sprite);
            setFrame(sp, 'ui/pixel/px_white2', 1000, 1900);
            return newItem(n, K_SPRITE, null, sp);
        });
        if (!it) { return; }
        this.reset(it, 0, 0, dur);
        it.sp!.color = hex(color);
        it.fadeStart = 0;
        it.a0 = Math.max(0, Math.min(1, alpha / 255));
        it.op.opacity = 255 * it.a0;
    }

    /* ---------------- 震屏 ---------------- */

    shake(amp = 8, dur = 0.25) {
        this.shakeAmp = Math.max(this.shakeAmp, amp);
        this.shakeT = Math.max(this.shakeT, dur);
    }

    /* ---------------- 每帧（手算，零 tween） ---------------- */

    update(dt: number) {
        if (this.shakeT > 0 && this.root) {
            this.shakeT -= dt;
            const k = Math.max(0, this.shakeT) * 4;
            const a = this.shakeAmp * Math.min(1, k);
            this.root.setPosition(
                this.shakeBase.x + (Math.random() - 0.5) * a * 2,
                this.shakeBase.y + (Math.random() - 0.5) * a * 2,
                this.shakeBase.z);
            if (this.shakeT <= 0) { this.root.setPosition(this.shakeBase); this.shakeAmp = 0; }
        }
        this.step(this.texts, dt, PF_FLOAT_TEXT);
        this.step(this.bursts, dt);
        this.step(this.sparkles, dt);
        this.step(this.waves, dt);
        this.step(this.flashes, dt);
    }

    /**
     * 每帧推进一组特效项。`poolKey` 非空时，播放结束把节点**归还通用对象池**
     * （见 Pool.ts：只摘父+隐藏+入池，不销毁）；否则退回旧的「仅 active=false 留在层里」。
     */
    private step(arr: FxItem[], dt: number, poolKey = '') {
        for (let i = 0; i < arr.length; i++) {
            const it = arr[i];
            if (!it.active) { continue; }
            // 切场景后节点已随旧场景销毁 → 直接丢弃本条（池里那份引用由 Pool 自己验活）
            if (!it.node || !it.node.isValid) { it.active = false; continue; }
            it.t += dt;
            const p = it.t / it.dur;
            if (p >= 1) {
                it.active = false;
                if (poolKey) {
                    Pool.release(poolKey, it.node);
                    it.node = null!; it.op = null!; it.lb = null; it.sp = null;
                } else {
                    it.node.active = false;
                }
                continue;
            }

            if (it.kind === K_TEXT) {
                // 上浮：先快后慢
                const e = 1 - (1 - p) * (1 - p);
                it.node.setPosition(it.x0, it.y0 + it.rise * e, 0);
            } else {
                it.node.setPosition(
                    it.x0 + it.vx * it.t,
                    it.y0 + it.vy * it.t + 0.5 * it.g * it.t * it.t,
                    0);
                if (it.spin !== 0) { it.node.angle = it.spin * it.t; }
                const s = p < 0.5
                    ? it.s0 + (it.sMid - it.s0) * (p * 2)
                    : it.sMid + (it.s1 - it.sMid) * ((p - 0.5) * 2);
                it.node.setScale(s, s, 1);
            }

            if (p > it.fadeStart) {
                const a = 1 - (p - it.fadeStart) / (1 - it.fadeStart);
                it.op.opacity = Math.max(0, a * 255 * it.a0);
            } else {
                it.op.opacity = 255 * it.a0;
            }
        }
    }
}

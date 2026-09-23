import { _decorator, Component, Node, Sprite, Color, Label } from 'cc';
import { CHIP_TINT, LAYOUT, MACHINE, POOL } from '../Core/GameConfig';
import { G } from '../Core/State';
import { fmt } from '../Core/Util';
import { FxLayer } from './Fx';
import { label, nd, rect, roundedPanel, setFrame } from '../UI/UIKit';

const { ccclass } = _decorator;

/** 履带上的一颗瓶盖 */
interface Chip {
    node: Node;
    sp: Sprite;
    active: boolean;
    /** 0 = 从瓶子飞向履带入口；1 = 在履带上行 */
    phase: number;
    t: number;                // 飞行已用时
    ft: number;               // 飞行总时长
    sx: number; sy: number;   // 起飞点（本地坐标）
    lane: number;             // 履带中线（本地 x）
    x: number; y: number;     // 当前坐标
    value: number;
    gated: boolean;
    spin: number;
    jitter: number;           // 抖动相位
    tier: number;
}

/** 瓶盖统一贴图：靠染色区分品阶 → 全带瓶盖共用一张图，天然合批 */
const CHIP_TEX = 'bottle/capchip_0';

/**
 * 左侧竖向瓶盖履带（对照原版 Bottle Flip Inc 的回收履带）。
 *
 * 流程：瓶子扣盖 → 瓶盖飞向履带**最下方**入口 → 沿履带**向上**输送
 *      → 顶部回收槽回收后才真正计入 G.data.caps → 用于解锁技能树。
 * 未解锁 p_machine 时瓶盖直接入账（否则前期拿不到瓶盖去解锁履带）。
 *
 * 性能约定：瓶盖节点**开局一次性预建进池**（POOL.chip 个），
 * 运行时只切 active + 改坐标/颜色，**不用 tween、不用 scheduleOnce、不 new**；
 * 池满时多出来的瓶盖直接入账，既不吞资源也不爆节点。
 */
@ccclass('CapMachine')
export class CapMachine extends Component {
    static I: CapMachine = null!;

    private chipsNode: Node = null!;
    private pool: Chip[] = [];
    private binLb: Label = null!;
    private hintLb: Label = null!;
    private gateNode: Node = null!;
    private beltNode: Node = null!;

    private built = false;
    private beltOn = false;         // 缓存锁定状态，避免每帧改颜色
    private gateOn = false;
    private lastBin = -1;           // 缓存 +N 文本，避免每帧重建 Label
    private churn = 0;

    onLoad() { CapMachine.I = this; }
    start() {
        this.build();
        // 没装机器时整个节点是 active=false（连 update 都不跑），
        // 所以必须靠这条全局监听把自己「叫醒」——商店买下机器会 notify()。
        G.addListener(() => this.refreshLock());
    }

    /* ---------------- 搭建 ---------------- */
    private build() {
        if (this.built) { return; }
        this.built = true;

        const BW = 96;
        const top = LAYOUT.beltTop;
        const bot = LAYOUT.beltBottom;
        const len = top - bot;
        const mid = (top + bot) / 2;

        roundedPanel(this.node, LAYOUT.railW, len + 52, 0, mid, '#131924EE', 26, '#39445C', 4, 'railFrame');

        this.beltNode = nd(this.node, 'belt', BW, len - 16, 0, mid);
        setFrame(this.beltNode.addComponent(Sprite), 'env/belt', BW, len - 16);

        const bin = nd(this.node, 'bin', LAYOUT.railW + 18, 152, 0, LAYOUT.recycleY);
        setFrame(bin.addComponent(Sprite), 'env/machine', LAYOUT.railW + 18, 152);

        const ric = nd(this.node, 'recycleIcon', 52, 58, 0, LAYOUT.recycleY + 26);
        setFrame(ric.addComponent(Sprite), 'env/recycle', 52, 58);

        this.binLb = label(this.node, '+0', 0, LAYOUT.recycleY - 32, 132, 40, {
            size: 26, color: '#9FE3FF', outline: '#0B1A24', outlineWidth: 3,
        });

        roundedPanel(this.node, BW + 14, 24, 0, bot - 12, '#080C12', 9, '#3E4A61', 3, 'chute');

        const gateY = bot + len * MACHINE.gateAt;
        this.gateNode = nd(this.node, 'gate', BW + 16, 20, 0, gateY);
        const gs = this.gateNode.addComponent(Sprite);
        setFrame(gs, 'ui/px_white2', BW + 16, 20);
        gs.color = new Color(232, 200, 96, 235);
        rect(this.gateNode, 18, 30, -(BW / 2 + 2), 0, '#C8A44A', 'postL');
        rect(this.gateNode, 18, 30, (BW / 2 + 2), 0, '#C8A44A', 'postR');

        this.hintLb = label(this.node, '', 0, mid - 60, 150, 34, {
            size: 19, color: '#7E8CA6', hAlign: 'center', anchorX: 0.5,
        });

        // 瓶盖容器 + 对象池（一次性预建，之后永不 new/destroy）
        this.chipsNode = nd(this.node, 'chips', 320, 1000, 0, 0);
        for (let i = 0; i < POOL.chip; i++) {
            const n = nd(this.chipsNode, 'chip', 40, 36, 0, 0);
            const sp = n.addComponent(Sprite);
            setFrame(sp, CHIP_TEX, 40, 36);
            n.active = false;
            this.pool.push({
                node: n, sp, active: false, phase: 0, t: 0, ft: 1,
                sx: 0, sy: 0, lane: 0, x: 0, y: 0, value: 0,
                gated: false, spin: 0, jitter: 0, tier: 0,
            });
        }

        this.refreshLock(true);
    }

    /**
     * 锁定状态变化时才改颜色/显隐。
     *
     * ★ 原版开局：桌台下方**什么都没有** —— 未买瓶盖机器时不是「变暗的履带」，
     *   而是整块不存在。所以这里直接切 `node.active`，连履带框/料斗/+N 文本一起隐掉。
     */
    private refreshLock(force = false) {
        const on = G.hasMachine;
        const gate = on && G.hasGate;
        if (!force && on === this.beltOn && gate === this.gateOn) { return; }
        this.beltOn = on;
        this.gateOn = gate;

        this.node.active = on;
        if (!on) { this.releaseAll(); return; }

        const sp = this.beltNode ? this.beltNode.getComponent(Sprite) : null;
        // 压暗履带底色，让瓶盖在带上更醒目
        if (sp) { sp.color = new Color(146, 158, 182, 255); }
        if (this.gateNode) { this.gateNode.active = gate; }
        if (this.hintLb && this.hintLb.isValid) { this.hintLb.node.active = false; this.hintLb.string = ''; }
    }

    /* ---------------- 投料 ---------------- */

    /**
     * @param count 瓶盖个数
     * @param tier  瓶子阶数（决定染色）
     * @param absX  世界层设计坐标 X（瓶子位置）
     * @param absY  世界层设计坐标 Y
     */
    spawnChips(count: number, tier: number, absX: number, absY: number) {
        if (!G.hasMachine || count <= 0) { return; }
        if (!this.built || !this.node || !this.node.isValid) { this.build(); }

        const n = Math.max(1, Math.min(8, Math.floor(count)));
        const per = Math.floor(count / n);
        const rem = count - per * n;
        const localX = absX - LAYOUT.railX;

        for (let i = 0; i < n; i++) {
            const v = per + (i < rem ? 1 : 0);
            if (v <= 0) { continue; }
            const c = this.acquire();
            // 池满：直接入账，绝不吞资源
            if (!c) { G.recycleCaps(v); continue; }

            c.active = true;
            c.phase = 0;
            c.t = 0;
            c.ft = MACHINE.flyTime + i * 0.02;
            c.sx = localX + (Math.random() - 0.5) * 10;
            c.sy = absY;
            c.lane = (Math.random() - 0.5) * 46;
            c.x = c.sx;
            c.y = c.sy;
            c.value = v;
            c.gated = false;
            c.tier = tier;
            c.spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 240);
            c.jitter = Math.random() * 6.283;

            const node = c.node;
            node.active = true;
            node.setPosition(c.sx, c.sy, 0);
            node.angle = 0;
            node.setScale(1.25, 1.25, 1);
            this.tint(c, CHIP_TINT[Math.min(6, Math.max(0, tier))]);
        }
    }

    /** 染色是逐顶点数据，不会打断合批 */
    private tint(c: Chip, tint: string) {
        c.sp.color.set(
            parseInt(tint.slice(1, 3), 16),
            parseInt(tint.slice(3, 5), 16),
            parseInt(tint.slice(5, 7), 16),
            255);
    }

    private acquire(): Chip | null {
        for (let i = 0; i < this.pool.length; i++) {
            if (!this.pool[i].active) { return this.pool[i]; }
        }
        return null;
    }

    private releaseAll() {
        for (let i = 0; i < this.pool.length; i++) {
            const c = this.pool[i];
            if (!c.active) { continue; }
            c.active = false;
            c.node.active = false;
            G.recycleCaps(c.value);
        }
    }

    /* ---------------- 每帧（手算，零 tween） ---------------- */

    update(dt: number) {
        if (!this.built) { this.build(); }
        this.refreshLock();
        if (!G.hasMachine) { return; }

        // +N 文本只在整数变化时写，避免每帧触发 Label 重建
        const pend = Math.round(G.pendingCaps);
        if (pend !== this.lastBin && this.binLb && this.binLb.isValid) {
            this.lastBin = pend;
            this.binLb.string = '+' + fmt(pend);
        }

        const speed = MACHINE.beltSpeed * G.conveyorMul;
        const bot = LAYOUT.beltBottom;
        const top = LAYOUT.beltTop;
        const span = top - bot;
        const gateY = bot + span * MACHINE.gateAt;
        const entryY = bot + 28;
        const hasGate = G.hasGate;
        const gateChance = G.gateChance;
        let recycled = 0;
        let lastVal = 0;
        let lastX = 0;

        for (let i = 0; i < this.pool.length; i++) {
            const c = this.pool[i];
            if (!c.active) { continue; }

            if (c.phase === 0) {
                // 飞行段：抛物线，手算，无 tween
                c.t += dt;
                let p = c.t / c.ft;
                if (p >= 1) {
                    p = 1;
                    c.phase = 1;
                    c.x = c.lane;
                    c.y = entryY;
                } else {
                    c.x = c.sx + (c.lane - c.sx) * p;
                    c.y = c.sy + (entryY - c.sy) * p + 110 * 4 * p * (1 - p);
                }
                c.node.setPosition(c.x, c.y, 0);
                c.node.angle = c.spin * c.t;
                const s = 1.25 - 0.25 * p;
                c.node.setScale(s, s, 1);
                continue;
            }

            // 履带段
            c.y += speed * dt;
            c.jitter += dt * 6;
            c.x = c.lane + Math.sin(c.jitter) * 3;
            const stack = 1 - (c.y - bot) / span;
            const s = 1.25 - stack * 0.35;
            c.node.setPosition(c.x, c.y, 0);
            c.node.setScale(s, s, 1);

            if (!c.gated && hasGate && c.y >= gateY) {
                c.gated = true;
                if (Math.random() < gateChance) {
                    c.value *= MACHINE.gateMult;
                    this.tint(c, '#FFE894');
                    FxLayer.I?.sparkle(LAYOUT.railX + c.x, gateY, 40, '#FFE07A');
                }
            }

            if (c.y >= top) {
                G.recycleCaps(c.value);
                recycled++;
                lastVal = c.value;
                lastX = c.x;
                c.active = false;
                c.node.active = false;
            }
        }

        if (recycled > 0) {
            this.churn += dt;
            if (this.churn > 0.22) { this.churn = 0; G.checkAch(); }
            if (!G.data.settings.hideCaps) {
                FxLayer.I?.floatText(LAYOUT.railX + lastX + 46, top + 26, '+' + fmt(lastVal), '#7FE1FF', 24, 46, 0.55);
            }
        }
    }

    onDestroy() { this.pool.length = 0; }
}

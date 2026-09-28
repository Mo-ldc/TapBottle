import { _decorator, Component, Node, Sprite, Color, Label, Graphics } from 'cc';
import { CAP_COLOR, CAP_FX, CAP_RAINBOW, MACHINE, POOL, TIERS, WORLD_XFORM } from '../Core/GameConfig';
import { G } from '../Core/State';
import { fmt, hex } from '../Core/Util';
import { Res } from '../Core/Res';
import { Prefabs } from '../Core/Prefabs';
import { FxLayer } from './Fx';
import { label, nd, setFrame } from '../UI/Base/UIKit';
import { beltFace, WOOD, woodPlate, woodRail } from '../UI/Base/Theme';

const { ccclass, property } = _decorator;

/**
 * 履带上的一颗瓶盖。
 *
 * 生命周期两段（`phase`）：
 *   1 = **飞向履带**：直接从瓶口沿抛物线飞进右端入料机（第十四轮起不再爆散）
 *   2 = **上带行进**：沿履带**向左**，经过闸门判定，到左端出售箱回收入账
 */
interface Chip {
    node: Node;
    sp: Sprite;
    active: boolean;
    phase: number;
    t: number;                // 当前段已用时
    /** 爆散段时长（每颗略不同 → 看起来是一串而不是齐射） */
    bt: number;
    ft: number;               // 飞行段总时长
    bx: number; by: number;   // 爆散起点（= 本节点局部坐标下的瓶口）
    vx: number; vy: number;   // 爆散初速
    fx: number; fy: number;   // 飞行起点（爆散结束时的位置）
    lane: number;             // 入料口的 y 抖动
    x: number; y: number;
    value: number;
    gated: boolean;
    spin: number;
    jitter: number;
    tier: number;
}

/** 瓶盖统一贴图：靠染色区分品阶 → 全带瓶盖共用一张图，天然合批
 *  （预制体 `Prefabs/Game/Cap` 里烘的就是这张；这里保留常量给兜底路径与箱体图示用） */
const CHIP_TEX = 'bottle/capchip_6';   // capchip_0 已随废弃资源清理移除（2026-09-28），兜底图改用顶栏瓶盖贴图
const CHIP_W = 40, CHIP_H = 36;

/** 瓶盖预制体 key（`Prefabs/Game/Cap`）—— 池节点的实例来源 */
const CAP_PREFAB = 'Game/Cap';

/**
 * 预建染色 Color（★ 第四十三轮优化）。
 * ⚠️ 之前每颗瓶盖 `new Color(...)` → 一次扣盖最多分配几十个 Color 对象，白给 GC 压力；
 *    现在按阶预建常量，`tint` 直接赋引用（Sprite.color 的 setter 会把值拷进内部 _color，
 *    共享同一 Color 实例是安全的）。
 */
const TIER_COLOR: Color[] = CAP_COLOR.map((c) => new Color(
    parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255));
const RAINBOW_COLOR: Color[] = CAP_RAINBOW.map((c) => new Color(
    parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255));
/** 闸门翻倍后的高亮色（原 #FFE894） */
const GATE_GOLD = new Color(255, 232, 148, 255);

/** 该阶瓶子用的瓶身美术编号（TIERS[tier].art）—— 红宝石瓶(art 5)/黄金瓶(art 4) 与阶序是错位的 */
function capArt(tier: number): number {
    return TIERS[Math.max(0, Math.min(6, tier | 0))].art;
}

/** 取某阶瓶盖的颜色常量引用（按**瓶身美术编号**取色，保证「哪种瓶子掉哪种颜色的盖子」；
 *  T7 钻石瓶(art 6) 逐颗随机取彩虹色）。
 *  ⚠️ 第四十七轮：原来按 tier 直接当数组下标 —— 而 CAP_COLOR 是按美术序（body_0..6）排的，
 *     art 序在 4/5 两阶与阶序互换 → 红宝石瓶掉金盖、黄金瓶掉红盖（用户实测反馈）。 */
function capColor(tier: number): Color {
    const a = capArt(tier);
    if (a === 6) { return RAINBOW_COLOR[(Math.random() * RAINBOW_COLOR.length) | 0]; }
    return TIER_COLOR[a];
}

/**
 * 桌底**横置**瓶盖履带（对照参考图）。
 *
 * 结构：右端深色入料机（瓶盖飞进黑色滚轮）→ 中段深色履带（向左输送）
 *      → 左端出售箱（回收计费）。瓶盖运到出售箱才真正计入 G.data.caps，用于解锁技能树。
 *
 * 关键点：
 *  ① 它挂在 **navRoot**（UI 层）而不是世界层 —— 履带在参考图里是通栏家具，
 *     不该跟着舞台缩放一起变小；同时它紧跟底栏上方，跟着底栏一起贴屏幕底。
 *  ② 瓶盖的起飞点是**世界坐标**（瓶子在哪），靠 WORLD_XFORM 换算成 UI 局部坐标。
 *  ③ ★ **瓶盖特效的唯一出口**：没装机器（G.hasMachine=false）时 spawnChips 直接返回，
 *     而 State.doFlipResult 也早已把 caps 归零 —— 所以「没解锁传送带」绝不掉盖子；
 *     而非完美落地（ok / fail）根本不会走到 spawnChips，也绝不掉盖子。
 *  ④ 性能：瓶盖节点开局一次性预建进池（POOL.chip 个），运行时只切 active + 改坐标/颜色，
 *     不用 tween、不用 scheduleOnce、不 new；池满时多出来的直接入账。
 *
 * 未装机器时整个节点 active=false（连 update 都不跑）→ 必须靠 G.addListener 叫醒。
 */
@ccclass('CapMachine')
export class CapMachine extends Component {
    static I: CapMachine = null!;

    @property({ type: Node, tooltip: '瓶盖容器（chips；对象池节点运行时建在里面）' })
    chipsNode: Node = null!;
    @property({ type: Node, tooltip: '双倍闸门（gate，x 由 MACHINE.gateAt 配置驱动）' })
    gateNode: Node = null!;
    @property({ type: Label, tooltip: '在途计数（binLb，贴在出售箱上方）' })
    binLb: Label = null!;
    private pool: Chip[] = [];
    private beltNode: Node = null!;

    private built = false;
    private beltOn = false;
    private gateOn = false;
    private lastBin = -1;
    private churn = 0;
    /** 在途数文本节流计时（第四十三轮） */
    private binAcc = 0;
    /** 入账飘字：间隔内累加金额 + 计时（第四十三轮合并节流） */
    private fxAcc = 0;
    private fxCt = 0;

    onLoad() { CapMachine.I = this; }
    start() {
        this.build();
        G.addListener(() => this.refreshLock());
    }

    /* ---------------- 搭建 ---------------- */
    /**
     * ★ 场景实体化优先：belt 节点下已摆好履带外观（railTop/railBot/belt/bin/feeder/gate/binLb/chips）
     *   → 只绑引用；否则运行时现建（与场景树逐节点同构）。
     *   闸门 x 始终由 MACHINE.gateAt 配置驱动（改配置不用回场景重摆）。
     */
    private build() {
        if (this.built) { return; }
        this.built = true;

        if (!this.bindScene()) { this.construct(); }
        this.reskinBelt();
        this.reskinGate();
        this.ensurePool();

        // 双倍闸门位置：横置履带上是一根**竖**的闸条（垂直于行进方向）
        const gx = MACHINE.beltEntryX + (MACHINE.beltExitX - MACHINE.beltEntryX) * MACHINE.gateAt;
        if (this.gateNode && this.gateNode.isValid) { this.gateNode.setPosition(gx, 0, 0); }

        this.refreshLock(true);
    }

    /**
     * ★ 整图换皮（bd02）：出售箱+履带+入料机本来就是一张完整 UI 图，
     *   替换掉旧的「木轨/履带节/箱/机」分段拼装件（场景版和运行时版都拆）。
     *   尺寸按场景坐标反推：bin/feeder 中心 ±252 → 整图 639×145（源图 709×161 × 0.9016），
     *   两端机器中心恰好落回 ±252，履带面高度 ≈ beltH(86)。
     *   gate / binLb / chips 保留，整图压到它们底下。
     */
    private reskinBelt() {
        for (const name of ['railTop', 'railBot', 'belt', 'bin', 'feeder']) {
            this.node.getChildByName(name)?.destroy();
        }
        if (!this.node.getChildByName('beltFull')) {
            const full = nd(this.node, 'beltFull', 639, 145, 0, 0);
            setFrame(full.addComponent(Sprite), 'skin/main/belt_composite', 639, 145);
            full.setSiblingIndex(0);
        }
    }

    /**
     * ★ 闸门换皮（zz）：双倍闸门换成主界面切图 zz.png（竖木牌，源 57×147），
     *   替换旧的「白色像素条 + 金色 tint + 上下两个 post 堵头」拼装件
     *   （场景版和运行时兜底版统一在这里拆 post、换整图）。
     *   尺寸 46×119（保持源图比例），x 仍由 MACHINE.gateAt 配置驱动。
     */
    private reskinGate() {
        if (!this.gateNode || !this.gateNode.isValid) { return; }
        for (const c of [...this.gateNode.children]) {
            if (c.name === 'post') { c.destroy(); }
        }
        const sp = this.gateNode.getComponent(Sprite) || this.gateNode.addComponent(Sprite);
        setFrame(sp, 'skin/main/gate', 46, 119, '#FFFFFF');
    }

    /** 场景里已摆好履带骨架（有 gate；旧分段件 railTop 等已删，beltFull 由 reskinBelt 运行时建）→ 补齐引用，返回 true */
    private bindScene(): boolean {        if (!this.node.getChildByName('gate')) { return false; }
        if (!this.gateNode || !this.gateNode.isValid) { this.gateNode = this.node.getChildByName('gate') || null!; }
        if (!this.binLb || !this.binLb.isValid) { this.binLb = this.node.getChildByName('binLb')?.getComponent(Label) || null!; }
        if (!this.chipsNode || !this.chipsNode.isValid) { this.chipsNode = this.node.getChildByName('chips') || null!; }
        return true;
    }

    /** 运行时兜底搭建（与 Game.scene 里 belt 的节点树逐节点同构） */
    private construct() {
        const bh = MACHINE.beltH;            // 86

        // 上下两根横木轨（贯穿三段：机器盒 → 履带 → 滚筒，两端被盒/筒盖住）
        woodRail(this.node, MACHINE.railW, MACHINE.railH, 0, MACHINE.railY, 'railTop');
        woodRail(this.node, MACHINE.railW, MACHINE.railH, 0, -MACHINE.railY, 'railBot');

        // 履带面（深色 + 履带节竖条）
        this.beltNode = beltFace(this.node, MACHINE.beltW, bh, 0, 0, 'belt');

        // 左端出售箱 / 右端入料机（画在木轨之后 → 盖住轨端）
        this.buildBin();
        this.buildFeeder();

        // 双倍闸门：横置履带上是一根**竖**的闸条（垂直于行进方向）
        const gx = MACHINE.beltEntryX + (MACHINE.beltExitX - MACHINE.beltEntryX) * MACHINE.gateAt;
        this.gateNode = nd(this.node, 'gate', 22, bh, gx, 0);
        const gs = this.gateNode.addComponent(Sprite);
        setFrame(gs, 'ui/pixel/px_white2', 22, bh - 20);
        gs.color = new Color(232, 200, 96, 210);
        for (const dy of [1, -1]) {
            const post = nd(this.gateNode, 'post', 30, 26, 0, dy * (bh / 2 - 6));
            setFrame(post.addComponent(Sprite), 'ui/pixel/px_white2', 30, 26, WOOD.gold);
        }

        // 在途计数（贴在左端出售箱上方）
        this.binLb = label(this.node, '', MACHINE.binX, MACHINE.binH / 2 + 6, 170, 40, {
            size: 27, color: '#FFF3D0', outline: WOOD.line, outlineWidth: 3,
        });
        this.binLb.node.name = 'binLb';
    }

    /**
     * 瓶盖容器 + 对象池（一次性预建，之后永不 new/destroy；场景/运行时两条路径共用）。
     *
     * ★ 第四十三轮：节点改为优先由**预制体** `Prefabs/Game/Cap` 实例化（外观/尺寸在编辑器
     *   可视化，不再运行时拼 UITransform+Sprite）；预制体没就绪时退回 `nd()+addComponent` 兜底。
     *   ⚠️ 池节点**常驻 chips 容器**、只切 active —— 不走通用 `Pool.acquire/release`：
     *     后者每次都 `removeFromParent/addChild`，会反复重建渲染合批，比常驻更慢。
     */
    private ensurePool() {
        if (!this.chipsNode || !this.chipsNode.isValid) {
            this.chipsNode = nd(this.node, 'chips', 1100, 900, 0, 0);
        }
        if (this.pool.length > 0) { return; }
        for (let i = 0; i < POOL.chip; i++) {
            let n = Prefabs.boot().make(CAP_PREFAB, this.chipsNode);
            if (!n) {
                n = nd(this.chipsNode, 'chip', CHIP_W, CHIP_H, 0, 0);
                setFrame(n.addComponent(Sprite), CHIP_TEX, CHIP_W, CHIP_H);
            }
            n.name = 'chip';
            const sp = n.getComponent(Sprite) || n.addComponent(Sprite);
            n.active = false;
            this.pool.push({
                node: n, sp, active: false, phase: 0, t: 0, bt: CAP_FX.burstTime, ft: 1,
                bx: 0, by: 0, vx: 0, vy: 0, fx: 0, fy: 0, lane: 0, x: 0, y: 0, value: 0,
                gated: false, spin: 0, jitter: 0, tier: 0,
            });
        }
    }

    /**
     * 左端**出售箱**（瓶盖运到这里回收计费）：木框 + 绿面板 + 瓶盖图示 + 下沿回收口。
     *
     * ⚠️ 原来这里是直接拉一张 `env/machine_box` 贴图到 168×176 ——
     *   贴图原始比例和拉伸后的比例不一致，木纹与铆钉全被拽变形（用户反馈的「履带 UI 变形」）。
     *   现在整机**全部用 Graphics 按目标尺寸画**，任何分辨率都不变形。
     */
    private buildBin() {
        const w = MACHINE.binW, h = MACHINE.binH;
        const root = nd(this.node, 'bin', w, h, MACHINE.binX, 0);

        // 木框（外）+ 稍亮的木面（内）
        woodPlate(root, { w, h, x: 0, y: 0, fill: '#C98A46', radius: 18, line: WOOD.line, lineW: 5, name: 'wood' });
        woodPlate(root, { w: w - 18, h: h - 18, x: 0, y: 0, fill: '#D9A05C', radius: 14, line: '', gloss: false, name: 'face' });

        // 绿色面板 + 瓶盖图示（瓶盖卖到这里）
        woodPlate(root, {
            w: 100, h: 58, x: 0, y: 26, fill: WOOD.green, radius: 10, line: WOOD.line, lineW: 4, name: 'screen',
        });
        const cap = nd(root, 'capIcon', 36, 32, 0, 26);
        setFrame(cap.addComponent(Sprite), CHIP_TEX, 36, 32);

        // 下沿回收口（瓶盖从履带运到这里消失入账）
        woodPlate(root, {
            w: 92, h: 30, x: 0, y: -42, fill: '#5C2E12', radius: 9, line: WOOD.line, lineW: 4, gloss: false, name: 'slot',
        });
    }

    /**
     * 右端**入料机**（瓶盖飞进来的黑色滚轮）：木框 + 深色滚轮 + 竖排辊条。
     * 同样是 Graphics 画的 —— 贴图拉伸是上一版变形的主因。
     */
    private buildFeeder() {
        const w = MACHINE.feederW, h = MACHINE.feederH;
        const root = nd(this.node, 'feeder', w, h, MACHINE.feederX, 0);

        woodPlate(root, { w, h, x: 0, y: 0, fill: '#C98A46', radius: 18, line: WOOD.line, lineW: 5, name: 'wood' });

        // 滚轮本体（填色+描边在根；辊条挂子节点 —— 一节点一渲染组件，见 Theme 注释）
        const rollW = w - 34, rollH = h - 46;
        const roll = nd(root, 'roll', rollW, rollH, 0, 0);
        const g = roll.addComponent(Graphics);
        g.fillColor = hex('#3A3A42');
        g.roundRect(-rollW / 2, -rollH / 2, rollW, rollH, 12);
        g.fill();
        const gs = nd(roll, 'stroke', rollW, rollH, 0, 0).addComponent(Graphics);
        gs.lineWidth = 4;
        gs.strokeColor = hex(WOOD.line);
        gs.roundRect(-rollW / 2, -rollH / 2, rollW, rollH, 12);
        gs.stroke();
        // 辊条（竖排）：每 16px 一条
        const gl = nd(roll, 'slats', rollW, rollH, 0, 0).addComponent(Graphics);
        gl.lineWidth = 3;
        gl.strokeColor = hex('#565660');
        for (let px = -rollW / 2 + 12; px < rollW / 2 - 6; px += 16) {
            gl.moveTo(px, -rollH / 2 + 6);
            gl.lineTo(px, rollH / 2 - 6);
        }
        gl.stroke();

        // 上下木轴（把滚轮夹在中间）
        for (const dy of [1, -1]) {
            woodPlate(root, {
                w: w - 26, h: 18, x: 0, y: dy * (rollH / 2 + 9),
                fill: '#A9702F', radius: 6, line: WOOD.line, lineW: 3, gloss: false, name: 'axle',
            });
        }
    }

    /**
     * 锁定状态变化时才改颜色/显隐。
     * ★ 原版开局：桌台下方**什么都没有** —— 未买瓶盖机器时不是「变暗的履带」，
     *   而是整块不存在。所以这里直接切 node.active。
     */
    private refreshLock(force = false) {
        const on = G.hasMachine;
        const gate = on && G.hasGate;
        if (!force && on === this.beltOn && gate === this.gateOn) { return; }
        this.beltOn = on;
        this.gateOn = gate;

        this.node.active = on;
        if (!on) { this.releaseAll(); return; }
        if (this.gateNode) { this.gateNode.active = gate; }
        void this.beltNode;
    }

    /** 世界局部坐标 → 本节点局部坐标（履带在 UI 层，必须换算） */
    private toLocal(wx: number, wy: number): { x: number, y: number } {
        const s = WORLD_XFORM.s || 1;
        // 用节点**当前** y 而不是常量：收起快捷购买行时履带会整体下移
        return {
            x: wx * s + WORLD_XFORM.ox,
            y: wy * s + WORLD_XFORM.oy - WORLD_XFORM.navDY - this.node.position.y,
        };
    }

    /* ---------------- 投料 ---------------- */

    /**
     * 扣盖落地、把产出的瓶盖**抛射**进履带。
     *
     * ⚠️ 只有「已装瓶盖机器 + 瓶口朝下的扣盖」才允许调用（见 BottleField.spawnCaps）。
     *    本方法内部再兜一道 `G.hasMachine`，任何路径都不可能在没有履带时冒出盖子。
     *
     * @param count 瓶盖枚数（该阶基础值 + 词条 + 被动，见 State.tierCapGain）
     * @param tier  瓶子阶数 → 决定瓶盖颜色
     * @param wx,wy 瓶子的**世界层局部坐标**（瓶口位置）
     */
    spawnChips(count: number, tier: number, wx: number, wy: number) {
        if (!G.hasMachine || count <= 0) { return; }
        if (!this.built || !this.node || !this.node.isValid) { this.build(); }

        // 隐藏瓶盖特效：不画实体瓶盖，但也不能把在途量卡住 —— 直接结算
        if (G.data.settings.hideCaps) { G.recycleCaps(count); return; }

        // ★ 用户口径（第十五轮）：click2 = 瓶盖获得音效（瓶盖飞向黑色入料机时响，节流防糊）
        Res.I?.playThrottled('click2', 'capget', 90, 0.55);

        const n = Math.max(1, Math.min(CAP_FX.maxVisible, Math.floor(count)));
        const per = Math.floor(count / n);
        const rem = count - per * n;
        const src = this.toLocal(wx, wy);

        for (let i = 0; i < n; i++) {
            const v = per + (i < rem ? 1 : 0);
            if (v <= 0) { continue; }
            const c = this.acquire();
            if (!c) { G.recycleCaps(v); continue; }

            // ★ 用户口径（第十四轮）：瓶盖**不需要爆散动画**，直接从瓶口飞出 →
            //    初始化即进入飞行段（phase 1），沿抛物线飞进右端入料机。
            c.active = true;
            c.phase = 1;
            c.t = 0;
            c.bt = 0;
            c.ft = CAP_FX.flyTime + i * CAP_FX.flyStagger;   // 逐颗错开 → 看起来是一串
            c.bx = src.x + (Math.random() - 0.5) * 14;
            c.by = src.y;
            c.vx = 0; c.vy = 0;
            c.fx = c.bx; c.fy = c.by;
            // 入料口在右端入料机左侧，落点带一点纵向抖动，避免叠成一条线
            c.lane = (Math.random() - 0.5) * 44;
            c.x = c.fx; c.y = c.fy;
            c.value = v;
            c.gated = false;
            c.tier = tier;
            c.spin = (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 300);
            c.jitter = Math.random() * 6.283;

            const node = c.node;
            node.active = true;
            node.setPosition(c.fx, c.fy, 0);
            node.angle = 0;
            node.setScale(1.0, 1.0, 1);
            this.tint(c, capColor(tier));        }
    }

    /**
     * 染色：直接赋**预建 Color 常量**（第四十三轮去掉每颗一次 `new Color` → 减 GC）。
     *
     * ⚠️ 历史坑：`sp.color.set(...)` 是就地改内部 _color → Renderable2D 的 setter 提前 return
     *    → _updateColor() 从不执行 → 渲染还是贴图原色（表现为「所有瓶盖都是白的」）。
     *    必须整体赋值；赋共享的常量 Color 实例是安全的（setter 内部会拷贝值）。
     */
    private tint(c: Chip, col: Color) { c.sp.color = col; }

    /** 池游标：从上次位置往后找空位（均摊 O(1)，避免每次都从 0 扫） */
    private cur = 0;

    private acquire(): Chip | null {
        const n = this.pool.length;
        for (let k = 0; k < n; k++) {
            const i = (this.cur + k) % n;
            if (!this.pool[i].active) { this.cur = (i + 1) % n; return this.pool[i]; }
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

        const pend = Math.round(G.pendingCaps);
        // ★ 第四十三轮：在途数文本**节流**（每帧写 Label.string 会触发系统字体 canvas 重绘
        //   + 纹理上传，瓶盖陆续到箱时等于每帧一次；限到 0.12s 一次，肉眼无差别）
        this.binAcc += dt;
        if (pend !== this.lastBin && this.binAcc >= 0.12 && this.binLb && this.binLb.isValid) {
            this.lastBin = pend;
            this.binAcc = 0;
            this.binLb.string = pend > 0 ? '+' + fmt(pend) : '';
        }

        const speed = MACHINE.beltSpeed * G.conveyorMul;
        const entryX = MACHINE.beltEntryX;
        const exitX = MACHINE.beltExitX;
        const span = exitX - entryX;
        const gateX = entryX + span * MACHINE.gateAt;
        const hasGate = G.hasGate;
        const gateChance = G.gateChance;
        let recycled = 0;
        let lastVal = 0;
        let lastX = 0;

        for (let i = 0; i < this.pool.length; i++) {
            const c = this.pool[i];
            if (!c.active) { continue; }

            // ---- ① 爆散段：初速 + 重力，四散弹跳 ----
            if (c.phase === 0) {
                c.t += dt;
                c.x = c.bx + c.vx * c.t;
                c.y = c.by + c.vy * c.t + 0.5 * CAP_FX.burstGravity * c.t * c.t;
                c.node.setPosition(c.x, c.y, 0);
                c.node.angle = c.spin * c.t;
                const k = Math.min(1, c.t / c.bt);
                const s = 1.15 + 0.25 * Math.sin(k * 3.1416);        // 先弹大一点再收
                c.node.setScale(s, s, 1);
                if (c.t >= c.bt) {
                    // 记录爆散末位置当飞行起点，转入"飞向履带"
                    c.phase = 1;
                    c.t = 0;
                    c.fx = c.x; c.fy = c.y;
                }
                continue;
            }

            // ---- ② 飞行段：抛物线，手算，无 tween ----
            if (c.phase === 1) {
                c.t += dt;
                let p = c.t / c.ft;
                if (p >= 1) {
                    p = 1;
                    c.phase = 2;
                    c.x = entryX + (Math.random() - 0.5) * 8;
                    c.y = c.lane;
                } else {
                    c.x = c.fx + (entryX - c.fx) * p;
                    c.y = c.fy + (c.lane - c.fy) * p + CAP_FX.flyArc * 4 * p * (1 - p);
                }
                c.node.setPosition(c.x, c.y, 0);
                c.node.angle = c.spin * 0.35 * (1 - p) + 0;         // 快到位时转速收敛
                const s = 1.15 - 0.15 * p;
                c.node.setScale(s, s, 1);
                continue;
            }

            // ---- ③ 履带段：向左运往出售箱 ----
            c.x -= speed * dt;
            c.jitter += dt * 6;
            c.y = c.lane + Math.sin(c.jitter) * 3;
            const s = 1.0 - 0.18 * Math.max(0, Math.min(1, (c.x - entryX) / span));
            c.node.setPosition(c.x, c.y, 0);
            c.node.angle = 0;
            c.node.setScale(s, s, 1);

            if (!c.gated && hasGate && c.x <= gateX) {
                c.gated = true;
                if (Math.random() < gateChance) {
                    c.value *= MACHINE.gateMult;
                    this.tint(c, GATE_GOLD);
                    const w = this.toWorld(gateX, c.y);
                    FxLayer.I?.sparkle(w.x, w.y, 40, '#FFE07A');
                }
            }

            if (c.x <= exitX) {
                G.recycleCaps(c.value);
                recycled++;
                lastVal = c.value;
                lastX = c.x;
                c.active = false;
                c.node.active = false;
            }
        }

        // ★ 第四十三轮：瓶盖入账飘字**合并 + 节流**。
        //   原来每帧只要有一颗到箱就发一条 `+N` 飘字 —— 一串瓶盖陆续到箱时等于每帧都在
        //   借还飘字节点 + 改 Label.string（每次都是系统字体重绘 + 纹理上传），是掉帧主源。
        //   现在把间隔内的金额**累加**，每 0.35s 只发一条（数值正确、观感更干净）。
        if (!G.data.settings.hideCaps) { this.fxAcc += lastVal; }
        if (recycled > 0) {
            this.churn += dt;
            if (this.churn > 0.22) { this.churn = 0; G.checkAch(); }
        }
        if (this.fxAcc > 0) {
            this.fxCt += dt;
            if (this.fxCt >= 0.35) {
                const w = this.toWorld(lastX, 40);
                FxLayer.I?.floatText(w.x, w.y, '+' + fmt(this.fxAcc), '#FFF3D0', 24, 46, 0.55);
                this.fxAcc = 0;
                this.fxCt = 0;
            }
        }
    }

    /** 本节点局部坐标 → 世界层局部坐标（飘字/特效挂在世界层，必须换回去） */
    private toWorld(x: number, y: number): { x: number, y: number } {
        const s = WORLD_XFORM.s || 1;
        return {
            x: (x - WORLD_XFORM.ox) / s,
            y: (y + WORLD_XFORM.navDY + this.node.position.y - WORLD_XFORM.oy) / s,
        };
    }

    onDestroy() { this.pool.length = 0; }
}

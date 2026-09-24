import { _decorator, Component, Node, Sprite, Tween, UIOpacity, Vec3, tween, Label } from 'cc';
import { ABILITY, LAYOUT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { BottleField } from './BottleField';
import { FxLayer } from './Fx';
import { applyFontDeep, button, img, label, nd, pressable, rect, setFrame, setSize } from '../UI/Base/UIKit';
import { Toast } from '../UI/Base/Toast';

const { ccclass, property } = _decorator;

/** 三大主动能力：飞行可乐 / 狂暴 / 武士处决（含底部能力条 UI） */
@ccclass('Abilities')
export class Abilities extends Component {
    cokeCd = 0;
    private cokeAlive: Node[] = [];
    @property({ type: Node, tooltip: '能力条（abilityBar，三个 ab_* 按钮各带 cd 遮罩 + lb 文字）' })
    bar: Node = null!;
    private btns: Record<string, Node> = {};
    private overlays: Record<string, Node> = {};
    private labels: Record<string, Label> = {};
    private berserkFx: Node = null!;
    private samuraiFx: Node = null!;

    onLoad() { }

    lateUpdate(dt: number) {
        // 可乐冷却
        if (G.cokeUnlocked) {
            if (this.cokeCd > 0) { this.cokeCd -= dt; }
            if (this.cokeCd <= 0 && this.cokeAlive.length === 0) {
                this.cokeCd = G.cokeCooldown;
                this.spawnCoke(G.cokeCount);
            }
        }
        this.refreshBar();
        this.refreshFx();
    }

    /* ---------------- 能力条 ---------------- */
    /**
     * ★ 场景实体化优先：navRoot 下已摆好 abilityBar（ab_coke/ab_berserk/ab_samurai）
     *   → 只绑引用；否则运行时现建（与场景树逐节点同构）。事件统一在 wire() 接。
     */
    buildBar(parent: Node) {
        if (!this.bindScene()) { this.construct(); }
        this.wire();
        this.layoutBar();
        G.addListener(() => this.layoutBar());
    }

    /** 场景里已摆好能力条（有 abilityBar）→ 补齐引用，返回 true */
    private bindScene(): boolean {
        const barNode = this.bar && this.bar.isValid ? this.bar : this.node.getChildByName('abilityBar');
        if (!barNode) { return false; }
        this.bar = barNode;
        this.btns = {}; this.overlays = {}; this.labels = {};
        for (const d of ['coke', 'berserk', 'samurai']) {
            const n = barNode.getChildByName('ab_' + d);
            if (!n) { continue; }
            this.btns[d] = n;
            this.overlays[d] = n.getChildByName('cd') || null!;
            this.labels[d] = n.getChildByName('lb')?.getComponent(Label) || null!;
        }
        applyFontDeep(barNode);
        return Object.keys(this.btns).length > 0;
    }

    /** 运行时兜底搭建（与 Game.scene 里 abilityBar 的节点树逐节点同构） */
    private construct() {
        this.bar = nd(this.node, 'abilityBar', 700, 110, 0, LAYOUT.abilityY);
        const defs = [
            { id: 'coke', icon: 'ability/flyingcoke' },
            { id: 'berserk', icon: 'ability/berserk' },
            { id: 'samurai', icon: 'ability/samurai' },
        ];
        for (const d of defs) {
            const n = button(this.bar, {
                w: 104, h: 104, x: 0, y: 0,
                tex: 'ui/panel/card_white', inset: [26, 26, 26, 26],
                texColor: '#2E3B52', sound: null,
                name: 'ab_' + d.id,
            });
            img(n, d.icon, 66, 66, 0, 8);
            const ov = rect(n, 92, 96, 0, 0, '#0B0F16CC', 'cd');
            setSize(ov, 92, 96);
            (ov.getComponent('cc.UITransform') as any).setAnchorPoint(0.5, 1);
            ov.setPosition(0, 46, 0);
            this.overlays[d.id] = ov;
            this.labels[d.id] = label(n, '', 0, -8, 90, 40, { size: 22, color: '#FFE9A8', outline: '#101620', outlineWidth: 2 });
            this.labels[d.id].node.name = 'lb';
            this.btns[d.id] = n;
            n.active = false;
        }
    }

    /** 接按钮事件（场景/运行时统一） */
    private wire() {
        for (const d of ['coke', 'berserk', 'samurai']) {
            const n = this.btns[d];
            if (n) { pressable(n, () => this.onAbility(d), 'click', 0.94); }
        }
    }

    private layoutBar() {
        const list = ['coke', 'berserk', 'samurai'].filter(k => this.btns[k] && this.btns[k].isValid);
        const vis = list.filter(k => (k === 'coke' ? G.cokeUnlocked : k === 'berserk' ? G.berserkUnlocked : G.samuraiUnlocked));
        for (const k of list) { this.btns[k].active = vis.indexOf(k) >= 0; }
        const n = vis.length;
        const sp = 128;
        for (let i = 0; i < n; i++) {
            this.btns[vis[i]].setPosition((i - (n - 1) / 2) * sp, 0, 0);
        }
    }

    private refreshBar() {
        if (!this.bar || !this.bar.isValid) { return; }
        // 可乐冷却
        const coke = this.overlays['coke'];
        if (coke && coke.isValid) {
            const frac = G.cokeUnlocked ? Math.max(0, this.cokeCd) / Math.max(1, G.cokeCooldown) : 1;
            const ut = coke.getComponent('cc.UITransform') as any;
            ut.setContentSize(92, 96 * frac);
            const lb = this.labels['coke'];
            if (lb && lb.isValid) { lb.string = G.cokeUnlocked ? (frac > 0.02 ? Math.ceil(this.cokeCd) + 's' : 'READY') : ''; }
        }
        const ber = this.overlays['berserk'];
        if (ber && ber.isValid) {
            const on = G.berserkFlips > 0;
            ber.active = !on;
            const lb = this.labels['berserk'];
            if (lb && lb.isValid) {
                lb.string = on ? ('×' + G.berserkFlips) : (G.berserkStreak + '/' + G.berserkNeed);
            }
        }
        const sam = this.overlays['samurai'];
        if (sam && sam.isValid) {
            const g = G.samuraiActive ? 0 : (G.samuraiArmed ? 0 : 1 - G.samuraiGauge);
            const ut = sam.getComponent('cc.UITransform') as any;
            ut.setContentSize(92, 96 * Math.max(0, Math.min(1, g)));
            const lb = this.labels['samurai'];
            if (lb && lb.isValid) {
                lb.string = G.samuraiActive ? t('samurai_active', G.lang)
                    : G.samuraiArmed ? t('samurai_ready', G.lang)
                        : Math.floor(G.samuraiGauge * 100) + '%';
            }
        }
    }

    private onAbility(id: string) {
        if (id === 'coke') {
            if (this.cokeCd > 0 && this.cokeAlive.length === 0) { Toast.I?.show('冷却中'); return; }
            if (this.cokeAlive.length === 0) { this.cokeCd = G.cokeCooldown; this.spawnCoke(G.cokeCount); }
        } else if (id === 'samurai') {
            if (G.samuraiActive) { return; }
            if (G.samuraiArmed) { return; }
            if (G.samuraiGauge < 1) { Toast.I?.show(t('samurai_ready', G.lang)); return; }
            this.activateSamurai();
        }
    }

    /* ---------------- 飞行可乐 ---------------- */
    spawnCoke(count: number) {
        for (let i = 0; i < count; i++) {
            const y = 250 - i * 130 + Math.random() * 40;
            const dur = ABILITY.coke.flightTime;
            const n = nd(this.node, 'coke', 92, 230, -460, y);
            const sp = n.addComponent(Sprite);
            setFrame(sp, 'bottle/body_5', 92, 230);
            sp.color.set(150, 90, 70, 255);           // 可乐色调
            n.setScale(0.62, 0.62, 1);
            n.angle = 90;

            const targetY = y;
            tween(n)
                .to(dur, { position: new Vec3(520, targetY, 0) }, { easing: 'linear' })
                .call(() => { this.removeCoke(n); })
                .start();
            tween(n).by(dur * 0.5, { angle: 20 }, { easing: 'sineInOut' })
                .by(dur * 0.5, { angle: -20 }, { easing: 'sineInOut' }).start();

            n.on(Node.EventType.TOUCH_START, (e: any) => {
                e.propagationStopped = true;
                this.popCoke(n);
            });
            this.cokeAlive.push(n);
        }
    }

    private removeCoke(n: Node) {
        const i = this.cokeAlive.indexOf(n);
        if (i >= 0) { this.cokeAlive.splice(i, 1); }
        if (n.isValid) { n.destroy(); }
    }

    /** 翻转飞行可乐：冲击波连带翻起所有瓶子 */
    popCoke(n: Node) {
        if (!n.isValid) { return; }
        const pos = n.position.clone();
        this.removeCoke(n);
        Res.I?.play('pop1', 1);
        FxLayer.I?.shockwave(pos.x, pos.y, 780, 0.55, '#FFD86B');
        FxLayer.I?.flash('#FFD86B', 70, 0.3);
        FxLayer.I?.shake(14, 0.35);
        BottleField.I?.flipAllByShock();
    }

    /* ---------------- 武士处决 ---------------- */
    activateSamurai() {
        G.fireSamurai();
        Res.I?.play('slash', 1);
        FxLayer.I?.flash('#FF7A5A', 80, 0.35);
        FxLayer.I?.shake(12, 0.3);
        Toast.I?.show(t('samurai_ready', G.lang), '#FF9E7A');
    }

    /**
     * 状态特效一律「贴着能力条上的按钮烧」，不再铺到游戏区中间。
     *
     * ⚠️ 原来狂暴火焰是 220×290 摆在 (-230, navY+250)，处决光环是 700×900 巨幅武士刀铺满屏幕 ——
     * 两者都把桌面、瓶子和快捷购买卡盖住了（用户截图反馈「挡住游戏了」）。
     *
     * 现在：① 尺寸收敛到按钮外一圈（176×224）；② 位置每帧跟随按钮；
     * ③ 挂成 navRoot 的**第 0 个子节点** —— 它排在快捷购买卡与底部导航之前，
     *    所以火焰只会从按钮四周的缝隙里透出来，**永远不会盖住任何 UI 或瓶子**。
     */
    private refreshFx() {
        if (!this.bar || !this.bar.isValid) { return; }

        /* ---- 狂暴：火焰贴在「狂暴」按钮后面 ---- */
        const berBtn = this.btns['berserk'];
        const berOn = G.berserkFlips > 0;
        if (berOn && (!this.berserkFx || !this.berserkFx.isValid)) {
            const n = nd(this.node, 'berserkFx', 176, 224, 0, LAYOUT.abilityY);
            setFrame(n.addComponent(Sprite), 'ability/berserk', 176, 224);
            n.addComponent(UIOpacity).opacity = 235;
            n.setSiblingIndex(0);                       // 排到所有 UI 之下 → 只发光、不遮挡
            tween(n).repeatForever(
                tween(n).to(0.35, { scale: new Vec3(1.08, 0.94, 1) })
                    .to(0.35, { scale: new Vec3(0.95, 1.06, 1) })).start();
            this.berserkFx = n;
        } else if (!berOn && this.berserkFx) {
            Tween.stopAllByTarget(this.berserkFx);
            this.berserkFx.destroy(); this.berserkFx = null!;
        }
        if (this.berserkFx && this.berserkFx.isValid && berBtn && berBtn.isValid) {
            this.berserkFx.setPosition(berBtn.position.x, LAYOUT.abilityY, 0);
        }

        /* ---- 处决：武士刀贴在「武士」按钮后面（原来是 700×900 铺满屏） ---- */
        const samBtn = this.btns['samurai'];
        const samOn = G.samuraiActive;
        if (samOn && (!this.samuraiFx || !this.samuraiFx.isValid)) {
            const n = nd(this.node, 'samuraiFx', 160, 184, 0, LAYOUT.abilityY);
            // 染色走 setFrame 的 color 参数（新建 Color 整体赋值）；
            // 千万不要 sp.color.set(...) —— 就地改内部 _color 不触发顶点色刷新（见 UIKit.tint 注释）
            setFrame(n.addComponent(Sprite), 'ability/katana', 160, 184, '#FF9678');
            const op = n.addComponent(UIOpacity);
            op.opacity = 150;
            n.setSiblingIndex(0);
            tween(op).to(0.25, { opacity: 235 }).to(0.25, { opacity: 140 }).union().repeatForever().start();
            this.samuraiFx = n;
        } else if (!samOn && this.samuraiFx) {
            const op = this.samuraiFx.getComponent(UIOpacity);
            if (op) { Tween.stopAllByTarget(op); }
            this.samuraiFx.destroy(); this.samuraiFx = null!;
        }
        if (this.samuraiFx && this.samuraiFx.isValid && samBtn && samBtn.isValid) {
            this.samuraiFx.setPosition(samBtn.position.x, LAYOUT.abilityY, 0);
        }
    }
}

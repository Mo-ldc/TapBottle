import { _decorator, Component, Node, Sprite, UIOpacity, Vec3, tween, Label } from 'cc';
import { ABILITY, LAYOUT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { t } from '../Core/Locale';
import { BottleField } from './BottleField';
import { FxLayer } from './Fx';
import { button, img, label, nd, rect, setFrame, setSize } from '../UI/UIKit';
import { Toast } from '../UI/Toast';

const { ccclass } = _decorator;

/** 三大主动能力：飞行可乐 / 狂暴 / 武士处决（含底部能力条 UI） */
@ccclass('Abilities')
export class Abilities extends Component {
    cokeCd = 0;
    private cokeAlive: Node[] = [];
    private bar: Node = null!;
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
    buildBar(parent: Node) {
        this.bar = nd(parent, 'abilityBar', 700, 110, 0, LAYOUT.abilityY);
        const defs = [
            { id: 'coke', icon: 'ability/flyingcoke', show: () => G.cokeUnlocked },
            { id: 'berserk', icon: 'ability/berserk', show: () => G.berserkUnlocked },
            { id: 'samurai', icon: 'ability/samurai', show: () => G.samuraiUnlocked },
        ];
        for (const d of defs) {
            const n = button(this.bar, {
                w: 104, h: 104, x: 0, y: 0,
                tex: 'ui/card_white', inset: [26, 26, 26, 26],
                texColor: '#2E3B52', sound: 'click',
                name: 'ab_' + d.id,
                onClick: () => this.onAbility(d.id),
            });
            img(n, d.icon, 66, 66, 0, 8);
            const ov = rect(n, 92, 96, 0, 0, '#0B0F16CC', 'cd');
            setSize(ov, 92, 96);
            (ov.getComponent('cc.UITransform') as any).setAnchorPoint(0.5, 1);
            ov.setPosition(0, 46, 0);
            this.overlays[d.id] = ov;
            this.labels[d.id] = label(n, '', 0, -8, 90, 40, { size: 22, color: '#FFE9A8', outline: '#101620', outlineWidth: 2 });
            this.btns[d.id] = n;
            n.active = false;
        }
        this.layoutBar();
        G.addListener(() => this.layoutBar());
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

    private refreshFx() {
        // 狂暴火焰
        if (G.berserkFlips > 0 && !this.berserkFx) {
            this.berserkFx = nd(this.node, 'berserkFx', 220, 290, -230, LAYOUT.navY + 250);
            const sp = this.berserkFx.addComponent(Sprite);
            setFrame(sp, 'ability/berserk', 220, 290);
            const op = this.berserkFx.addComponent(UIOpacity);
            op.opacity = 210;
            const s = this.berserkFx;
            tween(s).repeatForever(
                tween(s).to(0.35, { scale: new Vec3(1.08, 0.94, 1) })
                    .to(0.35, { scale: new Vec3(0.95, 1.06, 1) })).start();
        } else if (G.berserkFlips <= 0 && this.berserkFx) {
            this.berserkFx.destroy(); this.berserkFx = null;
        }
        // 处决光环
        if (G.samuraiActive && !this.samuraiFx) {
            this.samuraiFx = nd(this.node, 'samuraiFx', 700, 900, 0, 40);
            const sp = this.samuraiFx.addComponent(Sprite);
            setFrame(sp, 'ability/katana', 700, 900);
            sp.color.set(255, 120, 90, 60);
            const op = this.samuraiFx.addComponent(UIOpacity);
            op.opacity = 120;
            tween(op).to(0.25, { opacity: 200 }).to(0.25, { opacity: 120 }).union().repeatForever().start();
        } else if (!G.samuraiActive && this.samuraiFx) {
            this.samuraiFx.destroy(); this.samuraiFx = null;
        }
    }
}

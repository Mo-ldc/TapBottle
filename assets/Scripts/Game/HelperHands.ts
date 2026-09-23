import { _decorator, Component, Node, Sprite, Vec3, tween } from 'cc';
import { HAND, LAYOUT, PLAY_AREA } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { BottleField } from './BottleField';
import { CapMachine } from './CapMachine';
import { FxLayer } from './Fx';
import { nd, setFrame } from '../UI/UIKit';

const { ccclass } = _decorator;

interface Hand { node: Node; t: number; busy: number; }

/** 助手之手：自动翻瓶（Cocos tween 驱动） */
@ccclass('HelperHands')
export class HelperHands extends Component {
    private hands: Hand[] = [];
    private hiddenAcc = 0;

    private makeHand(i: number): Hand {
        const n = nd(this.node, 'hand' + i, 62, 88, LAYOUT.tableX - 190 + i * 60, PLAY_AREA.y1 + 96);
        const sp = n.addComponent(Sprite);
        setFrame(sp, 'env/hand', 62, 88);
        n.setScale(0.95, 0.95, 1);
        return { node: n, t: Math.random() * HAND.interval, busy: 0 };
    }

    update(dt: number) {
        const want = G.hasHelper ? Math.min(G.data.hands, HAND.visibleMax) : 0;

        while (this.hands.length < want) { this.hands.push(this.makeHand(this.hands.length)); }
        while (this.hands.length > want) { const h = this.hands.pop()!; h.node.destroy(); }

        if (!G.hasHelper || G.data.hands <= 0) { return; }

        let rate = 1 + G.handSpeed;
        if (G.hasIdle && G.idleOn) { rate *= (G.idleStamina > 0 ? 1.7 : 0.35); }

        const hideHand = G.data.settings.hideHand;
        for (let i = 0; i < this.hands.length; i++) {
            const h = this.hands[i];
            h.node.active = !hideHand;
            if (hideHand) { continue; }
            if (h.busy > 0) { h.busy -= dt; continue; }
            h.t -= dt * rate;
            if (h.t <= 0) { h.t = HAND.interval; this.handAct(h); }
        }

        // 超出可见上限的助手直接静默结算，避免节点爆炸
        const hidden = Math.max(0, G.data.hands - HAND.visibleMax);
        if (hidden > 0) {
            this.hiddenAcc += dt * rate * hidden / HAND.interval;
            let guard = 0;
            while (this.hiddenAcc >= 1 && guard < 60) {
                this.hiddenAcc -= 1; guard++;
                this.directFlip();
            }
        }
    }

    private handAct(h: Hand) {
        const field = BottleField.I;
        if (!field || field.bottles.length === 0) { return; }
        const idle = field.bottles.filter(b => b.idle);
        if (idle.length === 0) { h.t = 0.25; return; }
        const target = idle[Math.floor(Math.random() * idle.length)];
        h.busy = HAND.interval * 0.8;
        const p = target.node.position;
        const to = new Vec3(p.x, p.y + LAYOUT.bottleH * 0.60, 0);
        const back = new Vec3(LAYOUT.tableX + (Math.random() - 0.5) * 380,
            PLAY_AREA.y1 + 50 + Math.random() * 56, 0);

        tween(h.node)
            .to(0.20, { position: to }, { easing: 'quadOut' })
            .call(() => {
                if (target.isValid && target.idle) { field.helperFlip(target); }
                tween(h.node).to(0.07, { scale: new Vec3(1.2, 0.8, 1) })
                    .to(0.10, { scale: new Vec3(0.95, 0.95, 1) }).start();
            })
            .delay(0.16)
            .to(0.30, { position: back }, { easing: 'quadInOut' })
            .call(() => { h.t = HAND.interval * 0.4; h.busy = 0; })
            .start();
    }

    private directFlip() {
        const owned: number[] = [];
        for (let t = 0; t < 7; t++) {
            for (let i = 0; i < G.data.bottles[t]; i++) { owned.push(t); }
        }
        if (owned.length === 0) { return; }
        const tier = owned[Math.floor(Math.random() * owned.length)];
        const r = G.doFlipResult(tier, G.rollOutcome(tier));
        if (r.deferred && r.caps > 0) {
            CapMachine.I?.spawnChips(r.caps, tier,
                LAYOUT.tableX + (Math.random() - 0.5) * 420, LAYOUT.rowBaseline[1]);
        }
        if (r.success && !G.data.settings.hideIncome && Math.random() < 0.05 && FxLayer.I) {
            FxLayer.I.floatText(LAYOUT.tableX + (Math.random() - 0.5) * 380, PLAY_AREA.y1 + 120,
                '$' + r.amount.toFixed(0), '#9EE8B0', 22, 60, 0.7);
        }
    }
}

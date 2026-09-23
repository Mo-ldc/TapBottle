import { _decorator, Component, Node, UIOpacity, Vec3, tween } from 'cc';
import { ACHIEVEMENTS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { img, label, nd, roundedPanel } from './UIKit';

const { ccclass } = _decorator;

/**
 * 顶部提示条 + 成就弹窗。
 *
 * ⚠️ 出场方式改为「原地 Q 弹」：以前是 setPosition(0,470) → tween 到 430 的位移滑入，
 * 现在是固定 y 不动、从 0.70 过冲到 1.06 再回落 —— 位移没了，只剩弹感。
 * 收起也统一成「缩放回 0.78 + 淡出」。
 */
@ccclass('Toast')
export class Toast extends Component {
    static I: Toast = null!;

    /** 提示条固定停靠高度（设计像素） */
    private readonly BAR_Y = 430;
    /** 成就横幅固定停靠高度 */
    private readonly ACH_Y = 400;

    private queue: Node[] = [];
    private showing = false;

    onLoad() { Toast.I = this; }

    show(msg: string, color = '#FFE9A8') {
        const n = roundedPanel(this.node, 560, 76, 0, this.BAR_Y, '#1B2230EE', 18, '#3A4761', 3, 'toast');
        label(n, msg, 0, 0, 530, 70, { size: 28, color, outline: '#0B0F16', outlineWidth: 2 });
        this.queue.push(n);
        if (!this.showing) { this.next(); }
    }

    /** 入场 → 停留 → 缩放消失 */
    private playPop(n: Node, hold: number, onGone: () => void) {
        const op = n.addComponent(UIOpacity);
        op.opacity = 0;
        n.setScale(0.70, 0.70, 1);
        tween(n)
            .to(0.13, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'backOut' })
            .to(0.11, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            .start();
        tween(op).to(0.13, { opacity: 255 }).delay(hold)
            .call(() => {
                // 注意：这里不能调 popOut()——它会把 opacity 复位成 255 造成闪一下
                tween(n).to(0.15, { scale: new Vec3(0.78, 0.78, 1) }, { easing: 'quadIn' }).start();
            })
            .to(0.15, { opacity: 0 })
            .call(() => {
                if (n.isValid) { n.destroy(); }
                onGone();
            })
            .start();
    }

    private next() {
        const n = this.queue.shift();
        if (!n) { this.showing = false; return; }
        this.showing = true;
        this.playPop(n, 1.5, () => this.next());
    }

    /** 成就解锁横幅 */
    achievement(id: number) {
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (!a) { return; }
        const n = roundedPanel(this.node, 600, 110, 0, this.ACH_Y, '#2A2212F2', 16, '#C8A44A', 4, 'achToast');
        img(n, 'ui/icon_ach', 74, 72, -238, 0);
        label(n, t('new_achievement', G.lang), -170, 24, 380, 34, { size: 24, color: '#FFD98A', hAlign: 'left', anchorX: 0 });
        label(n, t(a.title, G.lang), -170, -14, 380, 40, { size: 32, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        this.playPop(n, 1.8, () => { /* 横幅不进队列，自己消失 */ });
        void nd;
    }
}

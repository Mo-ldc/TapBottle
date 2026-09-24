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

    /** 提示条固定停靠高度（设计像素）—— 用户要求：提示弹窗放屏幕正中 */
    private readonly BAR_Y = 0;
    /** 成就横幅固定停靠高度（中央偏上，避免和提示条重叠） */
    private readonly ACH_Y = 110;

    private queue: Node[] = [];
    private showing = false;

    onLoad() { Toast.I = this; }

    show(msg: string, color = '#FFE9A8') {
        const n = roundedPanel(this.node, 560, 76, 0, this.BAR_Y, '#4A2410EE', 18, '#8A5A20', 4, 'toast');
        // shrink：文字过长时自动缩小/换行适配面板，不再画出框外（用户反馈溢出）
        label(n, msg, 0, 0, 530, 70, { size: 28, color, outline: '#2A1608', outlineWidth: 3, overflow: 'shrink' });
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
        const n = roundedPanel(this.node, 600, 110, 0, this.ACH_Y, '#4A2410F2', 16, '#E8B23C', 4, 'achToast');
        img(n, 'ui/icon_ach', 74, 72, -238, 0);
        label(n, t('new_achievement', G.lang), -170, 24, 380, 34, { size: 24, color: '#FFD98A', hAlign: 'left', anchorX: 0 });
        label(n, t(a.title, G.lang), -170, -14, 380, 40, { size: 32, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        this.playPop(n, 1.8, () => { /* 横幅不进队列，自己消失 */ });
        void nd;
    }
}

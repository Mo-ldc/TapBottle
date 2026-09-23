import { _decorator, Component, Node, UIOpacity, Vec3, tween } from 'cc';
import { ACHIEVEMENTS } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { img, label, nd, roundedPanel } from './UIKit';

const { ccclass } = _decorator;

/** 顶部提示条 + 成就弹窗 */
@ccclass('Toast')
export class Toast extends Component {
    static I: Toast = null!;
    private queue: Node[] = [];
    private showing = false;

    onLoad() { Toast.I = this; }

    show(msg: string, color = '#FFE9A8') {
        const n = roundedPanel(this.node, 560, 76, 0, 0, '#1B2230EE', 18, '#3A4761', 3, 'toast');
        label(n, msg, 0, 0, 530, 70, { size: 28, color, outline: '#0B0F16', outlineWidth: 2 });
        this.queue.push(n);
        if (!this.showing) { this.next(); }
    }

    private next() {
        const n = this.queue.shift();
        if (!n) { this.showing = false; return; }
        this.showing = true;
        n.setPosition(0, 470, 0);
        const op = n.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.15, { opacity: 255 }).delay(1.5).to(0.25, { opacity: 0 })
            .call(() => { n.destroy(); this.next(); }).start();
        tween(n).to(0.2, { position: new Vec3(0, 430, 0) }, { easing: 'quadOut' }).start();
    }

    /** 成就解锁横幅 */
    achievement(id: number) {
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (!a) { return; }
        const n = roundedPanel(this.node, 600, 110, 0, 0, '#2A2212F2', 16, '#C8A44A', 4, 'achToast');
        const ico = img(n, 'ui/icon_ach', 74, 72, -238, 0);
        void ico;
        label(n, t('new_achievement', G.lang), -170, 24, 380, 34, { size: 24, color: '#FFD98A', hAlign: 'left', anchorX: 0 });
        label(n, t(a.title, G.lang), -170, -14, 380, 40, { size: 32, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        n.setPosition(0, 470, 0);
        const op = n.addComponent(UIOpacity);
        op.opacity = 0;
        tween(n).to(0.25, { position: new Vec3(0, 400, 0) }, { easing: 'backOut' }).start();
        tween(op).to(0.2, { opacity: 255 }).delay(1.8).to(0.3, { opacity: 0 })
            .call(() => n.destroy()).start();
        void nd;
    }
}

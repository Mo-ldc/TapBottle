import { _decorator, Component, Label, Node, UIOpacity, Vec3, tween } from 'cc';
import { ACHIEVEMENTS } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { Prefabs } from '../../Core/Prefabs';
import { hex } from '../../Core/Util';
import { t } from '../../Core/Locale';
import { img, label, nd, roundedPanel } from './UIKit';

const { ccclass } = _decorator;

/**
 * 顶部提示条 + 成就弹窗。
 *
 * ★ 横条实例来自预制体 `Prefabs/UI/ToastBar`（第一百轮，用户口径「以预制体为主」）：
 *   位置 / 尺寸 / 底色 / 描边 / 字号全在编辑器可视化可调，代码只填文字 + 动态字色。
 *   预制体加载失败时回落运行时现建（同构），保证提示永不消失。
 *
 * ★ 出场动画（用户口径：横条「出现后往上移动、逐渐消失」；第一〇二轮再提速 + 距离翻倍）：
 *   原位淡入 FLY_IN(0.10s) → 上浮 FLY_RISE(96px) 同时淡出（剩余 0.50s）→ 销毁，全程 0.6s。
 *   透明度一条串行 tween（淡入→淡出），位移独立一条；不要并发改同一属性。
 *   ⚠️ 不要在这里挂缩放入场（旧的 Q 弹）：用户要的是「上浮」而不是「弹」。
 *   ⚠️ 不要调 popOut()：它会把 UIOpacity 复位成 255，淡出后调用会闪一下。
 */
@ccclass('Toast')
export class Toast extends Component {
    static I: Toast = null!;

    /** 成就横幅固定停靠高度（中央偏上，避免和提示条重叠） */
    private readonly ACH_Y = 110;

    /** 一轮出场动画总时长（秒）—— ★ 第一〇二轮提速：1.0 → 0.6（用户「再快」） */
    private readonly FLY_DUR = 0.6;
    /** 上浮高度（设计像素）—— ★ 第一〇二轮翻倍：48 → 96 */
    private readonly FLY_RISE = 96;
    /** 开头「原位淡入」的时长（秒），其余时间用来上浮 + 淡出 */
    private readonly FLY_IN = 0.10;

    private queue: Node[] = [];
    private showing = false;

    onLoad() { Toast.I = this; }

    show(msg: string, color = '#FFE9A8') {
        const n = this.makeBar(msg, color);
        // 先藏起来：排队等待的节点若带 UIOpacity=255 会直接显示（多个连发时穿帮）
        const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
        op.opacity = 0;
        this.queue.push(n);
        if (!this.showing) { this.next(); }
    }

    /** 横条实例：预制体优先（编辑器可调位置/样式），失败回落运行时现建 */
    private makeBar(msg: string, color: string): Node {
        const n = Prefabs.boot().make('UI/ToastBar', this.node);
        if (n) {
            const lbNode = n.getChildByName('msg');
            const lb = lbNode ? lbNode.getComponent(Label) : null;
            if (lb) {
                lb.string = msg;
                lb.color = hex(color);   // 整体赋值（复用 Color 引用 setter 会跳过）
            } else {
                console.warn('[Toast] ToastBar.prefab 缺少 msg 节点');
            }
            return n;
        }
        // —— 回落：与 ToastBar.prefab 同构的运行时现建（位置恒屏幕中心） ——
        const f = roundedPanel(this.node, 560, 76, 0, 0, '#4A2410EE', 18, '#8A5A20', 4, 'toast');
        label(f, msg, 0, 0, 530, 70, { size: 28, color, outline: '#2A1608', outlineWidth: 3, overflow: 'shrink' });
        return f;
    }

    /** 出场：原位淡入 → 上浮 + 淡出 → 销毁（FLY_DUR 秒走完） */
    private playPop(n: Node, onGone: () => void) {
        const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
        const p0 = n.position.clone();
        op.opacity = 0;
        n.setPosition(p0);
        const flyT = Math.max(0.05, this.FLY_DUR - this.FLY_IN);
        tween(op)
            .to(this.FLY_IN, { opacity: 255 })
            .to(flyT, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (n.isValid) { n.destroy(); }
                onGone();
            })
            .start();
        tween(n)
            .delay(this.FLY_IN)
            .to(flyT, { position: new Vec3(p0.x, p0.y + this.FLY_RISE, 0) }, { easing: 'sineOut' })
            .start();
    }

    private next() {
        const n = this.queue.shift();
        if (!n) { this.showing = false; return; }
        this.showing = true;
        this.playPop(n, () => this.next());
    }

    /** 成就解锁横幅 */
    achievement(id: number) {
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (!a) { return; }
        const n = roundedPanel(this.node, 600, 110, 0, this.ACH_Y, '#4A2410F2', 16, '#E8B23C', 4, 'achToast');
        img(n, 'ui/icon/icon_ach', 74, 72, -238, 0);
        label(n, t('new_achievement', G.lang), -170, 24, 380, 34, { size: 24, color: '#FFD98A', hAlign: 'left', anchorX: 0 });
        label(n, t(a.title, G.lang), -170, -14, 380, 40, { size: 32, color: '#FFFFFF', hAlign: 'left', anchorX: 0 });
        this.playPop(n, () => { /* 横幅不进队列，自己消失 */ });
        void nd;
    }
}

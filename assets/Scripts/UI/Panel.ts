import { _decorator, Component, Node, UIOpacity, Vec3, tween } from 'cc';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { button, img, label, modalMask, nd, popIn, roundedPanel, scrollView } from './UIKit';
import { Modal } from './Modal';
import { Toast } from './Toast';

const { ccclass } = _decorator;

/** 面板刷新节流器 */
@ccclass('PanelHost')
export class PanelHost extends Component {
    onRefresh: (() => void) | null = null;
    private dirty = true;
    private acc = 0;
    start() { G.addListener(() => { this.dirty = true; }); }
    update(dt: number) {
        if (!this.dirty) { return; }
        this.acc += dt;
        if (this.acc < 0.15) { return; }
        this.acc = 0; this.dirty = false;
        if (this.onRefresh) { this.onRefresh(); }
    }
}

export interface PanelWrap {
    root: Node;
    body: Node;          // 滚动内容
    frame: Node;
    host: PanelHost;
    close: () => void;
}

export const PANEL_W = 692;
export const PANEL_H = 1080;
export const BODY_W = 640;
export const BODY_H = 880;

/** 打开一个标准面板：遮罩 + 木板底 + 标题 + 关闭按钮 + 滚动内容 */
export function openPanel(parent: Node, titleKey: string, bodyH = BODY_H): PanelWrap {
    const root = nd(parent, 'panel_' + titleKey, 900, 1520, 0, 0);
    const mask = modalMask(root, null);
    void mask;
    const op = root.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).to(0.15, { opacity: 255 }).start();

    const frame = roundedPanel(root, PANEL_W, PANEL_H, 0, -8, '#171E2BF7', 26, '#C8A44A', 5, 'frame');
    // 装饰条当标题背板用（贴图本身接近白色，直接放会变成一条突兀的白块；染色后压成暗金铭牌）
    img(frame, 'ui/panel_deco', 300, 60, 0, PANEL_H / 2 - 58, '#6E5A34');

    label(frame, t(titleKey, G.lang), 0, PANEL_H / 2 - 58, 500, 60, {
        size: 40, color: '#FFE9A8', outline: '#0B0F16', outlineWidth: 3,
    });

    const sv = scrollView(frame, BODY_W, bodyH, 0, -34);
    // 顶部留白
    const topPad = nd(sv.content, 'topPad', BODY_W, 10, 0, 0, 0.5, 1);

    const wrap: PanelWrap = {
        root, body: sv.content, frame, host: root.addComponent(PanelHost),
        close: () => {
            Modal.pop();
            const o = root.getComponent(UIOpacity)!;
            tween(o).to(0.12, { opacity: 0 }).call(() => root.destroy()).start();
        },
    };
    void topPad;

    const closeBtn = button(frame, {
        w: 84, h: 84, x: PANEL_W / 2 - 52, y: PANEL_H / 2 - 54,
        tex: 'ui/card_white', inset: [26, 26, 26, 26], texColor: '#2E3B52',
        sound: 'click', name: 'close', onClick: () => wrap.close(),
    });
    img(closeBtn, 'ui/btn_close', 46, 46, 0, 0);

    Modal.push();
    popIn(frame, 0.2);
    return wrap;
}

/** 面板上的一行“卡片” */
export function rowCard(parent: Node, w: number, h: number, x: number, y: number, tint = '#202A3C'): Node {
    return roundedPanel(parent, w, h, x, y, tint, 18, '#33415C', 3, 'row');
}

/** 资源不足提示 */
export function denyToast(needCaps = false) {
    Toast.I?.show(t(needCaps ? 'not_enough' : 'not_enough', G.lang) + (needCaps ? '（瓶盖）' : '（金币）'), '#FFB0A0');
    void Vec3;
}

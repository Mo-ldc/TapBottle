import { _decorator, Component, Node, UIOpacity, Vec3, tween } from 'cc';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { button, img, label, modalMask, nd, popIn, popOut, roundedPanel, scrollView } from './UIKit';
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
/**
 * 滚动区上沿（frame 局部坐标，frame 高 1080 → ±540）。
 *
 * 标题铭牌占 [443,521]，所以内容带要从 443 往下；原来写死 `-34` 当视口中心，
 * 高 bodyH 小的面板（统计 700）顶部会空出一大段、内容却贴着面板下沿。
 */
const SCROLL_TOP = PANEL_H / 2 - 120;
/** 内容顶部留白：保证第一行卡片/标题完整落在视口内，不被上沿切掉 */
const TOP_PAD = 30;

/** 打开一个标准面板：遮罩 + 木板底 + 标题 + 关闭按钮 + 滚动内容 */
export function openPanel(parent: Node, titleKey: string, bodyH = BODY_H): PanelWrap {
    const root = nd(parent, 'panel_' + titleKey, 900, 1520, 0, 0);
    const mask = modalMask(root, null);
    void mask;
    const op = root.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).to(0.15, { opacity: 255 }).start();

    // ⚠️ 底色必须全不透明（曾经是 #171E2BF7 = 96.9%），
    // 剩下那 3% 会让背后 HUD 的金色文字/图标透出来，
    // 看起来就像「面板里还有一层文字被压住了」。模态面板就是要实心。
    const frame = roundedPanel(root, PANEL_W, PANEL_H, 0, -8, '#F6E3C5', 26, '#6B3A1A', 5, 'frame');
    // 标题背板：深木铭牌（原来是 ui/panel_deco 贴图，本身接近白色，染色后像一条突兀的白块，
    // 而且贴图自带的内框线正好压在文字上下沿，看起来像「文字被切开」）
    roundedPanel(frame, 380, 78, 0, PANEL_H / 2 - 58, '#5C4420', 20, '#3A2208', 4, 'titlePlate');

    const title = label(frame, t(titleKey, G.lang), 0, PANEL_H / 2 - 58, 340, 60, {
        size: 40, color: '#FFE9A8', outline: '#2A1608', outlineWidth: 3,
    });
    // 允许面板把副标题（如成就进度 6/24）追加到铭牌上，避免再占用一行把首行卡片压住
    title.node.name = 'ptitle';

    const sv = scrollView(frame, BODY_W, bodyH, 0, SCROLL_TOP - bodyH / 2);
    // ★ content 的锚点是 (0.5, 1)，所以它的 y 必须写「视口半高 - 顶部留白」才能让内容顶对齐视口顶。
    //   以前这里是 0 → 内容整体下沉半个视口，面板上半截永远是空的
    //   （设置面板「上面一大片空白、内容全挤在下面」就是这么来的）。
    //   TOP_PAD 是给第一行留的余量：成就那种 104 高的首行卡片，中心贴着内容顶时
    //   上半截会被视口上沿切掉（截图上就是「第一行只露出下半截」）。
    sv.content.setPosition(0, bodyH / 2 - TOP_PAD, 0);
    const topPad = nd(sv.content, 'topPad', BODY_W, 10, 0, 0, 0.5, 1);

    const wrap: PanelWrap = {
        root, body: sv.content, frame, host: root.addComponent(PanelHost),
        // 收起 = 面板「缩放回去」+ 遮罩淡掉（不再有位移）
        close: () => {
            Modal.pop();
            const o = root.getComponent(UIOpacity)!;
            tween(o).to(0.16, { opacity: 0 }).start();
            popOut(frame, 0.16, () => root.destroy());
        },
    };
    void topPad;

    const closeBtn = button(frame, {
        w: 84, h: 84, x: PANEL_W / 2 - 52, y: PANEL_H / 2 - 54,
        tex: 'ui/card_white', inset: [26, 26, 26, 26], texColor: '#5C4420',
        sound: 'click', name: 'close', onClick: () => wrap.close(),
    });
    img(closeBtn, 'ui/btn_close', 46, 46, 0, 0);

    Modal.push();
    popIn(frame);
    return wrap;
}

/** 面板上的一行“卡片”（默认配色 = 深木牌 + 更深的木框） */
export function rowCard(parent: Node, w: number, h: number, x: number, y: number, tint = '#4A3420'): Node {
    return roundedPanel(parent, w, h, x, y, tint, 18, '#33240F', 3, 'row');
}

/** 资源不足提示 */
export function denyToast(needCaps = false) {
    Toast.I?.show(t(needCaps ? 'not_enough' : 'not_enough', G.lang) + (needCaps ? '（瓶盖）' : '（金币）'), '#FFB0A0');
    void Vec3;
}

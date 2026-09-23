import { _decorator, Component, Node, Vec3, tween, Label, Sprite, UITransform } from 'cc';
import { LAYOUT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { button, img, label, nd, roundedPanel, scrollView, sliced, tint } from './UIKit';
import { CW, buildBottleTab, buildHelperTab } from './DrawerContent';

const { ccclass } = _decorator;

export type DrawerTab = 'bottle' | 'helper';

const TAB_LABEL: Record<DrawerTab, string> = { bottle: 'tab_bottle', helper: 'tab_helper' };
const TAB_ICON: Record<DrawerTab, string> = { bottle: 'bottle/icon_classic', helper: 'env/hand' };

const DRAWER_W = 720;
const DRAWER_H = LAYOUT.drawerH;
const OPEN_Y = LAYOUT.drawerOpenY;
const CLOSED_Y = LAYOUT.drawerClosedY;

/** 头部条带高度 —— 滚动区 = DRAWER_H - HEAD_H */
const HEAD_H = 104;
const HEAD_Y = DRAWER_H / 2 - HEAD_H / 2;
const SCROLL_H = DRAWER_H - HEAD_H;
const SCROLL_Y = -HEAD_H / 2;

/**
 * 底部抽屉式升级面板（消耗金币：买瓶子 / 雇助手）。
 *
 * 注意：抽屉加高到 600 后底沿会盖住主界面底部导航，所以**页签搬进抽屉头部**，
 * 打开期间靠抽屉自己的两颗页签切换、右上角关闭，交互闭环不依赖被盖住的导航。
 */
@ccclass('Drawer')
export class Drawer extends Component {
    static I: Drawer = null!;

    /** 开关状态变化（GameRoot 用它隐藏被盖住的主界面底栏） */
    onOpenChanged: ((open: boolean) => void) | null = null;

    private content: Node = null!;
    private coinLb: Label = null!;
    private cur: DrawerTab = 'bottle';
    private tabUis: Record<string, { bg: Sprite, lb: Label }> = {};
    private refreshers: Record<string, () => void> = {};
    private isOpen = false;

    onLoad() { Drawer.I = this; }

    build() {
        const root = this.node;
        (root.getComponent(UITransform) as any).setContentSize(DRAWER_W, DRAWER_H);

        roundedPanel(root, DRAWER_W, DRAWER_H, 0, 0, '#141A24F7', 26, '#C8A44A', 4, 'bg');
        roundedPanel(root, DRAWER_W - 24, HEAD_H - 8, 0, HEAD_Y, '#0E1622', 18, '#2A3448', 3, 'head');

        /* ---- 金币余额 ---- */
        const pill = nd(root, 'coins', 200, 58, -238, HEAD_Y);
        roundedPanel(pill, 200, 58, 0, 0, '#1B2434', 16, '#38455E', 3, 'pb');
        img(pill, 'stat/income', 34, 34, -74, 1);
        this.coinLb = label(pill, '$0', 86, 1, 130, 40, {
            size: 25, color: '#FFD75E', hAlign: 'right', anchorX: 1, outline: '#0B0F16', outlineWidth: 2,
        });

        /* ---- 页签（搬进抽屉头部，因为底栏被抽屉盖住） ---- */
        const defs: DrawerTab[] = ['bottle', 'helper'];
        for (let i = 0; i < defs.length; i++) {
            const id = defs[i];
            const x = i === 0 ? -30 : 152;
            const bg = sliced(root, 'ui/card_white', 178, 58, x, HEAD_Y, [26, 26, 26, 26], '#22304A', 'dtab_' + id);
            const n = bg.node;
            img(n, TAB_ICON[id], 38, 34, -56, 0);
            const lb = label(n, t(TAB_LABEL[id], G.lang), 16, 1, 112, 34, { size: 20, color: '#C9D6E6' });
            this.tabUis[id] = { bg, lb };
            n.on(Node.EventType.TOUCH_END, () => { this.setTab(id); this.open(); });
        }

        const closeBtn = button(root, {
            w: 68, h: 68, x: DRAWER_W / 2 - 58, y: HEAD_Y,
            tex: 'ui/card_white', inset: [24, 24, 24, 24], texColor: '#26324A',
            sound: 'click', name: 'dclose', onClick: () => this.close(),
        });
        img(closeBtn, 'ui/btn_close', 38, 38, 0, 0);

        const sv = scrollView(root, DRAWER_W - 36, SCROLL_H, 0, SCROLL_Y);
        this.content = sv.content;

        this.setTab('bottle');
        this.refresh();
        G.addListener(() => this.refreshTexts());
    }

    /** 供 NavBar 调用：切页并展开 */
    toggle(tab: DrawerTab) {
        if (this.isOpen && this.cur === tab) { this.close(); return; }
        this.setTab(tab);
        this.open();
    }

    setTab(tab: DrawerTab) {
        this.cur = tab;
        if (!this.content || !this.content.isValid) { return; }
        // content 锚点在顶部 → 位置写的是「view 局部坐标」，等于滚动区半高
        this.content.setPosition(0, SCROLL_H / 2, 0);
        this.refreshers[tab] = tab === 'bottle'
            ? buildBottleTab(this.content)
            : buildHelperTab(this.content);
        this.refreshTexts();
    }

    open() {
        if (!this.isOpen) {
            this.isOpen = true;
            if (this.onOpenChanged) { this.onOpenChanged(true); }
        }
        tween(this.node).to(0.22, { position: new Vec3(0, OPEN_Y, 0) }, { easing: 'quadOut' }).start();
    }

    close() {
        if (this.isOpen) {
            this.isOpen = false;
            if (this.onOpenChanged) { this.onOpenChanged(false); }
        }
        tween(this.node).to(0.18, { position: new Vec3(0, CLOSED_Y, 0) }, { easing: 'quadIn' }).start();
    }

    get opened(): boolean { return this.isOpen; }
    get tab(): DrawerTab { return this.cur; }

    /** 每 0.25s 刷新可见文本（只改字符串，绝不重建节点） */
    private acc = 0;
    update(dt: number) {
        this.acc += dt;
        if (this.acc < 0.25) { return; }
        this.acc = 0;
        if (!this.isOpen) { return; }
        const r = this.refreshers[this.cur];
        if (r) { r(); }
    }

    refresh() { this.refreshTexts(); }

    private lastCoin = -1;

    private refreshTexts() {
        for (const id of ['bottle', 'helper'] as DrawerTab[]) {
            const tu = this.tabUis[id];
            if (!tu || !tu.bg.isValid) { continue; }
            const on = id === this.cur;
            tint(tu.bg, on ? '#F2C64B' : '#22304A');
            tint(tu.lb, on ? '#1B2334' : '#C9D6E6');
            tu.lb.string = t(TAB_LABEL[id], G.lang);
        }
        const m = Math.floor(G.data.money);
        if (m !== this.lastCoin && this.coinLb && this.coinLb.isValid) {
            this.lastCoin = m;
            this.coinLb.string = '$' + fmt(m);
            tint(this.coinLb, m > 0 ? '#FFD75E' : '#8FA3BC');
        }
        void CW;
    }
}

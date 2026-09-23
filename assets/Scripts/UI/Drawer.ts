import { _decorator, BlockInputEvents, Component, Label, Node, Sprite, UITransform } from 'cc';
import { LAYOUT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import {
    bar, button, img, label, maskIn, maskOut, modalMask, nd, popIn, popOut, roundedPanel, scrollView, setFrame, sliced, tint,
} from './UIKit';
import { buildBottleTab, buildHelperTab } from './DrawerContent';

const { ccclass } = _decorator;

export type DrawerTab = 'bottle' | 'helper';

const TAB_LABEL: Record<DrawerTab, string> = { bottle: 'tab_bottle', helper: 'tab_helper' };
const TAB_ICON: Record<DrawerTab, string> = { bottle: 'bottle/icon_classic', helper: 'env/hand' };

const DRAWER_W = 720;
const DRAWER_H = LAYOUT.drawerH;

/**
 * 头部条带高度 —— 滚动区 = DRAWER_H - HEAD_H - 底部留白。
 *
 * ⚠️ 原来 SCROLL_H = DRAWER_H - HEAD_H，滚动区下沿**正好压在卡片描边上**，
 * 最后一行（词条行）的按钮和描述被那道金色描边切掉半个，看着就是「文字被挡住」。
 * 现在下沿往上收 28px，最后一行留出呼吸位。
 */
const HEAD_H = 104;
const BOTTOM_PAD = 28;
const HEAD_Y = DRAWER_H / 2 - HEAD_H / 2;
const SCROLL_H = DRAWER_H - HEAD_H - BOTTOM_PAD;
const SCROLL_Y = -DRAWER_H / 2 + BOTTOM_PAD + SCROLL_H / 2;
/** 头部下方固定的里程碑条（GDD §7 24 阶） */
const MS_H = 48;
const MS_Y = HEAD_Y - HEAD_H / 2 + MS_H / 2;

/**
 * 升级面板（消耗金币：买瓶子 / 雇助手）。
 *
 * ⚠️ 出场方式已从「底部上滑抽屉」改为「屏幕中间 Q 弹浮现」（用户要求）：
 *  - 结构 = 全屏遮罩（只淡入淡出，不缩放） + 居中卡片（popIn/popOut 缩放）；
 *  - 卡片挂 BlockInputEvents，保证点卡片空白处不会穿透到遮罩被误关；
 *  - 收起 = 缩放回 0.78 + 淡出，动画完再 active = false（不是滑回屏幕外）；
 *  - 因为卡片只占屏幕中间 820px，底部导航仍在遮罩下可见，
 *    所以不再需要「打开时整块收起底栏」，只保留高亮同步。
 */
@ccclass('Drawer')
export class Drawer extends Component {
    static I: Drawer = null!;

    /** 开关状态变化（GameRoot 用它同步底部导航高亮） */
    onOpenChanged: ((open: boolean) => void) | null = null;

    private card: Node = null!;
    private mask: Node = null!;
    private content: Node = null!;
    private coinLb: Label = null!;
    /** 里程碑条：固定在头部下方，不随内容滚动（GDD §7 24 阶） */
    private msStrip: Node = null!;
    private msTitle: Label = null!;
    private msValue: Label = null!;
    private msBar: { set: (p: number) => void } = null!;
    private cur: DrawerTab = 'bottle';
    private tabUis: Record<string, { bg: Sprite, lb: Label }> = {};
    private refreshers: Record<string, () => void> = {};
    private isOpen = false;

    onLoad() { Drawer.I = this; }

    build() {
        const root = this.node;
        (root.getComponent(UITransform) as any).setContentSize(DRAWER_W, DRAWER_H);

        // 遮罩建在卡片之前（兄弟序更低 = 渲染在下）
        this.mask = modalMask(root, () => this.close());

        // 卡片本体：所有 UI 都进这张卡，缩放入场时整体一起动
        const card = nd(root, 'cardUI', DRAWER_W, DRAWER_H, 0, 0);
        card.addComponent(BlockInputEvents);
        this.card = card;

        // 同 Panel.frame：实心底，别让背后 HUD 文字透出来（见 Panel.ts 注释）
        roundedPanel(card, DRAWER_W, DRAWER_H, 0, 0, '#141A24', 26, '#C8A44A', 4, 'bg');
        roundedPanel(card, DRAWER_W - 24, HEAD_H - 8, 0, HEAD_Y, '#0E1622', 18, '#2A3448', 3, 'head');

        /* ---- 金币余额 ---- */
        const pill = nd(card, 'coins', 200, 58, -238, HEAD_Y);
        roundedPanel(pill, 200, 58, 0, 0, '#1B2434', 16, '#38455E', 3, 'pb');
        img(pill, 'stat/income', 34, 34, -74, 1);
        this.coinLb = label(pill, '$0', 86, 1, 130, 40, {
            size: 25, color: '#FFD75E', hAlign: 'right', anchorX: 1, outline: '#0B0F16', outlineWidth: 2,
        });

        /* ---- 页签 ---- */
        const defs: DrawerTab[] = ['bottle', 'helper'];
        for (let i = 0; i < defs.length; i++) {
            const id = defs[i];
            const x = i === 0 ? -30 : 152;
            const bg = sliced(card, 'ui/card_white', 178, 58, x, HEAD_Y, [26, 26, 26, 26], '#22304A', 'dtab_' + id);
            const n = bg.node;
            img(n, TAB_ICON[id], 38, 34, -56, 0);
            const lb = label(n, t(TAB_LABEL[id], G.lang), 16, 1, 112, 34, { size: 20, color: '#C9D6E6' });
            this.tabUis[id] = { bg, lb };
            n.on(Node.EventType.TOUCH_END, () => { this.setTab(id); this.open(); });
        }

        const closeBtn = button(card, {
            w: 68, h: 68, x: DRAWER_W / 2 - 58, y: HEAD_Y,
            tex: 'ui/card_white', inset: [24, 24, 24, 24], texColor: '#26324A',
            sound: 'click', name: 'dclose', onClick: () => this.close(),
        });
        img(closeBtn, 'ui/btn_close', 38, 38, 0, 0);

        /* ---- 里程碑条（GDD §7 24 阶）—— 固定在头部下方，不随滚动内容走 ---- */
        const msStrip = nd(card, 'msStrip', DRAWER_W - 36, MS_H, 0, MS_Y);
        roundedPanel(msStrip, DRAWER_W - 36, MS_H, 0, 0, '#1A2230', 20, '#2A3448', 2, 'msBg');
        const msIc = nd(msStrip, 'ic', 40, 40, -312, 0);
        setFrame(msIc.addComponent(Sprite), 'ui/icon_ach', 40, 40);
        // 标题不裁剪：最长阶段奖励约 18 个字符，450px / 17px 足够；
        // 若仍略长，会自然延伸到与数值之间的空白，不会重叠（数值在右侧）。
        this.msTitle = label(msStrip, '', -280, 0, 180, 36,
            { size: 20, color: '#FFE9A8', hAlign: 'left', anchorX: 0 });
        this.msValue = label(msStrip, '', 310, 0, 100, 32,
            { size: 18, color: '#C9D6E6', hAlign: 'right', anchorX: 1 });
        this.msBar = bar(msStrip, 300, 10, 74, 0, '#C8A44A', '#101722');
        this.msStrip = msStrip;
        this.msStrip.active = false;

        const sv = scrollView(card, DRAWER_W - 36, SCROLL_H, 0, SCROLL_Y);
        this.content = sv.content;

        this.setTab('bottle');
        this.refresh();
        G.addListener(() => this.refreshTexts());

        // 初始隐藏（不占位、不拦输入），由 open() 弹出来
        root.active = false;
    }

    /** 供 NavBar 调用：切页并展开 */
    toggle(tab: DrawerTab) {
        if (this.isOpen && this.cur === tab) { this.close(); return; }
        this.setTab(tab);
        this.open();
    }

    setTab(tab: DrawerTab) {
        this.cur = tab;
        if (this.msStrip && this.msStrip.isValid) {
            this.msStrip.active = (tab === 'bottle');
        }
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
        this.node.active = true;      // 必须先立起来，tween 才会跑
        maskIn(this.mask, 0.16);
        popIn(this.card, 0.32);
    }

    close() {
        if (!this.isOpen) { return; }
        this.isOpen = false;
        if (this.onOpenChanged) { this.onOpenChanged(false); }
        maskOut(this.mask, 0.16);
        popOut(this.card, 0.16, () => {
            if (!this.isOpen) { this.node.active = false; }
        });
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
        this.refreshMs();
    }

    /** 里程碑条文案刷新（GDD §7 24 阶，瓶子升级页签独有） */
    private refreshMs() {
        if (!this.msStrip || !this.msStrip.active || !this.msTitle || !this.msTitle.isValid) { return; }
        const n = G.milestone;
        const next = G.msNext;
        // 标题只显示阶段号，阶段奖励/描述放在统计面板，避免长文本被截
        this.msTitle.string = t('ms_chip', G.lang).replace('{n}', String(n));
        this.msValue.string = next ? (fmt(G.msProgress) + ' / ' + fmt(next.need)) : t('ms_max', G.lang);
        this.msBar.set(G.msRatio);
    }
}

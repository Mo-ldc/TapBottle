import { _decorator, Component, Node, Label, UIOpacity, tween } from 'cc';
import { LAYOUT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { button, img, label, MASK_SIZE, nd, popIn, popOut, rect, roundedPanel, sizeOf, tint } from './UIKit';

const { ccclass } = _decorator;

/** 顶部资源状态栏：左「瓶盖」右「金币」（对照原版 Bottle Flip Inc 的顶栏） */
@ccclass('Hud')
export class Hud extends Component {
    private moneyLb: Label = null!;
    private incLb: Label = null!;
    private capsLb: Label = null!;
    private pendingLb: Label = null!;
    private langLb: Label = null!;
    private staminaFill: Node = null!;
    private staminaBar: Node = null!;
    private berserkLb: Label = null!;
    private shownMoney = 0;
    private rateAcc = 0;
    // 字符串缓存：Label 只有在文本真的变化时才重建网格，否则每帧写 string 会很贵
    private cMoney = '';
    private cInc = '';
    private cCaps = '';
    private cPend = '';
    private cStatus = '';

    build(cb: {
        onSettings: () => void, onAch: () => void, onStats: () => void,
        onLang: () => void,
    }, bottomRoot?: Node) {
        const Y = LAYOUT.hudY;

        roundedPanel(this.node, 704, LAYOUT.hudH, 0, Y, '#121824EE', 24, '#2C3A52', 3, 'hudStrip');

        /* ---- 左：瓶盖（履带回收后的可用量） ---- */
        img(this.node, 'bottle/capchip_6', 50, 44, -318, Y + 22);
        this.capsLb = label(this.node, '0', -286, Y + 22, 220, 48, {
            size: 38, color: '#7FE1FF', hAlign: 'left', anchorX: 0, outline: '#0B1A24', outlineWidth: 3,
        });
        this.pendingLb = label(this.node, '', -286, Y - 16, 250, 30, {
            size: 19, color: '#5E7C93', hAlign: 'left', anchorX: 0,
        });

        /* ---- 右：金币 / 每秒 ---- */
        this.moneyLb = label(this.node, '$0', 350, Y + 26, 300, 52, {
            size: 44, color: '#FFD75E', hAlign: 'right', anchorX: 1, outline: '#20160A', outlineWidth: 3,
        });
        this.incLb = label(this.node, '/s $0', 350, Y - 16, 280, 32, {
            size: 21, color: '#8CE7A2', hAlign: 'right', anchorX: 1, outline: '#101820', outlineWidth: 2,
        });

        /* ---- 工具按钮：设置 / 语言 / 成就 / 统计 ---- */
        const tools: Array<{ icon: string, name: string, click: () => void }> = [
            { icon: 'ui/icon_gear', name: 'gear', click: () => cb.onSettings() },
            { icon: '', name: 'lang', click: () => cb.onLang() },
            { icon: 'ui/icon_ach', name: 'ach', click: () => cb.onAch() },
            { icon: 'ui/icon_stat', name: 'stats', click: () => cb.onStats() },
        ];
        for (let i = 0; i < tools.length; i++) {
            const d = tools[i];
            const b = button(this.node, {
                w: 56, h: 54, x: -320 + i * 64, y: Y - 30,
                tex: 'ui/card_white', inset: [26, 26, 26, 26], texColor: '#26324A',
                sound: 'click', name: 'tool_' + d.name, onClick: d.click,
            });
            if (d.name === 'lang') {
                this.langLb = label(b, G.lang === 'zh' ? '中' : 'EN', 0, 0, 50, 40, { size: 24, color: '#9FE3FF' });
            } else {
                img(b, d.icon, 38, 38, 0, 0);
            }
        }

        /* ---- 狂暴 / 决意 状态行 ---- */
        this.berserkLb = label(this.node, '', 0, LAYOUT.statusY, 680, 34, {
            size: 22, color: '#FFB48A', outline: '#20100A', outlineWidth: 3,
        });
        this.berserkLb.node.active = false;

        /* ---- 放置体力条（属底部块：随主导航一起贴屏幕底） ---- */
        const bp = (bottomRoot && bottomRoot.isValid) ? bottomRoot : this.node;
        this.staminaBar = rect(bp, 240, 10, 0, LAYOUT.staminaY, '#101722', 'stamBar');
        this.staminaFill = rect(bp, 240, 10, 0, LAYOUT.staminaY, '#5FD68A', 'stamFill');
        sizeOf(this.staminaFill).setAnchorPoint(0, 0.5);
        this.staminaFill.setPosition(-120, LAYOUT.staminaY, 0);
        this.staminaBar.active = false;
        this.staminaFill.active = false;

        G.addListener(() => this.refresh());
    }

    update(dt: number) {
        const target = G.data.money;
        const k = 1 - Math.exp(-9 * dt);
        this.shownMoney += (target - this.shownMoney) * k;
        if (Math.abs(target - this.shownMoney) < Math.max(0.5, target * 0.0005)) { this.shownMoney = target; }
        const ms = '$' + fmt(this.shownMoney);
        if (ms !== this.cMoney) { this.cMoney = ms; this.moneyLb.string = ms; }

        this.rateAcc += dt;
        if (this.rateAcc >= 0.4) {
            this.rateAcc = 0;
            const inc = t('per_sec', G.lang) + ' $' + fmt(G.data.eps);
            if (inc !== this.cInc) { this.cInc = inc; this.incLb.string = inc; }
        }

        const cs = fmt(G.data.caps);
        if (cs !== this.cCaps) { this.cCaps = cs; this.capsLb.string = cs; }

        if (this.pendingLb) {
            const pend = Math.round(G.pendingCaps);
            const ps = pend > 0 ? t('belt_pending', G.lang).replace('{n}', fmt(pend)) : '';
            if (ps !== this.cPend) { this.cPend = ps; this.pendingLb.string = ps; }
        }
        // 语言切换由 G.addListener 触发，不必每帧写

        // 狂暴 / 决意
        let txt = '';
        if (G.berserkFlips > 0) {
            txt = t('berserk_active', G.lang) + `  ×${G.berserkFlips}   ×${G.berserkMult.toFixed(1)}`;
        } else if (G.berserkUnlocked) {
            txt = t('berserk_combo', G.lang) + `  ${G.berserkStreak}/${G.berserkNeed}`;
        }
        if (G.samuraiUnlocked && !G.samuraiActive) {
            const g = Math.floor(G.samuraiGauge * 100);
            txt += (txt ? '    ' : '') + t('resolve_gauge', G.lang) + ` ${g}%`;
        }
        if (txt) {
            this.berserkLb.node.active = true;
            if (txt !== this.cStatus) {
                this.cStatus = txt;
                this.berserkLb.string = txt;
                tint(this.berserkLb, G.berserkFlips > 0 ? '#FFD07A' : '#FFB48A');
            }
        } else if (this.berserkLb.node.active) {
            this.cStatus = '';
            this.berserkLb.node.active = false;
        }

        // 体力
        const showStam = G.hasIdle && G.idleOn;
        this.staminaBar.active = showStam;
        this.staminaFill.active = showStam;
        if (showStam) {
            sizeOf(this.staminaFill).setContentSize(Math.max(1, 240 * G.idleStamina), 10);
        }
    }

    /** 由 G.notify 触发（语言/设置变化时刷静态文案） */
    private refresh() {
        if (this.langLb && this.langLb.isValid) {
            this.langLb.string = G.lang === 'zh' ? '中' : 'EN';
        }
    }

    /** 离线收益结算（GDD §6.2）—— 中央 Q 弹弹出，收起是缩放回去 */
    showOffline(money: number, caps: number, seconds: number) {
        const root = nd(this.node, 'offline', MASK_SIZE.w, MASK_SIZE.h, 0, 0);
        const rootOp = root.addComponent(UIOpacity);
        rootOp.opacity = 0;
        rect(root, MASK_SIZE.w, MASK_SIZE.h, 0, 0, '#000000AA', 'm');
        const p = roundedPanel(root, 600, 430, 0, 0, '#1B2230', 26, '#C8A44A', 5);
        label(p, t('welcome_back', G.lang), 0, 148, 550, 48, { size: 30, color: '#FFE9A8' });
        img(p, 'ui/icon_save', 90, 90, 0, 52);
        label(p, '$ ' + fmt(money) + '   +   ' + fmt(caps) + ' 瓶盖', 0, -30, 540, 54, { size: 34, color: '#FFD75E' });
        label(p, (G.lang === 'zh' ? '离线 ' : 'Away ') + Math.floor(seconds / 60) + (G.lang === 'zh' ? ' 分钟' : ' min'),
            0, -84, 540, 38, { size: 24, color: '#9FB3CC' });
        button(p, {
            w: 260, h: 84, x: 0, y: -152, tex: 'ui/btn_long_active', inset: [46, 46, 24, 24],
            text: t('ok', G.lang), fontSize: 30, sound: 'click',
            onClick: () => {
                tween(rootOp).to(0.16, { opacity: 0 }).start();
                popOut(p, 0.16, () => root.destroy());
            },
        });
        tween(rootOp).to(0.15, { opacity: 255 }).start();
        popIn(p);
    }
}

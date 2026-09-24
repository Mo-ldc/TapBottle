import { _decorator, Component, Label, Node, Sprite, Tween, UIOpacity, Vec3, tween } from 'cc';
import { LAYOUT, OFFLINE_AD_MULT } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { button, img, label, MASK_SIZE, nd, popIn, popOut, pressable, rect, setFrame, setSize, sizeOf, TEXT_SCALE, tint, applyFontDeep } from './UIKit';
import { chipPlate, WOOD, woodButton, woodPlate } from './Theme';
import { Modal } from './Modal';
import { Ads } from './Ads';
import { Toast } from './Toast';

const { ccclass, property } = _decorator;

/**
 * 顶部木牌横幅（对照参考图）：左侧返回按钮 + 金币筹码 + 瓶盖筹码 + 右端工具按钮。
 *
 * ★ 预制体化（2026-09-24）：顶栏节点树已实体化进 Game.scene 的 hudRoot
 *   （@property 直接引用；未绑定时按名字找；都没有才运行时现建）。
 *   代码只负责：绑引用 → 接按钮事件 → 每帧刷文本/体力条。
 *
 * 与旧版的差别：
 *  · 旧版是一块深蓝圆角条 + 四个图标按钮，风格是扁平冷色；
 *  · 新版通栏木牌（左端盖/中段/右端盖三件拼，中段可拉伸不变形），
 *    两个**深棕筹码**各带一枚圆形图标，数字是白字深描边 —— 完全是参考图的口径。
 *  · 原来的设置/成就/统计/语言四个入口：返回按钮 → 设置，右端三个小按钮 → 成就/统计/语言。
 */
@ccclass('Hud')
export class Hud extends Component {
    @property({ type: Label, tooltip: '金币数字（chipCoin/moneyLb）' })
    moneyLb: Label = null!;
    @property({ type: Label, tooltip: '瓶盖数字（chipCap/capsLb）' })
    capsLb: Label = null!;
    @property({ type: Label, tooltip: '语言按钮文字（tool_lang/langLb）' })
    langLb: Label = null!;
    @property({ type: Node, tooltip: '放置体力条底（stam，自带 fill 子节点）' })
    stamWrap: Node = null!;
    @property({ type: Node, tooltip: '体力条填充（stam/fill）' })
    stamFill: Node = null!;
    @property({ type: Label, tooltip: '狂暴/决意状态行（berserkLb）' })
    berserkLb: Label = null!;

    private shownMoney = 0;
    private cMoney = '';
    private cCaps = '';
    private cStatus = '';
    /** 数字伸缩动画的剩余锁定时间（>0 = 正在伸缩，不再接受新的伸缩） */
    private moneyBumpT = 0;
    private capsBumpT = 0;

    build(cb: {
        onSettings: () => void, onAch: () => void, onStats: () => void,
        onLang: () => void,
    }, bottomRoot?: Node) {
        void bottomRoot;
        // ★ 场景实体化优先：hudRoot 下已摆好整棵顶栏 → 只绑引用；
        //   旧场景 / 漏摆时才运行时现建（construct 与场景树逐节点同构）。
        if (!this.bindScene()) { this.construct(); }
        this.wire(cb);
        G.addListener(() => this.refresh());
    }

    /** 场景里已摆好顶栏（有 btn_back）→ 补齐没绑的 @property 引用，返回 true */
    private bindScene(): boolean {
        if (!this.node.getChildByName('btn_back')) { return false; }
        const byName = (s: string) => this.node.getChildByName(s);
        if (!this.moneyLb || !this.moneyLb.isValid) {
            this.moneyLb = byName('chipCoin')?.getChildByName('moneyLb')?.getComponent(Label) || null!;
        }
        if (!this.capsLb || !this.capsLb.isValid) {
            this.capsLb = byName('chipCap')?.getChildByName('capsLb')?.getComponent(Label) || null!;
        }
        if (!this.langLb || !this.langLb.isValid) {
            this.langLb = byName('tool_lang')?.getChildByName('langLb')?.getComponent(Label) || null!;
        }
        if (!this.stamWrap || !this.stamWrap.isValid) { this.stamWrap = byName('stam') || null!; }
        if ((!this.stamFill || !this.stamFill.isValid) && this.stamWrap) { this.stamFill = this.stamWrap.getChildByName('fill') || null!; }
        if (!this.berserkLb || !this.berserkLb.isValid) { this.berserkLb = byName('berserkLb')?.getComponent(Label) || null!; }
        // 编辑器里摆的 Label 是系统字体，进场景后统一换成 NotoSansSC
        applyFontDeep(this.node);
        return true;
    }

    /** 运行时兜底搭建（与 Game.scene 里 hudRoot 的节点树逐节点同构） */
    private construct() {
        const Y = LAYOUT.barY;
        // ★ 用户口径（第十四轮）：顶栏不要木牌横幅背景 —— 按钮和筹码自带底板，直接浮在木纹上。

        /* ---- 左：返回（→ 设置） ---- */
        woodButton(this.node, {
            w: LAYOUT.backSize, h: LAYOUT.backSize, x: LAYOUT.backX, y: Y,
            fill: WOOD.cream, radius: 22, icon: 'ui/icon_back',
            iconW: 48, iconH: 48, iconColor: '#E8912E',
            name: 'btn_back', sound: null,
        });

        /* ---- 金币筹码 ---- */
        const cw = LAYOUT.chipW, ch = LAYOUT.chipH;
        // 数字框：从图标右侧一直用到筹码右沿（金额最长形如 $888.8M，字号会自动缩）
        const lbW = cw - ch - 6;
        const lbX = LAYOUT.coinChipX - cw / 2 + ch + lbW / 2 - 4;
        const capLbX = LAYOUT.capChipX - cw / 2 + ch + lbW / 2 - 4;
        chipPlate(this.node, cw, ch, LAYOUT.coinChipX, Y, 'chipCoin');
        const coinX = LAYOUT.coinChipX - cw / 2 + ch / 2;
        img(this.node, 'ui/coin', ch + 6, ch + 6, coinX, Y);
        this.moneyLb = label(this.node, '$0', lbX, Y + 2, lbW, 42, {
            size: 28, color: '#FFFFFF', hAlign: 'center', outline: WOOD.line, outlineWidth: 3,
            overflow: 'shrink',
        });
        this.moneyLb.node.name = 'moneyLb';

        /* ---- 瓶盖筹码 ---- */
        chipPlate(this.node, cw, ch, LAYOUT.capChipX, Y, 'chipCap');
        const capX = LAYOUT.capChipX - cw / 2 + ch / 2;
        img(this.node, 'bottle/capchip_6', ch + 4, ch + 2, capX, Y);
        this.capsLb = label(this.node, '0', capLbX, Y + 2, lbW, 42, {
            size: 28, color: '#FFFFFF', hAlign: 'center', outline: WOOD.line, outlineWidth: 3,
            overflow: 'shrink',
        });
        this.capsLb.node.name = 'capsLb';

        /* ---- 右端工具按钮（事件统一在 wire() 里接） ---- */
        const tools: Array<{ icon: string, name: string }> = [
            { icon: 'ui/icon_ach', name: 'tool_ach' },
            { icon: 'ui/icon_stat', name: 'tool_stats' },
            { icon: '', name: 'tool_lang' },
        ];
        for (let i = 0; i < tools.length; i++) {
            const d = tools[i];
            const b = woodButton(this.node, {
                w: LAYOUT.toolSize, h: LAYOUT.toolSize,
                x: LAYOUT.toolX + i * LAYOUT.toolStepX, y: Y,
                fill: WOOD.cream, radius: 18, sound: null, name: d.name,
            });
            if (d.name === 'tool_lang') {
                this.langLb = label(b, G.lang === 'zh' ? '中' : 'EN', 0, 1, 48, 40, {
                    size: 25, color: WOOD.text,
                });
                this.langLb.node.name = 'langLb';
            } else {
                img(b, d.icon, 34, 34, 0, 0, '#7A4A1E');
            }
        }

        /* ---- 放置体力：木牌下沿一条细带（省掉原来底部那条独立体力条） ---- */
        this.stamWrap = nd(this.node, 'stam', 300, 12, 0, Y - LAYOUT.barH / 2 + 14);
        const sBg = this.stamWrap.addComponent(Sprite);
        setFrame(sBg, 'ui/px_white2', 300, 12, '#3A220CCC');
        this.stamFill = rect(this.stamWrap, 296, 8, 0, 0, '#8FCF7A', 'fill');
        sizeOf(this.stamFill).setAnchorPoint(0, 0.5);
        this.stamFill.setPosition(-148, 0, 0);
        this.stamWrap.active = false;

        /* ---- 狂暴 / 决意 状态行（收窄到 420，别和两侧猫爪挂牌重叠） ---- */
        this.berserkLb = label(this.node, '', 0, LAYOUT.statusY, 420, 34, {
            size: 23, color: '#FFE0B0', outline: WOOD.line, outlineWidth: 2,
        });
        this.berserkLb.node.name = 'berserkLb';
        this.berserkLb.node.active = false;
    }

    /** 接按钮事件（场景节点 / 运行时节点同一套手感：按压缩放 + click 音 + 回调） */
    private wire(cb: { onSettings: () => void, onAch: () => void, onStats: () => void, onLang: () => void }) {
        const byName = (s: string) => this.node.getChildByName(s);
        const back = byName('btn_back');
        if (back) { pressable(back, cb.onSettings); }
        const ach = byName('tool_ach');
        if (ach) { pressable(ach, cb.onAch); }
        const stats = byName('tool_stats');
        if (stats) { pressable(stats, cb.onStats); }
        const lang = byName('tool_lang');
        if (lang) {
            pressable(lang, cb.onLang);
        }
    }

    /** 木牌横幅已按用户要求移除 —— 保留空实现兼容 GameRoot 的调用 */
    fitWidth(vwE: number) { void vwE; }

    /** 数字伸缩动画时长（放大 + 回落，与下面的锁定时间严格一致） */
    private static readonly PULSE = 0.20;

    /**
     * 金币/瓶盖数字变动时的「伸缩一次」动画。
     * ★ 用户口径（第十六轮）：变动就伸缩一次，**伸缩期间不再接受新的伸缩**，
     *   必须等这一段播完才能再弹 —— 否则连点买瓶时数字会被反复打断、抖成一团。
     * 只缩放 label 节点本身（锚点在中心），所以是「原地胀一下」，不会推动旁边的图标。
     */
    private pulse(n: Node, which: 'money' | 'caps') {
        if (which === 'money') {
            if (this.moneyBumpT > 0) { return; }
            this.moneyBumpT = Hud.PULSE;
        } else {
            if (this.capsBumpT > 0) { return; }
            this.capsBumpT = Hud.PULSE;
        }
        if (!n || !n.isValid) { return; }
        // ⚠️ label 节点自身的基准缩放**不是 1**：UIKit.label 会按 TEXT_SCALE（=1/2）
        //    缩放节点来做 2K 超采样。所以这里每个 scale 都必须乘基准值，
        //    否则「伸缩一次」会把数字撑成两倍大并且再也回不去。
        const b = TEXT_SCALE;
        Tween.stopAllByTarget(n);
        n.setScale(b, b, 1);
        tween(n)
            .to(Hud.PULSE * 0.4, { scale: new Vec3(b * 1.22, b * 1.22, 1) }, { easing: 'quadOut' })
            .to(Hud.PULSE * 0.6, { scale: new Vec3(b, b, 1) }, { easing: 'quadIn' })
            .start();
    }

    update(dt: number) {
        if (this.moneyBumpT > 0) { this.moneyBumpT -= dt; }
        if (this.capsBumpT > 0) { this.capsBumpT -= dt; }

        const target = G.data.money;
        const k = 1 - Math.exp(-9 * dt);
        this.shownMoney += (target - this.shownMoney) * k;
        if (Math.abs(target - this.shownMoney) < Math.max(0.5, target * 0.0005)) { this.shownMoney = target; }
        const ms = '$' + fmt(this.shownMoney);
        if (ms !== this.cMoney) {
            this.cMoney = ms;
            this.moneyLb.string = ms;
            this.pulse(this.moneyLb.node, 'money');
        }

        const cs = fmt(G.data.caps);
        if (cs !== this.cCaps) {
            this.cCaps = cs;
            this.capsLb.string = cs;
            this.pulse(this.capsLb.node, 'caps');
        }

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
                tint(this.berserkLb, G.berserkFlips > 0 ? '#FFD07A' : '#FFE0B0');
            }
        } else if (this.berserkLb.node.active) {
            this.cStatus = '';
            this.berserkLb.node.active = false;
        }

        // 放置体力（挂在木牌下沿）
        const showStam = G.hasIdle && G.idleOn;
        if (this.stamWrap && this.stamWrap.isValid) {
            this.stamWrap.active = showStam;
            if (showStam) { setSize(this.stamFill, Math.max(2, 296 * G.idleStamina), 8); }
        }
    }

    private refresh() {
        if (this.langLb && this.langLb.isValid) {
            this.langLb.string = G.lang === 'zh' ? '中' : 'EN';
        }
    }

    /**
     * 离线收益结算 —— 中央 Q 弹弹出，收起是缩放回去（木纹皮肤版）。
     * @param root 弹窗挂载层 —— 必须传 panelLayer（在 uiLayer 之上）：
     *   左侧广告按钮（AdButtons）比 hudRoot 晚创建，挂在 hudRoot 的弹窗会被它盖住，
     *   遮罩压不暗按钮、按钮还能穿透点击。
     */
    showOffline(money: number, caps: number, seconds: number, root?: Node) {
        const host = root && root.isValid ? root : this.node;
        // 登记模态：否则「点确定」的那一下会顺带翻一只背后的瓶子
        // （瓶子的输入挂在全局 input 上，遮罩的 BlockInputEvents 拦不住）
        Modal.push();
        const modalRoot = nd(host, 'offline', MASK_SIZE.w, MASK_SIZE.h, 0, 0);
        // ★ pop 必须挂在「节点销毁」上而不是「点确定」上：
        //   Modal.count 是模块级单例，只要有一条销毁路径没 pop，计数就永久残留 >0
        //   → BottleField 的 aim()/pointerDown() 永远 return → 整局点不动。
        //   （实测：无头脚本直接 destroy 掉这个弹窗就把整局输入锁死了。）
        modalRoot.on(Node.EventType.NODE_DESTROYED, () => { Modal.pop(); });
        const rootOp = modalRoot.addComponent(UIOpacity);
        rootOp.opacity = 0;
        rect(modalRoot, MASK_SIZE.w, MASK_SIZE.h, 0, 0, '#000000AA', 'm');
        const card = woodPlate(modalRoot, {
            w: 600, h: 430, x: 0, y: 0, fill: WOOD.cream, radius: 30,
            inner: WOOD.creamDark, name: 'card',
        });
        label(card, t('welcome_back', G.lang), 0, 148, 550, 48, {
            size: 32, color: WOOD.text, outline: '#FFF3D6', outlineWidth: 3,
        });
        img(card, 'ui/coin', 90, 90, 0, 52);
        const earnLb = label(card, '$ ' + fmt(money) + '   +   ' + fmt(caps) + ' 瓶盖', 0, -30, 540, 54, {
            size: 34, color: '#8A5A20', outline: '#FFF3D6', outlineWidth: 3,
        });
        label(card, (G.lang === 'zh' ? '离线 ' : 'Away ') + Math.floor(seconds / 60) + (G.lang === 'zh' ? ' 分钟' : ' min'),
            0, -84, 540, 38, { size: 25, color: '#9A7A50' });

        let tripled = false;
        /** 看完广告 → 离线收益 ×3（在原结算基础上把差额 2× 补上） */
        const grantX3 = () => {
            if (tripled) { return; }
            tripled = true;
            const extraM = money * (OFFLINE_AD_MULT - 1);
            const extraC = caps * (OFFLINE_AD_MULT - 1);
            G.data.money += extraM;
            G.data.caps += extraC;
            G.data.stats.earned += extraM;
            G.data.stats.capsEarned += extraC;
            G.save();
            G.notify();
            earnLb.string = '$ ' + fmt(money * OFFLINE_AD_MULT) + '   +   ' + fmt(caps * OFFLINE_AD_MULT) + ' 瓶盖';
            adBtn.active = false;
            okBtn.setPosition(0, -152, 0);
            Toast.I?.show(t('ad_x3_done', G.lang), '#FFE9A8');
        };
        const close = () => {
            // Modal.pop 交给 NODE_DESTROYED 监听（见 showOffline 顶部注释），这里不要重复 pop
            tween(rootOp).to(0.16, { opacity: 0 }).start();
            popOut(card, 0.16, () => modalRoot.destroy());
        };
        const adBtn = button(card, {
            w: 210, h: 84, x: 116, y: -152,
            tex: 'ui/card_white', inset: [30, 30, 30, 30], texColor: WOOD.gold,
            text: t('ad_x3', G.lang), fontSize: 26, textColor: WOOD.text, sound: 'click',
            onClick: () => { Ads.I.show('offline_x3', grantX3); },
        });
        const okBtn = button(card, {
            w: 210, h: 84, x: -116, y: -152,
            tex: 'ui/card_white', inset: [30, 30, 30, 30], texColor: WOOD.gold,
            text: t('ok', G.lang), fontSize: 30, textColor: WOOD.text, sound: 'click',
            onClick: close,
        });
        tween(rootOp).to(0.15, { opacity: 255 }).start();
        popIn(card);
    }
}

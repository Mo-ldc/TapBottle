import { _decorator, Component, Label, Node, Sprite, Tween, UIOpacity, Vec3, tween } from 'cc';
import { LAYOUT } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { fmt } from '../../Core/Util';
import { button, img, label, nd, pressable, rect, setFrame, setSize, sizeOf, TEXT_SCALE, tint, applyFontDeep } from '../Base/UIKit';
import { chipPlate, WOOD, woodButton } from '../Base/Theme';
import { Toast } from '../Base/Toast';

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
 *  · 原来的设置/成就/统计/语言四个入口：返回按钮 → **回开始界面**（设置入口在开始界面），
 *    右端三个小按钮 → 成就/统计/语言。
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
    /**
     * 货币数字的**文本刷新节流**（★ 第四十三轮）。
     * 金币是缓动插值（shownMoney 每帧逼近 target）→ 原来缓动期间**每帧**都在写
     * `Label.string`，而系统字体 Label 每次改字都要重绘 canvas 再上传纹理（移动端 1~3ms/次）。
     * 限到 ~16 次/秒：滚动观感完全一样（人眼在 60fps 滚动里看不出 60ms 的粒度）。
     */
    private moneyTxtAcc = 0;
    /**
     * 伸缩动画的触发基准（★ 第四十七轮）：记上一帧的**真实数值**，涨了就弹。
     * ⚠️ 原来挂在「格式化文本变化」上 —— `fmt` 对 ≥1000 的数只保留 1~2 位有效数字，
     *    中后期金币/瓶盖涨个几十一百根本不会改文本 → 伸缩动画整个不触发
     *    （用户实测「获得金币/瓶盖时的缩放动画都无了」的根因）。
     *    首帧（基准还是 -1）不弹，避免进游戏时从 0 跳到存档值炸一下。
     */
    private pulseMoneyRef = -1;
    private pulseCapsRef = -1;

    /**
     * 货币**消耗**的飘字累积（★ 第五十一轮，用户口径）。
     * 顶栏数字是 K/M/B 缩写 → 小额消耗根本改不动文本（1.23M 扣 5000 还是 1.23M），
     * 玩家看起来就是「花了钱金币没变」。这里把每帧的净减少累起来，每 0.16s 飘一次「-1.2K」，
     * 连点购买时也不会把屏幕刷满（同一窗口内的差额合并成一个）。
     */
    private spendM = { acc: 0, t: Hud.SPEND_GAP };
    private spendC = { acc: 0, t: Hud.SPEND_GAP };

    build(cb: {
        onBack: () => void, onAch: () => void, onStats: () => void,
        onLang: () => void,
    }, bottomRoot?: Node) {
        void bottomRoot;
        // ★ 场景实体化优先：hudRoot 下已摆好整棵顶栏 → 只绑引用；
        //   旧场景 / 漏摆时才运行时现建（construct 与场景树逐节点同构）。
        if (!this.bindScene()) { this.construct(); }
        this.reskinChips();
        this.wire(cb);
        G.addListener(() => this.refresh());
    }

    /**
     * ★ 货币筹码换皮（bd05）：金币/瓶盖筹码底板换成主界面切图 bd05
     *   （深棕圆角条，源 145×52，拉到筹码 169×58 —— 比例接近不变形）。
     *   场景版（SLICED 九宫格）和运行时兜底版（chipPlate）统一在这里盖掉；
     *   尺寸沿用节点现有 contentSize，白 memset 清掉旧 tint。
     */
    private reskinChips() {
        for (const name of ['chipCoin', 'chipCap']) {
            const n = this.node.getChildByName(name);
            if (!n || !n.isValid) { continue; }
            const sp = n.getComponent(Sprite) || n.addComponent(Sprite);
            sp.type = Sprite.Type.SIMPLE;
            setFrame(sp, 'skin/main/chip_bg', undefined, undefined, '#FFFFFF');
            // ★ 用户口径：筹码旧皮肤是「底板 + gloss 高光 + stroke 描边」三层叠加，
            //   换成 bd05 整图后那两层圆形装饰与外框重复 → 隐藏，只留新底板一层。
            for (const c of [...n.children]) {
                if (c.name === 'gloss' || c.name === 'stroke') { c.active = false; }
            }
        }
        // ★ 返回（回开始界面）按钮换皮（bd04）：左上返回按钮是完整 UI 图
        //   （奶油圆角方 + 橙色左箭头，源 97×97），拆掉旧的
        //   「底板 + gloss + stroke + icon」四层拼装件，整图直贴 96×96。
        const back = this.node.getChildByName('btn_back');
        if (back && back.isValid) {
            for (const c of [...back.children]) { c.destroy(); }
            const sp = back.getComponent(Sprite) || back.addComponent(Sprite);
            sp.type = Sprite.Type.SIMPLE;
            setFrame(sp, 'skin/main/btn_back', undefined, undefined, '#FFFFFF');
        }
        // ★ 第一〇六：成就（cju）/ 统计（phb）按钮的新图已直接烘进 Game.scene
        //   （tool_ach/tool_stats → skin/main/btn_ach / btn_phb 整图 SIMPLE），
        //   这里不再运行时覆盖 —— 编辑器里改这两个按钮的贴图/尺寸即生效。
    }

    /** 场景里已摆好顶栏（有 btn_back）→ 补齐没绑的 @property 引用，返回 true */
    private bindScene(): boolean {
        if (!this.node.getChildByName('btn_back')) { return false; }
        const byName = (s: string) => this.node.getChildByName(s);
        // 数字 Label 兼容两种摆法：chipCoin/chipCap 的子节点，或 hudRoot 直接子节点
        // （construct() 兜底路径建的就是直接子节点 —— 两边口径必须一致，见 2026-09-24 排查）
        if (!this.moneyLb || !this.moneyLb.isValid) {
            this.moneyLb = byName('chipCoin')?.getChildByName('moneyLb')?.getComponent(Label)
                || byName('moneyLb')?.getComponent(Label) || null!;
        }
        if (!this.capsLb || !this.capsLb.isValid) {
            this.capsLb = byName('chipCap')?.getChildByName('capsLb')?.getComponent(Label)
                || byName('capsLb')?.getComponent(Label) || null!;
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
            fill: WOOD.cream, radius: 22, icon: 'ui/icon/icon_back',
            iconW: 48, iconH: 48, iconColor: '#E8912E',
            name: 'btn_back', sound: null,
        });

        /* ---- 金币筹码 ---- */
        const cw = LAYOUT.chipW, ch = LAYOUT.chipH;
        // 数字框：从图标右侧一直用到筹码右沿（金额最长形如 888.8M，字号会自动缩）
        const lbW = cw - ch - 6;
        const lbX = LAYOUT.coinChipX - cw / 2 + ch + lbW / 2 - 4;
        const capLbX = LAYOUT.capChipX - cw / 2 + ch + lbW / 2 - 4;
        chipPlate(this.node, cw, ch, LAYOUT.coinChipX, Y, 'chipCoin');
        const coinX = LAYOUT.coinChipX - cw / 2 + ch / 2;
        img(this.node, 'ui/icon/coin', ch + 6, ch + 6, coinX, Y);
        // ★ 用户口径（第三十二轮）：顶栏金币已有金币图标，数字前不再加 `$`
        this.moneyLb = label(this.node, '0', lbX, Y + 2, lbW, 42, {
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

        /* ---- 右端工具按钮（事件统一在 wire() 里接） ----
         * ★ 第一〇六：与场景版同构 —— 成就/统计是自带木框的整图直贴（btn_ach/btn_phb），
         *   不再走 woodButton+icon 拼装（运行时换皮已随场景真源删除）。语言按钮保持文字样式。 */
        const tools: Array<{ icon: string, name: string }> = [
            { icon: 'skin/main/btn_ach', name: 'tool_ach' },
            { icon: 'skin/main/btn_phb', name: 'tool_stats' },
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
                for (const c of [...b.children]) { c.destroy(); }
                const sp = b.getComponent(Sprite) || b.addComponent(Sprite);
                sp.type = Sprite.Type.SIMPLE;
                setFrame(sp, d.icon, undefined, undefined, '#FFFFFF');
            }
        }

        /* ---- 放置体力：木牌下沿一条细带（省掉原来底部那条独立体力条） ---- */
        this.stamWrap = nd(this.node, 'stam', 300, 12, 0, Y - LAYOUT.barH / 2 + 14);
        const sBg = this.stamWrap.addComponent(Sprite);
        setFrame(sBg, 'ui/pixel/px_white2', 300, 12, '#3A220CCC');
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
    private wire(cb: { onBack: () => void, onAch: () => void, onStats: () => void, onLang: () => void }) {
        const byName = (s: string) => this.node.getChildByName(s);
        const back = byName('btn_back');
        if (back) { pressable(back, cb.onBack); }
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
    /** 消耗飘字的最小间隔（连点购买时把这段窗口内的差额合并成一个飘字） */
    private static readonly SPEND_GAP = 0.16;
    /** 消耗飘字的起始上移量（相对货币数字节点，往上飘到筹码外） */
    private static readonly FLOAT_DY = 34;

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

    /**
     * ★ 第五十一轮（用户口径）：货币**减少**时在数字上方飘出差额。
     *
     * 起因：顶栏数字是 K/M/B 缩写 —— 1.23M 花掉 5000，显示还是「1.23M」，
     * 玩家反馈「消耗金币发现金币不会更新」（实测数值确实一直在刷，是缩写把变化吃掉了）。
     * 现在把差额直接摆在眼前：`-1.2K` / `-500`。
     *
     * 累积窗口 `SPEND_GAP`：连点购买时把窗口内的差额合并成一个飘字，不会把屏幕刷满；
     * 同一窗口里的收益（翻转赚钱）会先抵消掉，只飘净消耗。
     */
    private flushSpend(src: Label, dm: number, which: 'money' | 'caps') {
        const s = which === 'money' ? this.spendM : this.spendC;
        if (dm < 0) {
            if (s.acc === 0) { s.t = Hud.SPEND_GAP; }        // 新的一笔消耗 → 本次立即飘
            s.acc += dm;
        } else if (dm > 0 && s.acc < 0) {
            s.acc = Math.min(0, s.acc + dm);                 // 同窗口的收益抵消掉一部分消耗
        }
        if (s.acc < -0.5 && s.t >= Hud.SPEND_GAP) {
            this.floatDelta(src, s.acc);
            s.acc = 0;
            s.t = 0;
        }
    }

    /** 飘出一枚「-N」小字（从货币数字上方浮起、渐隐后销毁） */
    private floatDelta(src: Label, delta: number) {
        if (!src || !src.isValid || Math.abs(delta) < 0.5) { return; }
        const host = src.node.parent;
        if (!host || !host.isValid) { return; }
        const p = src.node.position;
        const lb = label(host, fmt(delta), p.x, p.y + Hud.FLOAT_DY, 260, 46, {
            size: 30, color: '#FFA08C', outline: WOOD.line, outlineWidth: 3,
        });
        const n = lb.node;
        n.name = 'deltaFly';
        n.setSiblingIndex(host.children.length - 1);
        const op = n.addComponent(UIOpacity);
        op.opacity = 255;
        tween(n).to(0.62, { position: new Vec3(p.x, p.y + Hud.FLOAT_DY + 46, 0) }, { easing: 'quadOut' }).start();
        tween(op).delay(0.24).to(0.38, { opacity: 0 })
            .call(() => { if (n.isValid) { n.destroy(); } })
            .start();
    }

    update(dt: number) {
        if (this.moneyBumpT > 0) { this.moneyBumpT -= dt; }
        if (this.capsBumpT > 0) { this.capsBumpT -= dt; }
        // 飘字计时（钳到 1s 上限，避免长跑时无意义增长；判断只用「>= SPEND_GAP」）
        if (this.spendM.t < 1) { this.spendM.t += dt; }
        if (this.spendC.t < 1) { this.spendC.t += dt; }

        const target = G.data.money;
        // ★ 第四十七轮：数值涨了就弹（不再看格式化文本变没变，见 pulseMoneyRef 注释）
        if (this.pulseMoneyRef >= 0 && target > this.pulseMoneyRef) { this.pulse(this.moneyLb.node, 'money'); }
        // ★ 第五十一轮：数值**掉了**就飘出差额（缩写数字看不出小额消耗，见 spendAccM 注释）
        if (this.pulseMoneyRef >= 0) { this.flushSpend(this.moneyLb, target - this.pulseMoneyRef, 'money'); }
        this.pulseMoneyRef = target;
        const k = 1 - Math.exp(-9 * dt);
        this.shownMoney += (target - this.shownMoney) * k;
        if (Math.abs(target - this.shownMoney) < Math.max(0.5, target * 0.0005)) { this.shownMoney = target; }
        // 文本节流：缓动期间 ~16 次/秒刷新足够（见 moneyTxtAcc 注释）
        this.moneyTxtAcc += dt;
        const ms = fmt(this.shownMoney);
        if (ms !== this.cMoney && (this.moneyTxtAcc >= 0.06 || this.shownMoney === target)) {
            this.moneyTxtAcc = 0;
            this.cMoney = ms;
            this.moneyLb.string = ms;
        }

        const caps = G.data.caps;
        if (this.pulseCapsRef >= 0 && caps > this.pulseCapsRef) { this.pulse(this.capsLb.node, 'caps'); }
        if (this.pulseCapsRef >= 0) { this.flushSpend(this.capsLb, caps - this.pulseCapsRef, 'caps'); }
        this.pulseCapsRef = caps;
        const cs = fmt(caps);
        if (cs !== this.cCaps) {
            this.cCaps = cs;
            this.capsLb.string = cs;
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
}

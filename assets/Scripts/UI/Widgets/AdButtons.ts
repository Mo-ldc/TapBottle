import { _decorator, Component, Color, Label, Node, Sprite } from 'cc';
import { G } from '../../Core/State';
import { FEAT } from '../../Core/Features';
import { t } from '../../Core/Locale';
import { label, nd, setFrame } from '../Base/UIKit';
import { Ads } from '../Base/Ads';
import { Toast } from '../Base/Toast';

const { ccclass } = _decorator;

/**
 * 屏幕中部靠左的四枚广告按钮（美术整图 UI，bd07-10，图标/文字/广告角标都已画死）：
 *   ① 双倍金币 —— 3 分钟内每次结算在原有基础上再结算一倍
 *   ② 双倍瓶盖 —— 3 分钟内瓶盖产出 ×2
 *   ③ 光圈变大 —— 3 分钟内光标吸附光圈 ×2（解锁光圈后按钮才出现）
 *   ④ 狂暴模式 —— 看广告直接补满狂暴次数（= 连击攒满的同一数值 G.berserkFlipsMax）
 *
 * 规则（★ 第一百一十四轮改口径）：
 *   · ①②③ 是计时增益，**可无限看** —— 再看一次时间直接叠加；
 *     生效期间按钮**不再置灰**，剩余时间显示在**按钮下方**的小字里；
 *   · 到期时间是绝对时间戳（存档 data.adBuffs）→ 离线 / 关游戏期间也在正常倒计时；
 *   · ④ 狂暴不是计时增益，保留「次数 > 0 时压暗显示 ×N」的旧表现；
 *   · 按钮自带触摸区，浮在木桌左缘（瓶子活动区 x∈[-150,150] 之外，不挡点击）。
 *
 * ★ 换皮（2026-09-28）：按钮视觉 = 一张完整 UI 图（skin/main/ab_*），
 *   不再叠加任何文字 / 广告角标（图里自带）。增益生效期间的盖层 = 同图压暗（轮廓形状）。
 */
@ccclass('AdButtons')
export class AdButtons extends Component {
    /** 设计区左缘：720/2=360，按钮宽 136 → 中线 -288，右沿 -220，不进瓶子活动区 */
    private static readonly X = -288;

    private items: Array<{
        kind: 'coin' | 'cap' | 'halo' | 'berserk';
        plate: Node;
        dim: Node | null;
        timeLb: Label | null;
    }> = [];

    /**
     * ★ 场景实体化优先：adRoot 下已摆好广告牌（ad_coin/ad_cap/ad_halo）
     *   → 只绑引用+接事件；否则运行时现建。两条路最后都走 reskin() 换成整图 UI。
     */
    build() {
        if (!this.bindScene()) { this.construct(); }
        else { this.ensureBerserk(); }   // 场景只摆了旧的三块 → 狂暴牌补建
        for (const it of this.items) {
            // ★ 第五十八轮：补 TOUCH_START/CANCEL 成对注册 + 按压缩放反馈 ——
            //   以前只有 TOUCH_END，触摸目标链不完整且点了没有视觉反馈，
            //   表现就是「点一下像没反应」；现在按下即缩小，抬手恢复并触发。
            it.plate.on(Node.EventType.TOUCH_START, () => { it.plate.setScale(0.94, 0.94, 1); });
            it.plate.on(Node.EventType.TOUCH_CANCEL, () => { it.plate.setScale(1, 1, 1); });
            it.plate.on(Node.EventType.TOUCH_END, () => {
                it.plate.setScale(1, 1, 1);
                if (it.kind === 'berserk') { this.watchBerserk(); return; }
                Ads.I.watchBuff(it.kind);
            });
        }
    }

    /** 场景实体化版没有 ad_berserk（旧版只有三块）→ 运行时补建 */
    private ensureBerserk() {
        // ★ 第八十三轮：特殊技能停用 → 「狂暴模式」广告牌也不补建
        if (!FEAT.abilities) { return; }
        if (this.items.some(i => i.kind === 'berserk')) { return; }
        this.items.push(this.newPlate('berserk', -232));
    }

    /** 场景里已摆好广告牌（有 ad_coin）→ 补齐引用，返回 true */
    private bindScene(): boolean {
        const first = this.node.getChildByName('ad_coin');
        if (!first) { return false; }
        const specs: Array<{ kind: 'coin' | 'cap' | 'halo' | 'berserk'; name: string }> = [
            { kind: 'coin', name: 'ad_coin' },
            { kind: 'cap', name: 'ad_cap' },
            { kind: 'halo', name: 'ad_halo' },
            // ★ 第八十三轮：特殊技能停用 → 不接「狂暴模式」牌（若场景里残留同名节点，下面一并隐藏）
            ...(FEAT.abilities ? [{ kind: 'berserk' as const, name: 'ad_berserk' }] : []),
        ];
        const stale = this.node.getChildByName('ad_berserk');
        if (stale && stale.isValid) { stale.active = FEAT.abilities; }
        this.items = [];
        for (const s of specs) {
            const plate = this.node.getChildByName(s.name);
            if (!plate) { continue; }
            this.items.push(this.makeItem(s.kind, plate));
        }
        return this.items.length > 0;
    }

    /** 运行时兜底搭建（换皮后按钮 = 一张整图 + 倒计时盖层） */
    private construct() {
        const specs: Array<{ kind: 'coin' | 'cap' | 'halo' | 'berserk'; y: number }> = [
            { kind: 'coin', y: 152 },
            { kind: 'cap', y: 24 },
            { kind: 'halo', y: -104 },
            // ★ 第八十三轮：特殊技能停用 → 第四块「狂暴模式」不摆
            ...(FEAT.abilities ? [{ kind: 'berserk' as const, y: -232 }] : []),
        ];
        for (const s of specs) {
            this.items.push(this.newPlate(s.kind, s.y));
        }
    }

    /** 新建一枚整图广告牌 + 倒计时盖层 */
    private newPlate(kind: 'coin' | 'cap' | 'halo' | 'berserk', y: number) {
        const plate = nd(this.node, 'ad_' + kind, 136, 116, AdButtons.X, y);
        const sp = plate.addComponent(Sprite);
        setFrame(sp, AdButtons.skinOf(kind), 136, 116);
        return this.makeItem(kind, plate);
    }

    /** 整图 UI 的贴图 key（bd07-10） */
    private static skinOf(kind: 'coin' | 'cap' | 'halo' | 'berserk'): string {
        return kind === 'coin' ? 'skin/main/ab_double_coin'
            : kind === 'cap' ? 'skin/main/ab_double_cap'
                : kind === 'halo' ? 'skin/main/ab_cursor_big'
                    : 'skin/main/ab_berserk';
    }

    /**
     * 统一收尾：计时增益（coin/cap/halo）→ 剩余时间小字放**按钮下方**，不置灰（★ 第114轮）；
     * 狂暴（berserk）→ 保留「次数>0 时同图压暗显示 ×N」的旧表现。
     */
    private makeItem(kind: 'coin' | 'cap' | 'halo' | 'berserk', plate: Node) {
        // ★ 第四十二轮：尺寸**以底图节点为准**（场景实体化后四块牌已是原图尺寸
        //   104×100 / 105×100 / 104×112 / 105×106，此前写死 136×116 → 盖层大一圈还变形）
        const put = plate.getComponent('cc.UITransform') as any;
        const w = put ? put.width : 136, h = put ? put.height : 116;
        if (kind === 'berserk') {
            // 盖层 = 同一张整图压暗（遮罩形状 = 图片轮廓，透明区不遮挡）
            let dim = plate.getChildByName('dim');
            if (!dim) {
                dim = nd(plate, 'dim', w, h, 0, 0);
                dim.active = false;
            } else {
                (dim.getComponent('cc.UITransform') as any).setContentSize(w, h);
            }
            let dsp = dim.getComponent(Sprite);
            if (!dsp) { dsp = dim.addComponent(Sprite); }
            setFrame(dsp, AdButtons.skinOf(kind), w, h);
            // 必须整体赋值：就地改 sp.color 的内部值引用不变 → setter 提前 return，静默不变色
            dsp.color = new Color(46, 46, 46, 208);
            const timeLb = label(dim, '', 0, 0, 126, 40, {
                size: 30, color: '#FFE9A8', outline: '#1B0E04', outlineWidth: 3,
            });
            return { kind, plate, dim, timeLb };
        }
        // 计时增益：不置灰（旧版压暗盖层直接销毁），只在按钮下方挂一行剩余时间小字
        const stale = plate.getChildByName('dim');
        if (stale && stale.isValid) { stale.destroy(); }
        let timeLb = plate.getChildByName('timeSub')?.getComponent(Label) || null;
        if (!timeLb) {
            timeLb = label(plate, '', 0, -h / 2 - 14, 132, 26, {
                size: 22, color: '#1B0E04',
            });
            timeLb.node.name = 'timeSub';
            timeLb.node.active = false;
        }
        return { kind, plate, dim: null as Node | null, timeLb };
    }

    /** 狂暴模式：看广告直接补满狂暴次数（与连击攒满同一数值来源） */
    private watchBerserk() {
        if (!FEAT.abilities) { return; }     // ★ 第八十三轮：特殊技能停用
        if (G.berserkFlips > 0) {
            Toast.I?.show(t('ad_grant_berserk', G.lang) + ' ×' + G.berserkFlips, '#FFE9A8');
            return;
        }
        Ads.I.show('buff_berserk', () => {
            // 狂暴次数是会话内字段（不存档），与连击攒满同一数值来源
            G.berserkFlips = G.berserkFlipsMax;
            G.notify();
            Toast.I?.show(t('ad_grant_berserk', G.lang), '#FFE9A8');
        });
    }

    update() {
        for (const it of this.items) {
            // 光圈变大按钮：★ 第四十八轮起光圈开局常显（「解锁光圈」已移除）→ 按钮也常显
            if (it.kind === 'halo' && !it.plate.active) { it.plate.active = true; }
            if (it.kind === 'berserk') {
                // 狂暴：不是计时增益，保留「次数>0 压暗显示 ×N」的旧表现
                const on = G.berserkFlips > 0;
                if (it.dim && it.dim.isValid && it.dim.active !== on) { it.dim.active = on; }
                if (on && it.timeLb && it.timeLb.isValid && it.timeLb.string !== '×' + G.berserkFlips) {
                    it.timeLb.string = '×' + G.berserkFlips;
                }
                continue;
            }
            // 计时增益：按钮永远可点，剩余时间显示在按钮下方（m:ss），无增益时隐藏
            const left = G.adBuffLeft(it.kind);
            const on = left > 0;
            let txt = '';
            if (on) {
                const m = Math.floor(left / 60);
                const s = Math.ceil(left - m * 60);
                txt = s >= 60 ? (m + 1) + ':00' : m + ':' + (s < 10 ? '0' : '') + s;
            }
            if (it.timeLb && it.timeLb.isValid) {
                if (it.timeLb.node.active !== on) { it.timeLb.node.active = on; }
                if (on && it.timeLb.string !== txt) { it.timeLb.string = txt; }
            }
        }
    }
}

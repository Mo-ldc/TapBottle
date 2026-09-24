import { _decorator, Component, Color, Graphics, Label, Node } from 'cc';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { hex } from '../Core/Util';
import { img, label, nd, rect } from './UIKit';
import { WOOD, woodPlate } from './Theme';
import { Ads, AdBuffKind } from './Ads';

const { ccclass } = _decorator;

/**
 * 右下角「广告视频」角标 —— 激励视频入口的统一标识。
 * 没有现成播放图标贴图，用 Graphics 画：深巧克力圆角小牌（WOOD.plate）+
 * 奶油描边（WOOD.goldHi）+ 白色播放三角 + 浅色「广告」字，配色跟随木纹皮肤。
 * ⚠️ 一个节点只能挂一个渲染组件：牌底 / 播放三角 / 文字各占一个节点。
 */
function videoTag(plate: Node) {
    const W = 62, H = 26;
    // 贴右下角（板 136×116，右沿 x=68 / 底沿 y=-58，留 4px 边距）
    const tag = nd(plate, 'adTag', W, H, 68 - W / 2 - 4, -58 + H / 2 + 4);
    const g = tag.addComponent(Graphics);
    g.fillColor = hex(WOOD.plate);
    g.roundRect(-W / 2, -H / 2, W, H, 9);
    g.fill();
    g.lineWidth = 2.5;
    g.strokeColor = hex(WOOD.goldHi);
    g.roundRect(-W / 2, -H / 2, W, H, 9);
    g.stroke();

    // 白色播放三角（激励视频符号）
    const tri = nd(tag, 'tri', 14, 16, -17, 0);
    const tg = tri.addComponent(Graphics);
    tg.fillColor = Color.WHITE;
    tg.moveTo(-5, -6);
    tg.lineTo(-5, 6);
    tg.lineTo(5, 0);
    tg.close();
    tg.fill();

    label(tag, t('ad_tag', G.lang), 8, 1, 36, 22, { size: 15, color: WOOD.textOn });
}

/**
 * 屏幕中部靠左的三枚广告增益按钮（用户口径 · 广告商业化）：
 *   ① 金币翻倍 —— 3 分钟内每次结算在原有基础上再结算一倍
 *   ② 瓶盖翻倍 —— 3 分钟内瓶盖产出 ×2
 *   ③ 光圈变大 —— 3 分钟内光标吸附光圈 ×2（解锁光圈后按钮才出现）
 *
 * 规则：
 *   · 三条增益都是 3 分钟，生效期间**不可再获得**，按钮显示秒数倒计时；
 *   · 到期时间是绝对时间戳（存档 data.adBuffs）→ 离线 / 关游戏期间也在正常倒计时；
 *   · 按钮自带触摸区，浮在木桌左缘（瓶子活动区 x∈[-150,150] 之外，不挡点击）。
 */
@ccclass('AdButtons')
export class AdButtons extends Component {
    /** 设计区左缘：720/2=360，按钮宽 136 → 中线 -288，右沿 -220，不进瓶子活动区 */
    private static readonly X = -288;

    private items: Array<{
        kind: AdBuffKind;
        plate: Node;
        dim: Node;
        timeLb: Label;
    }> = [];

    /**
     * ★ 场景实体化优先：adRoot 下已摆好三块广告增益牌（ad_coin/ad_cap/ad_halo）
     *   → 只绑引用+接事件；否则运行时现建（与场景树逐节点同构）。
     */
    build() {
        if (!this.bindScene()) { this.construct(); }
        for (const it of this.items) {
            it.plate.on(Node.EventType.TOUCH_END, () => { Ads.I.watchBuff(it.kind); });
        }
    }

    /** 场景里已摆好广告牌（有 ad_coin）→ 补齐引用，返回 true */
    private bindScene(): boolean {
        const first = this.node.getChildByName('ad_coin');
        if (!first) { return false; }
        const specs: Array<{ kind: AdBuffKind; name: string }> = [
            { kind: 'coin', name: 'ad_coin' },
            { kind: 'cap', name: 'ad_cap' },
            { kind: 'halo', name: 'ad_halo' },
        ];
        this.items = [];
        for (const s of specs) {
            const plate = this.node.getChildByName(s.name);
            if (!plate) { continue; }
            const dim = plate.getChildByName('dim');
            this.items.push({
                kind: s.kind, plate, dim,
                timeLb: dim?.getChildByName('label')?.getComponent(Label) || null!,
            });
        }
        return this.items.length > 0;
    }

    /** 运行时兜底搭建（与 Game.scene 里 adRoot 的节点树逐节点同构） */
    private construct() {
        const specs: Array<{ kind: AdBuffKind; icon: string; y: number }> = [
            { kind: 'coin', icon: 'ui/coin', y: 152 },
            { kind: 'cap', icon: 'bottle/capchip_6', y: 24 },
            { kind: 'halo', icon: 'env/cursor', y: -104 },
        ];
        for (const s of specs) {
            const plate = woodPlate(this.node, {
                w: 136, h: 116, x: AdButtons.X, y: s.y,
                fill: WOOD.gold, radius: 22, inner: WOOD.goldHi, name: 'ad_' + s.kind,
            });
            img(plate, s.icon, 50, 50, 0, 26);
            label(plate, t('ad_' + s.kind, G.lang), 0, -8, 120, 28, { size: 21, color: WOOD.text });
            videoTag(plate);
            // 生效中的倒计时盖层：整块压暗 + 大号秒数
            const dim = rect(plate, 136, 116, 0, 0, '#2A1608CC', 'dim');
            const timeLb = label(dim, '', 0, 0, 126, 40, {
                size: 30, color: '#FFE9A8', outline: '#1B0E04', outlineWidth: 3,
            });
            void timeLb;
            dim.active = false;
            this.items.push({ kind: s.kind, plate, dim, timeLb });
        }
    }

    update() {
        for (const it of this.items) {
            // 光圈变大按钮：解锁光圈（玩家科技 p_cursor）后才出现
            if (it.kind === 'halo') {
                const vis = G.hasCursor;
                if (it.plate.active !== vis) { it.plate.active = vis; }
            }
            const left = G.adBuffLeft(it.kind);
            const on = left > 0;
            if (it.dim.active !== on) { it.dim.active = on; }
            if (on) {
                const txt = Math.ceil(left) + 's';
                if (it.timeLb.string !== txt) { it.timeLb.string = txt; }
            }
        }
    }
}

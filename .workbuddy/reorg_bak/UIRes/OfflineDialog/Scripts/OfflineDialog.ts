import { _decorator, Label, Node } from 'cc';
import { OFFLINE_AD_MULT } from '../../../../Scripts/Core/GameConfig';
import { G } from '../../../../Scripts/Core/State';
import { t } from '../../../../Scripts/Core/Locale';
import { fmt } from '../../../../Scripts/Core/Util';
import { UIBase } from '../../../../Scripts/UI/UIBase';
import { Ads } from '../../../../Scripts/UI/Ads';
import { Toast } from '../../../../Scripts/UI/Toast';

const { ccclass, property } = _decorator;

/** showDialog 传进来的参数 */
export interface OfflineArg {
    money: number;
    caps: number;
    seconds: number;
}

/**
 * 离线收益弹窗 —— 结构在 prefab 里，这里只做数值填充与「看广告 ×3」。
 *
 * 与旧实现（`Hud.showOffline`）的差别：
 *   · 以前是整个 modal 用 rect/label/button 现搭；现在是 prefab，`init(arg)` 填值；
 *   · 模态登记交给 UIBase.show()/finishHide() 统一管理，不再靠
 *     `NODE_DESTROYED` 监听补 pop（那条老路只要有一条销毁路径没走到，
 *     Modal.count 就永久残留 → 整局点不动瓶子）。
 */
@ccclass('OfflineDialog')
export class OfflineDialog extends UIBase {
    @property({ type: Label, tooltip: '收益行，形如 "$ 1.2K   +   30 瓶盖"' })
    earnLb: Label = null!;

    @property({ type: Label, tooltip: '离线时长，形如 "离线 42 分钟"' })
    timeLb: Label = null!;

    @property({ type: Node, tooltip: '“×3 看广告”按钮' })
    adBtn: Node = null!;

    @property({ type: Node, tooltip: '“确定”按钮（看完广告后居中）' })
    okBtn: Node = null!;

    private money = 0;
    private caps = 0;
    private seconds = 0;
    private tripled = false;

    init(arg?: unknown): void {
        const a = (arg || {}) as Partial<OfflineArg>;
        this.money = a.money || 0;
        this.caps = a.caps || 0;
        this.seconds = a.seconds || 0;
        this.tripled = false;
        this.render();
        if (this.adBtn) {
            this.adBtn.active = true;
            this.adBtn.setPosition(116, -152, 0);
        }
        if (this.okBtn) { this.okBtn.setPosition(-116, -152, 0); }
    }

    /** 看广告 → 收益 ×3（把差额 2× 补给玩家），按钮让位给确定 */
    onAdX3(): void {
        if (this.tripled) { return; }
        this.tripled = true;
        const extraM = this.money * (OFFLINE_AD_MULT - 1);
        const extraC = this.caps * (OFFLINE_AD_MULT - 1);
        G.data.money += extraM;
        G.data.caps += extraC;
        G.data.stats.earned += extraM;
        G.data.stats.capsEarned += extraC;
        G.save();
        G.notify();
        this.render();
        if (this.adBtn) { this.adBtn.active = false; }
        if (this.okBtn) { this.okBtn.setPosition(0, -152, 0); }
        Toast.I?.show(t('ad_x3_done', G.lang), '#FFE9A8');
    }

    /** prefab 里 “×3 看广告” 按钮的 TouchEnd 挂它 */
    onClickAd(): void {
        Ads.I.show('offline_x3', () => this.onAdX3());
    }

    private render(): void {
        const m = this.money * (this.tripled ? OFFLINE_AD_MULT : 1);
        const c = this.caps * (this.tripled ? OFFLINE_AD_MULT : 1);
        if (this.earnLb && this.earnLb.isValid) {
            this.earnLb.string = '$ ' + fmt(m) + '   +   ' + fmt(c) + (G.lang === 'zh' ? ' 瓶盖' : ' caps');
        }
        if (this.timeLb && this.timeLb.isValid) {
            this.timeLb.string = (G.lang === 'zh' ? '离线 ' : 'Away ')
                + Math.floor(this.seconds / 60) + (G.lang === 'zh' ? ' 分钟' : ' min');
        }
    }
}

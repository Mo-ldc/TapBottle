import { Node, tween, UIOpacity } from 'cc';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { fmt } from '../Core/Util';
import { button, img, label, MASK_SIZE, nd, popIn, popOut, rect } from './UIKit';
import { WOOD, woodPlate } from './Theme';
import { Modal } from './Modal';
import { Toast } from './Toast';

/** 广告位 */
export type AdPlacement = 'buff_coin' | 'buff_cap' | 'buff_halo' | 'money_gap' | 'caps_gap' | 'offline_x3';
export type AdBuffKind = 'coin' | 'cap' | 'halo';

/**
 * 广告 SDK 适配器 —— 所有广告都必须经过 Ads.I（单例）。
 * 接入真实 SDK 时实现本接口并 `Ads.setProvider(...)`：
 *   · CrazyGames：`window.CrazyGames.SDK.ad.requestRewardedBanner(...)`
 *   · 抖音小游戏：`tt.createRewardedVideoAd({ adUnitId })` → onLoad / onClose(isEnded)
 *   · 微信小游戏：`wx.createRewardedVideoAd({ adUnitId })` 同上
 * 业务层永远只调 Ads.I，不直接 touch 任何平台 API。
 */
export interface AdProvider {
    /** 播放激励视频。onReward 只能在广告**完整看完**后调用一次；中途退出走 onFail。 */
    show(placement: AdPlacement, onReward: () => void, onFail: (reason: string) => void): void;
}

/** Mock 实现：网页 / 开发环境，延时一拍直接发奖 */
class MockProvider implements AdProvider {
    show(_p: AdPlacement, onReward: () => void, _onFail: (r: string) => void) {
        setTimeout(onReward, 60);
    }
}

/**
 * Ads —— 广告统一入口（单例）。
 *
 * 目前承载四类广告：
 *   ① 左侧增益按钮：金币翻倍 / 瓶盖翻倍 / 光圈变大（3 分钟，离线也在倒计时）
 *   ② 金币不足 → 「看广告解锁」弹窗（不显示差额，看完直接补足并自动重试购买）
 *   ③ 离线收益 ×3
 *
 * 播放中全局防重入；onFail 统一 toast，调用方无需重复提示。
 */
export class Ads {
    private static _I: Ads | null = null;
    static get I(): Ads { if (!Ads._I) { Ads._I = new Ads(); } return Ads._I; }

    private provider: AdProvider = new MockProvider();
    /** 广告确认弹窗的挂载层（GameRoot 注入 toastLayer —— 盖在一切 UI 之上） */
    uiRoot: Node | null = null;
    /** 播放中防重入 */
    private busy = false;

    /** 注入平台 SDK 适配器（必须在进场景前调用） */
    static setProvider(p: AdProvider) { Ads.I.provider = p; }

    /** 播一条激励视频 */
    show(placement: AdPlacement, onReward: () => void, onFail?: (reason: string) => void) {
        if (this.busy) {
            if (onFail) { onFail('busy'); } else { Toast.I?.show(t('ad_fail', G.lang), '#FFB0A0'); }
            return;
        }
        this.busy = true;
        this.provider.show(placement,
            () => { this.busy = false; onReward(); },
            (reason) => {
                this.busy = false;
                Toast.I?.show(t('ad_fail', G.lang), '#FFB0A0');
                if (onFail) { onFail(reason); }
            });
    }

    /** 左侧广告按钮：看广告激活 3 分钟增益（生效期间再点只报剩余时间，不重复发奖） */
    watchBuff(kind: AdBuffKind) {
        const left = G.adBuffLeft(kind);
        if (left > 0) {
            Toast.I?.show(t('ad_active_toast', G.lang).replace('{n}', String(Math.ceil(left))), '#FFE9A8');
            return;
        }
        this.show(('buff_' + kind) as AdPlacement, () => {
            G.activateAdBuff(kind);
            Toast.I?.show(t('ad_grant_' + kind, G.lang), '#FFE9A8');
        });
    }

    /**
     * 金币不足 → 弹「看广告解锁」确认框。
     * ★ 用户口径：**不显示差额**，只说金币不足 + 看广告补足。
     * 看完广告补足到刚好够买，然后调 `retry` 让调用方把刚才失败的购买原样再走一遍。
     */
    offerMoney(need: number, retry?: () => void) {
        const gap = Math.max(0, Math.ceil(need - G.data.money));
        if (gap <= 0) { if (retry) { retry(); } return; }
        if (!this.uiRoot || !this.uiRoot.isValid) { return; }
        Modal.push();
        const root = nd(this.uiRoot, 'adOffer', MASK_SIZE.w, MASK_SIZE.h, 0, 0);
        // Modal.pop 交给节点销毁监听（与 Hud.showOffline 同一套路，防计数残留锁死输入）
        root.on(Node.EventType.NODE_DESTROYED, () => { Modal.pop(); });
        const op = root.addComponent(UIOpacity);
        op.opacity = 0;
        rect(root, MASK_SIZE.w, MASK_SIZE.h, 0, 0, '#000000AA', 'm');
        const card = woodPlate(root, {
            w: 600, h: 350, x: 0, y: 0, fill: WOOD.cream, radius: 30,
            inner: WOOD.creamDark, name: 'card',
        });
        label(card, t('ad_offer_title', G.lang), 0, 112, 550, 48, {
            size: 32, color: WOOD.text, outline: '#FFF3D6', outlineWidth: 3,
        });
        img(card, 'ui/coin', 84, 84, 0, 34);
        label(card, t('ad_offer_body', G.lang), 0, -44, 540, 44, {
            size: 27, color: '#8A5A20', outline: '#FFF3D6', outlineWidth: 2,
        });
        button(card, {
            w: 224, h: 82, x: -120, y: -124,
            tex: 'ui/card_white', inset: [30, 30, 30, 30], texColor: WOOD.gold,
            text: t('ad_watch_now', G.lang), fontSize: 27, textColor: WOOD.text, sound: 'click',
            onClick: () => {
                this.closeCard(root, card);
                this.show('money_gap', () => {
                    G.data.money += gap;
                    G.data.stats.earned += gap;
                    G.save();
                    G.notify();
                    if (retry) { retry(); }
                });
            },
        });
        button(card, {
            w: 150, h: 82, x: 148, y: -124,
            tex: 'ui/card_white', inset: [30, 30, 30, 30], texColor: WOOD.grey,
            text: t('cancel', G.lang), fontSize: 26, textColor: WOOD.text, sound: 'click',
            onClick: () => { this.closeCard(root, card); },
        });
        tween(op).to(0.15, { opacity: 255 }).start();
        popIn(card);
    }

    /** 关弹窗：淡出 + Q 弹缩回（Modal.pop 由 NODE_DESTROYED 监听兜底） */
    private closeCard(root: Node, card: Node) {
        const op = root.getComponent(UIOpacity);
        if (op) { tween(op).to(0.16, { opacity: 0 }).start(); }
        popOut(card, 0.16, () => root.destroy());
    }
}

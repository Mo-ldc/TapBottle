import { _decorator, Label, Node, Vec3 } from 'cc';
import { OFFLINE_AD_MULT } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { fmt } from '../../Core/Util';
import { UIBase } from '../Base/UIBase';
import { Ads } from '../Base/Ads';
import { Toast } from '../Base/Toast';

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
 *
 * ★★ 第七十九轮起铁律（用户口径「以预制体为主」）：本脚本**只填文字、只切 active**，
 *   绝不对预制体里的节点写死 position / contentSize —— 所有位置与尺寸都在
 *   `OfflineDialog.prefab` 里调，编辑器所见即所得。
 */
@ccclass('OfflineDialog')
export class OfflineDialog extends UIBase {
    @property({ type: Label, tooltip: '金币行，形如 "金币：$ 1.2K"（图标左侧，文字左对齐）' })
    earnLb: Label = null!;

    @property({ type: Label, tooltip: '瓶盖行，形如 "瓶盖：30"' })
    capLb: Label = null!;

    @property({ type: Label, tooltip: '说明行，形如 "您已离线2小时40分钟，可获得"' })
    timeLb: Label = null!;

    @property({ type: Node, tooltip: '"三倍领取"按钮（橙，右，带视频角标）' })
    adBtn: Node = null!;

    @property({ type: Node, tooltip: '"基础领取"按钮（蓝，左；看完广告后居中）' })
    okBtn: Node = null!;

    private money = 0;
    private caps = 0;
    private seconds = 0;
    private tripled = false;
    /**
     * 预制体里两个领取键的**原始坐标**（init 时抓一次）。
     * ★ 第七十九轮（用户口径：以预制体为主）—— 代码不再往按钮上写死 (162,-278)/(-162,-278)，
     *   位置完全由 `OfflineDialog.prefab` 决定；只有「看完广告后基础领取键居中」这一个
     *   运行期状态需要挪节点，且挪的目标也从预制体原始坐标算出来（取两键水平中点 + 保留
     *   基础键的原始 y），这样用户在编辑器里把按钮挪到哪儿，居中逻辑都跟着走。
     */
    private okHome = new Vec3(-162, -278, 0);
    private adHome = new Vec3(162, -278, 0);

    init(arg?: unknown): void {
        const a = (arg || {}) as Partial<OfflineArg>;
        this.money = a.money || 0;
        this.caps = a.caps || 0;
        this.seconds = a.seconds || 0;
        this.tripled = false;
        // 抓预制体原始坐标（此时代码还没碰过它们）
        if (this.okBtn) { this.okHome.set(this.okBtn.position); }
        if (this.adBtn) { this.adHome.set(this.adBtn.position); }
        this.render();
        // ⚠️ 这里**不能**再 setPosition —— 会把编辑器里调好的位置顶掉（用户实测踩过）
        if (this.adBtn) { this.adBtn.active = true; }
        if (this.okBtn) { this.okBtn.setPosition(this.okHome); }
    }

    /** 看广告 → 收益 ×3（把差额 2× 补给玩家），按钮让位给基础领取 */
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
        // 居中 = 两键原始横坐标的中点（预制体里对称，算出来就是 0）；y 用基础键原始值
        if (this.okBtn) { this.okBtn.setPosition((this.okHome.x + this.adHome.x) / 2, this.okHome.y, 0); }
        Toast.I?.show(t('ad_x3_done', G.lang), '#FFE9A8');
    }

    /** prefab 里 “×3 看广告” 按钮的 TouchEnd 挂它 */
    onClickAd(): void {
        Ads.I.show('offline_x3', () => this.onAdX3());
    }

    /** 确定：离线收益在进弹窗前已入账，这里只负责关弹窗 */
    onOk(): void {
        this.close();
    }

    onLoad(): void {
        // ★ 修复「离线收益按钮点不了」：prefab 里没有 cc.Button/clickEvents，
        //   必须像 ConfirmDialog 一样在代码里绑 TOUCH_END（此前两个按钮是死节点，
        //   模态遮罩又挡住全屏 → 整局卡死）。
        if (this.adBtn) {
            this.adBtn.off(Node.EventType.TOUCH_END);
            this.adBtn.on(Node.EventType.TOUCH_END, this.onClickAd, this);
        }
        if (this.okBtn) {
            this.okBtn.off(Node.EventType.TOUCH_END);
            this.okBtn.on(Node.EventType.TOUCH_END, this.onOk, this);
        }
    }

    /* ---------------- 皮肤（第七十轮：按效果图弹窗界面.jpg 重烘，见 bake_dialogs_v2.py） ----------------
     * 面板 = popup/buco01（596×410）· 标题 = popup/buco03 木牌 + popup/wzi04「挂机奖励」美术字
     * 说明行 = timeLb（"您已离线X小时Y分钟，可获得"）· 金币行 = coin 图标 + earnLb（左对齐）
     * 瓶盖行 = capIc(capchip_6) + capLb · 关闭叉 = popup/buco02（节点名 close，UIBase 自动绑）
     * 基础领取 = popup/buco04 蓝胶囊（左）· 三倍领取 = popup/buco05 橙胶囊（右 + buco06 视频角标）
     * 按键文字白字描边3（蓝 #1B66B9 / 橙 #B8561B）
     * ------------------------------------------------------------------------------ */

    private render(): void {
        const zh = G.lang === 'zh';
        const mult = this.tripled ? OFFLINE_AD_MULT : 1;
        const m = this.money * mult;
        const c = this.caps * mult;
        const h = Math.floor(this.seconds / 3600);
        const min = Math.floor((this.seconds % 3600) / 60);
        if (this.timeLb && this.timeLb.isValid) {
            this.timeLb.string = zh
                ? (h > 0 ? '您已离线' + h + '小时' + min + '分钟，可获得' : '您已离线' + min + '分钟，可获得')
                : (h > 0 ? 'Away for ' + h + 'h ' + min + 'm — you earned' : 'Away for ' + min + 'm — you earned');
        }
        if (this.earnLb && this.earnLb.isValid) {
            this.earnLb.string = (zh ? '金币：$ ' : 'Coins: $') + fmt(m);
        }
        if (this.capLb && this.capLb.isValid) {
            this.capLb.string = (zh ? '瓶盖：' : 'Caps: ') + fmt(c);
        }
    }
}

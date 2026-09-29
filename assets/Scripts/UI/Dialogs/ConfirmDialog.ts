import { _decorator, Label, Node, Sprite } from 'cc';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { UIBase } from '../Base/UIBase';

const { ccclass, property } = _decorator;

/** showDialog 传进来的参数 */
export interface ConfirmArg {
    /** 说明文字（prefab 里 fs30 #867A3F 那行） */
    text?: string;
    /** 强调句（fs44 #E65F39 橙色行，可不传） */
    question?: string;
    /** 危险操作（保留参数兼容旧调用；换皮后确认键恒为蓝色胶囊） */
    danger?: boolean;
    onOk?: () => void;
    onCancel?: () => void;
}

/**
 * 通用二次确认弹窗（删存档风险提示等）。
 *
 * ★ 皮肤已**烘焙进预制体本体**（第六十六~七十轮，见 `.workbuddy/tools/bake_dialogs_v2.py`）：
 *   编辑器打开 ConfirmDialog.prefab 就是成品皮，运行时不再做任何换皮。
 *     面板 = popup/buco01（596×410）
 *     标题 = popup/buco03 空白木牌 + popup/wezi01「温馨提示」美术字
 *     正文 = text（fs30 #867A3F）+ question（fs44 #E65F39 强调句，第七十轮对齐效果图）
 *     关闭叉 = popup/buco02（节点名 close）
 *     确认键 = popup/buco04 蓝胶囊 · **左**；取消键 = popup/buco05 橙胶囊 · **右**
 *              （第七十轮对调，对齐效果图：确认在左、取消在右；白字描边3）
 *
 * 本脚本只负责：填文案、挂确认/取消回调（关闭叉由 UIBase.bindCloseBtn 自动接手）。
 */
@ccclass('ConfirmDialog')
export class ConfirmDialog extends UIBase {
    @property({ type: Label, tooltip: '正文（说明行）' })
    textLb: Label = null!;

    @property({ type: Label, tooltip: '强调句（橙色大字，可不填）' })
    questionLb: Label = null!;

    @property({ type: Label, tooltip: '确认键文字' })
    okLb: Label = null!;

    @property({ type: Label, tooltip: '取消键文字' })
    cancelLb: Label = null!;

    @property({ type: Sprite, tooltip: '确认键底板（换皮后不再染色，保留引用与 prefab 序列化对齐）' })
    okPlate: Sprite | null = null;

    @property({ type: Node, tooltip: '确认按钮节点（蓝，左）' })
    okBtn: Node = null!;

    @property({ type: Node, tooltip: '取消按钮节点（橙，右）' })
    cancelBtn: Node = null!;

    private onOk: (() => void) | null = null;
    private onCancel: (() => void) | null = null;

    init(arg?: unknown): void {
        const a = (arg || {}) as ConfirmArg;
        this.onOk = a.onOk || null;
        this.onCancel = a.onCancel || null;
        if (this.textLb && this.textLb.isValid) { this.textLb.string = a.text || ''; }
        if (this.questionLb && this.questionLb.isValid) { this.questionLb.string = a.question || ''; }
        if (this.okLb && this.okLb.isValid) { this.okLb.string = t('confirm', G.lang); }
        if (this.cancelLb && this.cancelLb.isValid) { this.cancelLb.string = t('cancel', G.lang); }
    }

    onConfirm(): void {
        const fn = this.onOk;
        this.onOk = null;
        if (fn) { fn(); }
        this.close();
    }

    onDeny(): void {
        const fn = this.onCancel;
        this.onCancel = null;
        if (fn) { fn(); }
        this.close();
    }

    onLoad(): void {
        // prefab 里不序列化节点事件 → 双键的 TOUCH_END 只能运行时接（关闭叉走 UIBase.bindCloseBtn）
        if (this.okBtn) {
            this.okBtn.off(Node.EventType.TOUCH_END);
            this.okBtn.on(Node.EventType.TOUCH_END, this.onConfirm, this);
        }
        if (this.cancelBtn) {
            this.cancelBtn.off(Node.EventType.TOUCH_END);
            this.cancelBtn.on(Node.EventType.TOUCH_END, this.onDeny, this);
        }
    }
}

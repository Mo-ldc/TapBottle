import { _decorator, Label, Node, Sprite } from 'cc';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { UIBase } from '../Base/UIBase';
import { tint } from '../Base/UIKit';

const { ccclass, property } = _decorator;

/** showDialog 传进来的参数 */
export interface ConfirmArg {
    text?: string;
    /** 确认键是否用砖红（危险操作） */
    danger?: boolean;
    onOk?: () => void;
    onCancel?: () => void;
}

/**
 * 通用二次确认弹窗（删存档、大额消费等）。
 *
 * 旧实现是 `SettingsPanel.confirmNewGame()` 里用 rect + roundedPanel + woodButton
 * 就地搭一个；现在是一个标准预制体，任何地方都能复用。
 */
@ccclass('ConfirmDialog')
export class ConfirmDialog extends UIBase {
    @property({ type: Label, tooltip: '正文' })
    textLb: Label = null!;

    @property({ type: Label, tooltip: '确认键文字' })
    okLb: Label = null!;

    @property({ type: Label, tooltip: '取消键文字' })
    cancelLb: Label = null!;

    @property({ type: Sprite, tooltip: '确认键底板（危险操作时染砖红）' })
    okPlate: Sprite | null = null;

    @property({ type: Node, tooltip: '确认按钮节点' })
    okBtn: Node = null!;

    @property({ type: Node, tooltip: '取消按钮节点' })
    cancelBtn: Node = null!;

    @property({ tooltip: '确认键常态底色（奶油）' })
    okNormal = '#F6E3C5';

    @property({ tooltip: '确认键危险态底色（砖红）' })
    okDanger = '#C05B3C';

    private onOk: (() => void) | null = null;
    private onCancel: (() => void) | null = null;

    init(arg?: unknown): void {
        const a = (arg || {}) as ConfirmArg;
        this.onOk = a.onOk || null;
        this.onCancel = a.onCancel || null;
        if (this.textLb && this.textLb.isValid) { this.textLb.string = a.text || ''; }
        if (this.okLb && this.okLb.isValid) { this.okLb.string = t('confirm', G.lang); }
        if (this.cancelLb && this.cancelLb.isValid) { this.cancelLb.string = t('cancel', G.lang); }
        // 九宫格白底贴图乘色：纯血红压不下去，砖红更贴合木纹皮肤
        if (this.okPlate && this.okPlate.isValid) {
            tint(this.okPlate, a.danger ? this.okDanger : this.okNormal);
        }
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

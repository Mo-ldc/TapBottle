import { _decorator, Component, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { Modal } from './Modal';
import { maskIn, maskOut, popIn, popOut } from './UIKit';

const { ccclass, property } = _decorator;

/** UI 入场 / 出场动画类别 */
export enum UIAni {
    /** 无动画 */
    None = 0,
    /** 中央 Q 弹（0.72 → 1.07 → 1），本工程的默认开场 */
    Pop = 1,
    /** 只做透明度渐变，不缩放 */
    Fade = 2,
}

/**
 * 所有预制体界面的基类。
 *
 * 设计对齐参考工程 `assets/Scripts/UI/UIBase.ts` 的语义（show / hide / init / close），
 * 但按 Cocos 3.x 重写：
 *  · 结构不再运行时构建，节点与 @property 绑定全部落在 prefab 里；
 *  · 出入场动画沿用本工程的「中央 Q 弹」（UIKit.popIn / popOut）；
 *  · 开关时期自动登记 / 释放 `Modal`，避免推瓶子穿透（见 Modal 注释）。
 *
 * ⚠️ 每个具体界面一个 `@ccclass`，挂在 prefab **根节点**上；UIMgr 通过
 *    `node.getComponent(UIBase)` 拿到它，所以继承链里不能有两个 Component。
 */
@ccclass('UIBase')
export class UIBase extends Component {
    @property({ type: Node, tooltip: '动画作用节点（通常是内容面板）' })
    animRoot: Node = null!;

    @property({ type: Node, tooltip: '遮罩节点：淡入淡出用，可配点击关闭' })
    maskNode: Node = null!;

    @property({ tooltip: '打开期间是否登记模态（true 时游戏内点击被屏蔽）' })
    modal = true;

    @property({ tooltip: '点击遮罩是否关闭界面' })
    closeOnMask = true;

    @property({ tooltip: '入场动画' })
    aniIn: UIAni = UIAni.Pop;

    @property({ tooltip: '出场动画' })
    aniOut: UIAni = UIAni.Pop;

    private _shown = false;
    /** 是否已登记模态（防止重复 push / pop 让计数失衡） */
    private _modaled = false;
    /** 界面名字 —— 用预制体根节点名，UIMgr 靠它隐藏/查重 */
    get uiName(): string { return this.node.name; }

    protected onDestroy(): void { this.releaseModal(); }

    /* ---------------- 生命周期钩子 ---------------- */

    /** 每次 show 都会先调（可能被复用），用于按最新数据刷新界面 */
    init(_arg?: unknown): void { /* 子类实现 */ }

    /** 界面完全关闭后（节点已下树） */
    onClosed(): void { /* 子类实现 */ }

    /* ---------------- 显示 / 隐藏 ---------------- */

    /** 显示界面。`arg` 会原样传给 init()，`cb` 在入场动画结束后回调。 */
    show(cb?: () => void, arg?: unknown): void {
        this.init(arg);
        this._shown = true;
        if (this.modal) { this.takeModal(); }
        this.bindMaskClick(true);
        this.node.active = true;
        this.playIn(this.target, cb);
    }

    /** 关闭界面（带退场动画），动画结束后下树并回调。 */
    hide(cb?: () => void): void {
        this.bindMaskClick(false);
        if (!this._shown) { this.finishHide(cb); return; }
        this._shown = false;
        this.playOut(this.target, () => this.finishHide(cb));
    }

    /** 子类里按钮直接挂它：等价于「点了确定/关闭」 */
    close(): void { this.hide(); }

    /** 点遮罩关闭（供 prefab 里 Button 的 ClickEvents 挂，或代码调用） */
    onClickMask(): void {
        if (!this.closeOnMask) { return; }
        this.close();
    }

    /* ---------------- 内部实现 ---------------- */

    private get target(): Node {
        const n = this.animRoot || this.node;
        return n;
    }

    private takeModal(): void {
        if (this._modaled) { return; }
        this._modaled = true;
        Modal.push();
    }

    private releaseModal(): void {
        if (!this._modaled) { return; }
        this._modaled = false;
        Modal.pop();
    }

    private finishHide(cb?: () => void): void {
        this.releaseModal();
        this.onClosed();
        if (this.node && this.node.isValid) { this.node.removeFromParent(); }
        if (cb) { cb(); }
    }

    private bindMaskClick(on: boolean): void {
        const m = this.maskNode;
        if (!m || !m.isValid) { return; }
        m.off(Node.EventType.TOUCH_END, this.onClickMask, this);
        if (on && this.closeOnMask) { m.on(Node.EventType.TOUCH_END, this.onClickMask, this); }
    }

    /** 入场：遮罩淡入 + 内容 Q 弹 */
    private playIn(target: Node, cb?: () => void): void {
        if (this.maskNode && this.maskNode.isValid) { maskIn(this.maskNode); }
        switch (this.aniIn) {
            case UIAni.Fade:
                this.fade(target, 0, 255, 0.18, cb);
                break;
            case UIAni.None:
                target.setScale(1, 1, 1);
                if (cb) { cb(); }
                break;
            default:
                popIn(target);
                if (cb) { this.delayBack(cb); }
                break;
        }
    }

    /** 出场：内容缩回 + 遮罩淡出 */
    private playOut(target: Node, cb?: () => void): void {
        const done = () => {
            if (this.maskNode && this.maskNode.isValid) { maskOut(this.maskNode); }
            if (cb) { cb(); }
        };
        switch (this.aniOut) {
            case UIAni.Fade:
                this.fade(target, 255, 0, 0.14, done);
                break;
            case UIAni.None:
                done();
                break;
            default: {
                const op = target.getComponent(UIOpacity) || target.addComponent(UIOpacity);
                Tween.stopAllByTarget(op);
                popOut(target, 0.16, () => { op.opacity = 255; done(); });
                if (this.maskNode && this.maskNode.isValid) { maskOut(this.maskNode); }
                break;
            }
        }
    }

    private fade(target: Node, from: number, to: number, dur: number, cb?: () => void): void {
        const op = target.getComponent(UIOpacity) || target.addComponent(UIOpacity);
        Tween.stopAllByTarget(op);
        op.opacity = from;
        tween(op).to(dur, { opacity: to }).call(() => { if (cb) { cb(); } }).start();
    }

    /**
     * popIn 的回调桥（popIn 本身不支持完成回调）。
     * ⚠️ 时长必须与 UIKit.popIn 的默认 0.32s 对齐，否则 UIMgr 的「入场完成」回调
     *    会在动画播到一半时触发，上层紧接着做的形变/刷新会被 tween 覆盖。
     */
    private delayBack(cb: () => void): void {
        this.scheduleOnce(cb, 0.32);
    }

    /** 供子类里做数字滚动等：每帧回调在 update 里实现即可 */
    protected update(_dt: number): void {
        void Vec3;
    }
}

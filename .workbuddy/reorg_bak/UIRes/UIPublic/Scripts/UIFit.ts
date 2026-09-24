import { _decorator, Component, Node, UITransform } from 'cc';
import { AUTHOR_H, AUTHOR_W } from '../../../../Scripts/Core/GameConfig';

const { ccclass, property } = _decorator;

/**
 * ⚠️ 已废弃（第二十五轮，2026-09-24）—— 不再被任何 prefab 引用，保留仅供回溯。
 *
 * 现在统一用「声明式适配」取代这里的运行时算尺寸：
 *   · 预制体**根节点** 挂 cc.Widget(alignFlags=45) 平铺画布（原来是本脚本
 *     `ut.setContentSize(父宽,父高)` 手写同步）；
 *   · **内容节点**（fit）挂 `Core/AutoNodeScale.ts` 等比缩放居中（原来是本脚本
 *     `fitNode.setScale(min(父宽/720, 父高/1280))`）。
 * 好处：编辑器里 Widget 肉眼可见、不再每帧轮询父尺寸、游戏层与 UI 层用同一个组件。
 *
 * 下面是原实现说明，留档：
 *
 * UIFit —— UI 预制体的「铺满场景适配」组件，挂在界面 prefab 的**根节点**上。
 * ...
 *
 * 适配口径（用户原则，参考 StartConvenienceStore4 的 AutoNodeScale 思路）：
 *  1. 根节点尺寸同步父节点（PageRoot / DialogRoot = 整个可见区）
 *     → 根下的遮罩（Widget 全对齐）自动**铺满整个场景**；
 *  2. `fitNode`（创作空间 720×1280 的内容容器）按
 *     `min(父宽/720, 父高/1280)` 等比缩放并居中 ——
 *     内容按原分辨率缩放、在画布正中显示，**任何屏幕比例下都不会被截断**。
 *
 * ⚠️ 不加 executeInEditMode：prefab 编辑模式下父节点不是页面层，
 *    执行会把根节点拉到编辑器视图尺寸，干扰编辑。运行时由 UIMgr 实例化后自然生效。
 *
 * ⚠️ popIn/popOut 的作用对象（UIBase.animRoot）必须是 fitNode **内部**的面板节点，
 *    不能指 fitNode 本身 —— 否则动画的 setScale 会覆盖这里的适配缩放。
 */
@ccclass('UIFit')
export class UIFit extends Component {
    @property({ type: Node, tooltip: '内容容器（创作空间 720×1280），等比缩放居中' })
    fitNode: Node = null!;

    private _pw = -1;
    private _ph = -1;

    protected onEnable(): void {
        this.node.on(Node.EventType.PARENT_CHANGED, this.relayout, this);
        this.relayout();
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.PARENT_CHANGED, this.relayout, this);
    }

    protected update(): void {
        // 父节点尺寸变化（旋屏 / 窗口缩放 / Widget 链重排）时跟着重排。
        // 用轮询而不是 SIZE_CHANGED：Widget 对齐改尺寸不保证发事件，轮询两个浮点比较开销可忽略。
        const put = this.parentUT();
        if (put && (Math.abs(put.width - this._pw) > 0.5 || Math.abs(put.height - this._ph) > 0.5)) {
            this.relayout();
        }
    }

    private parentUT(): UITransform | null {
        const p = this.node.parent;
        return p ? p.getComponent(UITransform) : null;
    }

    /** 根铺满父节点 + 内容容器等比缩放居中（幂等，可反复调） */
    relayout(): void {
        const put = this.parentUT();
        if (!put) { return; }
        this._pw = put.width;
        this._ph = put.height;
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(put.width, put.height);
        this.node.setPosition(0, 0, 0);
        if (this.fitNode && this.fitNode.isValid) {
            const s = Math.min(put.width / AUTHOR_W, put.height / AUTHOR_H);
            this.fitNode.setScale(s, s, 1);
            this.fitNode.setPosition(0, 0, 0);
        }
    }
}

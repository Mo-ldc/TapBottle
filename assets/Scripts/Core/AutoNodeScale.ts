import { _decorator, Component, Node, NodeEventType, UITransform } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * AutoNodeScale —— 本节点跟随目标节点（默认父节点）的**宽高等比缩放**（居中由锚点 0.5 保证）。
 *
 * 来源：参考工程 `StartConvenienceStore4/assets/Init/Scripts/Tool/AutoNodeScale.ts`。
 *
 * ★ 本工程统一适配方案（用户口径）——「Widget 负责平铺、AutoNodeScale 负责等比缩放」：
 *
 *   游戏场景
 *     Canvas
 *       └ GameRoot   ← cc.Widget(alignFlags=45) 平铺整个摄像机可见区
 *           ├ gameRoot  ← UT 720×1280（创作空间）+ **本组件**，等比缩放居中
 *           │    └ bgLayer / shakeHolder(worldLayer) / hudRoot / navRoot / …
 *           └ uiRoot    ← cc.Widget(45)，1:1 平铺（不缩放）
 *
 *   UI 预制体（resources/Prefabs/UI/<Name>.prefab）
 *     <Name>        ← cc.Widget(45) 跟随画布（PageRoot/DialogRoot/TipRoot）平铺
 *       ├ mask      ← cc.Widget(45) 跟随父节点铺满
 *       └ fit       ← UT 720×1280（美术给的默认分辨率）+ **本组件**，等比缩放居中
 *
 *   缩放系数两边完全一致：min(父宽/720, 父高/1280)，父节点铺满可见区时
 *   恒等于 GameRoot.ts 里原来的 `sA × DS`（设计 1440×2560 / 创作区 720×1280）。
 *   于是「背景拉伸铺满 + 内容整体等比缩小居中、任何屏幕比例都不截断」这条口径不改。
 *
 * ⚠️ 与参考工程原版唯一差异：`executeInEditMode` 关掉。
 *    prefab 编辑模式下父节点不是页面层（是编辑器视图），开着会把算出来的
 *    `_lscale` 写回 prefab 存档，且运行时首帧数值也不对。本工程取稳定性。
 *
 * ⚠️ 出入场动画（UIKit.popIn/popOut）的作用对象必须是**本组件所在节点的子节点**，
 *    不能是本节点自身 —— 否则 tween 的 setScale 会覆盖这里的适配缩放。
 */
@ccclass('AutoNodeScale')
@executeInEditMode(false)
export class AutoNodeScale extends Component {
    /** 是否自定义同步节点 */
    @property({ tooltip: '自定义同步节点，如果为true，则会根据 syncNode 节点的宽高进行缩放，否则会根据父节点的宽高进行缩放' })
    private isCustom: boolean = false;

    @property({
        type: UITransform,
        tooltip: '自定义同步节点，如果isCustom为true，则根据此UITransform节点宽高缩放；否则根据父节点宽高缩放',
        visible: function (this: AutoNodeScale) { return this.isCustom; },
    })
    private uiTr: UITransform = null!;

    private lastParentTr: UITransform = null!;
    private selfUiTr: UITransform = null!;

    protected onEnable(): void {
        this.selfUiTr = this.node.getComponent(UITransform);
        if (!this.selfUiTr) {
            console.warn('AutoNodeScale: 当前节点没有UITransform组件');
            return;
        }

        this.node.on(NodeEventType.PARENT_CHANGED, this.onParentChanged, this);
        this.node.on(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
        this.refreshTarget();
    }

    protected onDisable(): void {
        this.node.off(NodeEventType.PARENT_CHANGED, this.onParentChanged, this);
        this.node.off(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
        if (this.uiTr) {
            this.uiTr.node.off(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
        }
    }

    /** 父节点变更时重新绑定目标节点并适配缩放 */
    private onParentChanged(): void {
        this.refreshTarget();
    }

    /** 重新解析目标节点（非自定义模式跟随父节点）并更新缩放 */
    private refreshTarget(): void {
        if (!this.isCustom) {
            if (this.uiTr) {
                this.uiTr.node.off(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
                this.uiTr = null!;
            }

            const parent = this.node.parent;
            if (parent) this.uiTr = parent.getComponent(UITransform)!;
            else console.warn('AutoNodeScale: 父节点不存在');
        }

        if (this.uiTr) {
            this.uiTr.node.on(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
            this.updateScale();
        }
        void this.lastParentTr;
    }

    private onSizeChanged(): void {
        this.updateScale();
    }

    /** s = min(目标宽/自身宽, 目标高/自身高)，等比且不变形；锚点 0.5 使其天然居中 */
    private updateScale(): void {
        if (!this.uiTr || !this.selfUiTr) return;

        const targetWidth = this.uiTr.width;
        const targetHeight = this.uiTr.height;
        const selfWidth = this.selfUiTr.width;
        const selfHeight = this.selfUiTr.height;

        if (selfWidth === 0 || selfHeight === 0) return;

        const scale = Math.min(targetWidth / selfWidth, targetHeight / selfHeight);

        this.node.setScale(scale, scale, 1);
    }
}

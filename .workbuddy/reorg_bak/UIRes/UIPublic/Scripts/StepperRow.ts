import { _decorator, Component, Label, Node, Sprite, UITransform } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 音量步进器行（− / 进度条 / 百分比 / ＋）—— prefab 里的独立节点，不自己建 UI。
 *
 * 节点结构（全部可视化编辑）：
 *   StepperRow(挂本组件)
 *     ├─ title  Label  行标题
 *     ├─ dec    节点   减号按钮
 *     ├─ inc    节点   加号按钮
 *     ├─ track  节点   轨道底
 *     ├─ fill   Sprite 填充（锚点 (0,0.5)，靠 setContentSize 推进）
 *     └─ val    Label  百分比数字
 *
 * ⚠️ fill 的锚点必须是 (0, 0.5) 且挂在 x = −W/2 处：填充从左到右长，
 *    锚点在中心的话会两头同时伸。这个在 prefab 里一次性设好，代码只改宽度。
 */
@ccclass('StepperRow')
export class StepperRow extends Component {
    @property({ type: Label, tooltip: '行标题' })
    titleLb: Label = null!;

    @property({ type: Label, tooltip: '百分比数字' })
    valLb: Label = null!;

    @property({ type: Sprite, tooltip: '填充条（锚点 0,0.5）' })
    fill: Sprite = null!;

    @property({ type: Node, tooltip: '减号按钮' })
    decBtn: Node = null!;

    @property({ type: Node, tooltip: '加号按钮' })
    incBtn: Node = null!;

    @property({ tooltip: '每次步进 0.1，范围 [0,1]' })
    step = 0.1;

    private getFn: (() => number) | null = null;
    private setFn: ((v: number) => void) | null = null;
    private changeFn: (() => void) | null = null;
    /** 轨道满宽（contentSize 宽度），第一次刷新时从 fill 身上读回来 */
    private fullW = 0;

    bind(title: string, get: () => number, set: (v: number) => void, onChange?: () => void): void {
        if (this.titleLb && this.titleLb.isValid) { this.titleLb.string = title; }
        this.getFn = get;
        this.setFn = set;
        this.changeFn = onChange || null;
        this.refresh();
    }

    onStep(d: number): void {
        if (!this.getFn || !this.setFn) { return; }
        // 取整到 0.1：浮点累加会攒出 0.30000000000000004 这种脏值
        const v = Math.max(0, Math.min(1, Math.round((this.getFn() + d * this.step) * 100) / 100));
        this.setFn(v);
        this.refresh();
        if (this.changeFn) { this.changeFn(); }
    }

    refresh(): void {
        if (!this.getFn || !this.node || !this.node.isValid) { return; }
        const v = Math.max(0, Math.min(1, this.getFn()));
        if (this.valLb && this.valLb.isValid) {
            this.valLb.string = Math.round(v * 100) + '%';
        }
        if (this.fill && this.fill.isValid) {
            const node = this.fill.node;
            const ut = node.getComponent(UITransform);
            if (ut) {
                if (this.fullW <= 0) { this.fullW = ut.width; }
                ut.setContentSize(Math.max(4, this.fullW * v), ut.height);
            }
        }
    }

    onLoad(): void {
        if (this.decBtn) { this.decBtn.on(Node.EventType.TOUCH_END, () => this.onStep(-1), this); }
        if (this.incBtn) { this.incBtn.on(Node.EventType.TOUCH_END, () => this.onStep(1), this); }
    }

    onDestroy(): void {
        for (const b of [this.decBtn, this.incBtn]) {
            if (b && b.isValid) { b.targetOff(this); }
        }
    }
}

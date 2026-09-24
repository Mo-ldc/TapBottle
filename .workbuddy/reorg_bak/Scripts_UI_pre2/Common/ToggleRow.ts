import { _decorator, Color, Component, Label, Node, Sprite } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 开关行控件 —— prefab 里的一个**独立节点**，自己不建任何 UI。
 *
 * 节点结构（全部在 prefab 里可视化编辑，改尺寸配色不用碰代码）：
 *   ToggleRow(挂本组件)
 *     ├─ title   Label    行标题
 *     ├─ track   Sprite   轨道（九宫格）
 *     ├─ knob    Node     钮
 *     └─ hit     Node     命中区（比视觉大，手指才点得到）
 *
 * 取值 / 写值由具体界面用 `bind()` 注入 —— 这一层不关心是 settings 的哪个字段。
 *
 * ⚠️ 运行时改色必须**整体赋值** `new Color(...)`：Cocos 的 `Renderable2D.color`
 *    setter 第一步是 `if (this._color === value) return;`，就地改 Color 对象
 *    引用不变 → 渲染不刷新（见 UIKit.tint 的注释）。
 */
@ccclass('ToggleRow')
export class ToggleRow extends Component {
    @property({ type: Label, tooltip: '行标题' })
    titleLb: Label = null!;

    @property({ tooltip: '开关开启时钮的 x（相对行中心）' })
    knobOnX = 27;

    @property({ tooltip: '开关关闭时钮的 x' })
    knobOffX = -27;

    @property({ tooltip: '开启时轨道颜色' })
    onColor: Color = new Color(242, 195, 78, 255);

    @property({ tooltip: '关闭时轨道颜色' })
    offColor: Color = new Color(51, 36, 15, 255);

    private getFn: (() => boolean) | null = null;
    private setFn: ((v: boolean) => void) | null = null;
    private changeFn: (() => void) | null = null;

    /** 注入取值/写值逻辑。`onChange` 在切换后调用（通常用来立刻刷新整个界面） */
    bind(title: string, get: () => boolean, set: (v: boolean) => void, onChange?: () => void): void {
        if (this.titleLb && this.titleLb.isValid) { this.titleLb.string = title; }
        this.getFn = get;
        this.setFn = set;
        this.changeFn = onChange || null;
        this.refresh();
    }

    /** 点击命中区切换（也可由外部/按钮事件调用） */
    onToggle(): void {
        if (!this.getFn || !this.setFn) { return; }
        this.setFn(!this.getFn());
        this.refresh();
        if (this.changeFn) { this.changeFn(); }
    }

    refresh(): void {
        if (!this.getFn || !this.node || !this.node.isValid) { return; }
        const on = this.getFn();
        const knob = this.node.getChildByName('knob');
        if (knob) { knob.setPosition(on ? this.knobOnX : this.knobOffX, 0, 0); }
        const track = this.node.getChildByName('track');
        if (track) {
            const sp = track.getComponent(Sprite);
            // ⚠️ 必须整体 new 一个新 Color：就地改值 Cocos 的 color setter 会提前 return
            const c = on ? this.onColor : this.offColor;
            if (sp) { sp.color = new Color(c.r, c.g, c.b, c.a); }
        }
    }

    onLoad(): void {
        const hit = this.node.getChildByName('hit');
        if (hit) {
            hit.off(Node.EventType.TOUCH_END, this.onToggle, this);
            hit.on(Node.EventType.TOUCH_END, this.onToggle, this);
        }
    }

    onDestroy(): void {
        const hit = this.node && this.node.isValid ? this.node.getChildByName('hit') : null;
        if (hit) { hit.off(Node.EventType.TOUCH_END, this.onToggle, this); }
    }
}

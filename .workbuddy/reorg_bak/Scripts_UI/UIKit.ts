import { _decorator, Component, Color, Label, LabelOutline, Node, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec3, tween, BlockInputEvents, Widget, Layout, ScrollView, Mask, Graphics } from 'cc';
import { Res } from '../Core/Res';
import { hex } from '../Core/Util';

const { ccclass } = _decorator;

export const WHITE = new Color(255, 255, 255, 255);

/**
 * 给 Sprite / Label 上色。
 *
 * ⚠️ 绝对不要写 `Color.fromHEX(sp.color, '#RRGGBB')` —— Cocos 的 `Renderable2D.color`
 * setter 第一步是 `if (this._color === value) return;`。`sp.color` 取到的就是内部
 * `_color` 本体，就地改写后引用没变 → setter 提前 return → `_updateColor()` 从不被调用
 * → 顶点色数组还是旧值，**渲染出来完全是原贴图色，染色静默失效**（读取 `sp.color`
 * 却是新值，所以极难发现）。必须整体赋值一个新 Color 才会真正刷新。
 */
export function tint(r: Sprite | Label, hexStr: string): void {
    const c = hex(hexStr);
    const cur = r.color;
    if (cur.r === c.r && cur.g === c.g && cur.b === c.b && cur.a === c.a) { return; }
    r.color = c;
}

/** 创建带 UITransform 的节点 */
export function nd(parent: Node | null, name: string, w: number, h: number, x = 0, y = 0, anchorX = 0.5, anchorY = 0.5): Node {
    const n = new Node(name);
    const ut = n.addComponent(UITransform);
    ut.setContentSize(w, h);
    ut.setAnchorPoint(anchorX, anchorY);
    n.setPosition(x, y, 0);
    if (parent) { parent.addChild(n); }
    return n;
}

export function sizeOf(n: Node): UITransform { return n.getComponent(UITransform)!; }

export function setSize(n: Node, w: number, h: number) {
    const ut = n.getComponent(UITransform);
    if (ut) { ut.setContentSize(w, h); }
}

export function setAnchor(n: Node, ax: number, ay: number) {
    const ut = n.getComponent(UITransform);
    if (ut) { ut.setAnchorPoint(ax, ay); }
}

/**
 * 关键：Sprite 默认 sizeMode=TRIM，赋 spriteFrame 会把节点尺寸改成原图尺寸。
 * 因此必须先设 CUSTOM、再赋 frame、最后兜底 setContentSize。
 */
export function setFrame(sp: Sprite, path: string, w?: number, h?: number, color?: Color | string): Sprite {
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.trim = false;
    const sf = Res.I ? Res.I.sf(path) : null;
    if (sf) { sp.spriteFrame = sf; }
    if (w !== undefined && h !== undefined) {
        const ut = sp.node.getComponent(UITransform);
        if (ut) { ut.setContentSize(w, h); }
    }
    if (color) { sp.color = typeof color === 'string' ? hex(color) : color; }
    return sp;
}

/** 纯色矩形（用 4x4 白点拉伸） */
export function rect(parent: Node, w: number, h: number, x: number, y: number, color: Color | string, name = 'rect'): Node {
    const n = nd(parent, name, w, h, x, y);
    const sp = n.addComponent(Sprite);
    setFrame(sp, 'ui/px_white2');
    sp.type = Sprite.Type.SIMPLE;
    setSize(n, w, h);
    sp.color = typeof color === 'string' ? hex(color) : color;
    return n;
}

/** 图片精灵 */
export function img(parent: Node, path: string, w: number, h: number, x: number, y: number, color?: Color | string): Sprite {
    const n = nd(parent, path, w, h, x, y);
    const sp = n.addComponent(Sprite);
    setFrame(sp, path, w, h, color);
    sp.type = Sprite.Type.SIMPLE;
    return sp;
}

/** 九宫格图片（Cocos 原生 SLICED） */
export function sliced(parent: Node, path: string, w: number, h: number, x: number, y: number,
    inset: [number, number, number, number], color?: Color | string, name?: string): Sprite {
    const n = nd(parent, name || path, w, h, x, y);
    const sp = n.addComponent(Sprite);
    const sf = Res.I ? Res.I.slice(path, inset[0], inset[1], inset[2], inset[3]) : null;
    sp.trim = false;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    if (sf) { sp.spriteFrame = sf; sp.type = Sprite.Type.SLICED; } else { sp.type = Sprite.Type.SIMPLE; }
    const ut = n.getComponent(UITransform);
    if (ut) { ut.setContentSize(w, h); }
    if (color) { sp.color = typeof color === 'string' ? hex(color) : color; }
    return sp;
}

export interface LabelOpts {
    size?: number;
    lineHeight?: number;
    color?: Color | string;
    hAlign?: 'left' | 'center' | 'right';
    vAlign?: 'top' | 'center' | 'bottom';
    bold?: boolean;
    overflow?: 'none' | 'clamp' | 'shrink' | 'resize';
    outline?: Color | string;
    outlineWidth?: number;
    anchorX?: number;
    anchorY?: number;
}

/**
 * 文字超采样倍率 —— 「分辨率调高到 2K」在 UI 文字上的正解。
 *
 * ★ 为什么不是改设计分辨率（2026-09-24 第十九轮排查结论）：
 *   Cocos 的 TTF Label 是**按 `fontSize` 栅格化到离屏画布、再把画布贴到 quad 上**的
 *   （引擎 `assembler/label/text-processing._getStyleFontScale` 的 fontScale 恒为 1，
 *    只受画布 MAX_SIZE 限制），也就是说文字的**像素密度只取决于 fontSize**，
 *    跟「设计分辨率」没有关系。而竖屏用 `FIXED_WIDTH`：设计宽 720 映射到整屏宽，
 *   2K 手机（1440px）等于把 720 宽的画布拉伸 2 倍 —— 12~18px 的字又小又糊。
 *   单纯把 DESIGN_W/H 翻倍、布局常量一起翻倍，屏幕上的物理大小和清晰度**一点不变**
 *   （因为一切都等比跟着屏幕走），还要改动上千个坐标常量，风险极高收益为零。
 *
 *   这里改成：**字形按 SS 倍分辨率栅格化**（fontSize × SS、文字盒也 × SS），
 *   再把 Label 节点缩回 1/SS —— 视觉尺寸/排版完全不变，但纹理清晰度翻倍，
 *   等效于「全部文字按 2K 渲染」。全工程只有一个 `label()` 出口，所以一处生效。
 *   ⚠️ 想关掉这个效果：把 TEXT_SS 改成 1 即可。
 */
export const TEXT_SS = 2;
/** Label 节点自身的基准缩放（不是 1！任何直接 setScale 到 label 节点的动画都要乘它） */
export const TEXT_SCALE = 1 / TEXT_SS;

export function label(parent: Node, text: string, x: number, y: number, w: number, h: number, o?: LabelOpts): Label {
    const ax = o?.anchorX ?? 0.5, ay = o?.anchorY ?? 0.5;
    // 显式标 number：否则 TS 按字面量类型 2 推断，下面 `ss !== 1` 会被判成恒真语句（TS2367）
    const ss: number = TEXT_SS;
    const size = o?.size ?? 28;
    // 盒子按 SS 放大，节点再缩回 1/SS → 世界尺寸与原来完全一致，但字形按 SS 倍栅格化
    const n = nd(parent, 'label', w * ss, h * ss, x, y, ax, ay);
    if (ss !== 1) { n.setScale(TEXT_SCALE, TEXT_SCALE, 1); }
    const lb = n.addComponent(Label);
    lb.string = text;
    lb.fontSize = size * ss;
    lb.lineHeight = (o?.lineHeight ?? size * 1.15) * ss;
    lb.color = o?.color ? (typeof o.color === 'string' ? hex(o.color) : o.color) : WHITE;
    lb.horizontalAlign = o?.hAlign === 'left' ? Label.HorizontalAlign.LEFT
        : o?.hAlign === 'right' ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
    lb.verticalAlign = o?.vAlign === 'top' ? Label.VerticalAlign.TOP
        : o?.vAlign === 'bottom' ? Label.VerticalAlign.BOTTOM : Label.VerticalAlign.CENTER;
    lb.isBold = o?.bold ?? true;
    const ov = o?.overflow ?? 'none';
    lb.overflow = ov === 'clamp' ? Label.Overflow.CLAMP
        : ov === 'shrink' ? Label.Overflow.SHRINK
            : ov === 'resize' ? Label.Overflow.RESIZE_HEIGHT : Label.Overflow.NONE;
    if (Res.I && Res.I.font) { lb.font = Res.I.font; lb.useSystemFont = false; }
    if (o?.outline) {
        // Cocos 3.8：描边已内置到 Label，无需 LabelOutline 组件
        const ol = (lb as any);
        if ('outlineWidth' in ol) {
            ol.outlineColor = typeof o.outline === 'string' ? hex(o.outline) : o.outline;
            ol.outlineWidth = o.outlineWidth ?? 2;
        }
    }
    return lb;
}

export interface BtnOpts {
    w: number; h: number; x: number; y: number;
    tex?: string;
    texColor?: Color | string;
    inset?: [number, number, number, number];
    text?: string;
    fontSize?: number;
    textColor?: Color | string;
    textY?: number;
    onClick?: () => void;
    sound?: string | null;
    scale?: number;
    disabled?: boolean;
    name?: string;
}

/** 通用按钮：Sprite(SLICED) + Label + 触摸反馈，纯 Cocos 事件 */
export function button(parent: Node, o: BtnOpts): Node {
    const n = nd(parent, o.name || ('btn_' + (o.text || '')), o.w, o.h, o.x, o.y);
    let sp: Sprite | null = null;
    if (o.tex) {
        sp = sliced(n, o.tex, o.w, o.h, 0, 0, o.inset ?? [40, 40, 24, 24], o.texColor, 'bg');
    } else {
        sp = rect(n, o.w, o.h, 0, 0, o.texColor ?? '#4A5A72', 'bg').getComponent(Sprite);
    }
    if (o.text) {
        label(n, o.text, 0, o.textY ?? 2, o.w - 12, o.h, {
            size: o.fontSize ?? Math.min(34, o.h * 0.42),
            color: o.textColor ?? '#FFFFFF',
            outline: '#1B2230', outlineWidth: 2,
        });
    }
    const base = o.scale ?? 0.94;
    n.on(Node.EventType.TOUCH_START, () => { if (!o.disabled) { n.setScale(base, base, 1); } });
    n.on(Node.EventType.TOUCH_CANCEL, () => { n.setScale(1, 1, 1); });
    n.on(Node.EventType.TOUCH_END, () => {
        n.setScale(1, 1, 1);
        if (o.disabled) { return; }
        if (o.sound !== null && Res.I) { Res.I.play(o.sound || 'click', 0.7); }
        if (o.onClick) { o.onClick(); }
    });
    return n;
}

/**
 * 给**场景实体化**的按钮节点接上与 button()/woodButton() 完全一致的手感：
 * 按下缩到 0.94、抬起/取消回 1、播 click 音、执行回调。
 * 场景里摆好的按钮不带任何事件（事件不序列化），必须运行时用这根补上。
 */
export function pressable(n: Node, onClick: () => void, sound: string | null = 'click', base = 0.94) {
    n.on(Node.EventType.TOUCH_START, () => { n.setScale(base, base, 1); });
    n.on(Node.EventType.TOUCH_CANCEL, () => { n.setScale(1, 1, 1); });
    n.on(Node.EventType.TOUCH_END, () => {
        n.setScale(1, 1, 1);
        if (sound && Res.I) { Res.I.play(sound, 0.7); }
        onClick();
    });
}

/**
 * 场景实体化的 Label 在编辑器里只能是系统字体（字体资产引用运行时才有）。
 * 进场景拿到 Res.I.font 后，把子树里所有 Label 换成自定义字体 ——
 * 字号/行高/描边都是属性，换字体不影响排版参数。
 */
export function applyFontDeep(root: Node) {
    if (!Res.I || !Res.I.font) { return; }
    const walk = (n: Node) => {
        const lb = n.getComponent(Label);
        if (lb && lb.useSystemFont) { lb.font = Res.I.font; lb.useSystemFont = false; }
        for (const c of n.children) { walk(c); }
    };
    walk(root);
}

/** 圆角面板（用 Graphics 画，避免依赖切图） */
export function roundedPanel(parent: Node, w: number, h: number, x: number, y: number,
    fill: string, radius = 24, stroke?: string, strokeWidth = 4, name = 'panel'): Node {
    const n = nd(parent, name, w, h, x, y);
    const g = n.addComponent(Graphics);
    const c = hex(fill);
    g.fillColor = c;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    if (stroke) {
        g.lineWidth = strokeWidth;
        g.strokeColor = hex(stroke);
        g.roundRect(-w / 2, -h / 2, w, h, radius);
        g.stroke();
    }
    return n;
}

/** 进度条（bg + fill），返回设置进度的函数 */
export function bar(parent: Node, w: number, h: number, x: number, y: number, fillColor: string,
    bgColor = '#1A2030'): { root: Node, fill: Node, set: (p: number) => void } {
    const root = nd(parent, 'bar', w, h, x, y);
    const gb = root.addComponent(Graphics);
    gb.fillColor = hex(bgColor);
    gb.roundRect(-w / 2, -h / 2, w, h, h / 2);
    gb.fill();

    const fill = nd(root, 'fill', w, h, 0, 0, 0, 0.5);
    const gf = fill.addComponent(Graphics);
    gf.fillColor = hex(fillColor);
    const draw = (p: number) => {
        p = Math.max(0, Math.min(1, p));
        gf.clear();
        if (p <= 0.001) { return; }
        gf.fillColor = hex(fillColor);
        const fw = Math.max(h, w * p);
        gf.roundRect(0, -h / 2, fw, h, h / 2);
        gf.fill();
    };
    draw(1);
    return { root, fill, set: draw };
}

/**
 * 模态遮罩的基准尺寸（设计区局部单位）。
 * 由 GameRoot.applySafeLayout 按当前可见设计区写入 —— 宽屏（s<1，可见设计宽 1800+）
 * 与超高屏（vhE>1280）都要盖满，写死 900×1500 会在边缘露出没被压暗的游戏画面。
 */
export const MASK_SIZE = { w: 1000, h: 1600 };

/** 模态遮罩 + 拦截输入 */
export function modalMask(parent: Node, onClickOutside?: () => void): Node {
    const n = nd(parent, 'mask', MASK_SIZE.w, MASK_SIZE.h, 0, 0);
    const sp = n.addComponent(Sprite);
    setFrame(sp, 'ui/px_white2', MASK_SIZE.w, MASK_SIZE.h);
    // 遮罩压暗到 ~78%：面板底色已改成全不透明，遮罩再厚一点，
    // 底下的 HUD 就彻底不参与视觉了（这就是用户说的「文本层级被挡住」）。
    sp.color = new Color(0, 0, 0, 200);
    n.addComponent(BlockInputEvents);
    if (onClickOutside) { n.on(Node.EventType.TOUCH_END, onClickOutside); }
    return n;
}

/** 淡入 */
export function fadeIn(n: Node, dur = 0.18) {
    const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).to(dur, { opacity: 255 }).start();
}

/**
 * 清掉节点上正在跑的缩放/淡入淡出 tween。
 * 开/关被打断时（连点导航）必须做，否则旧的 popOut 会在 popIn 途中
 * 把缩放硬拉回 1、把透明度拉到 0，出现「弹一半就消失」。
 */
function clearPopTween(n: Node) {
    Tween.stopAllByTarget(n);
    const op = n.getComponent(UIOpacity);
    if (op) { Tween.stopAllByTarget(op); op.opacity = 255; }
}

/**
 * 「Q 弹」弹入：在屏幕中间从 0.72 放大过头到 1.07，再回落到 1。
 *
 * 所有面板/弹窗都用它出场（不再从屏幕下方滑入）：
 *  - 0.72 起步 → 视觉上就是「从中间鼓出来」，不会有位移方向感；
 *  - 中间过冲到 1.07 是 Q 弹的关键，纯 backOut 到 1 的弹感太弱；
 *  - 收尾用 sineInOut 让回落是「软着陆」，不是硬停。
 * 注意调用前节点必须是可见（active）状态，否则 tween 不跑。
 */
export function popIn(n: Node, dur = 0.32) {
    clearPopTween(n);
    n.setScale(0.72, 0.72, 1);
    tween(n)
        .to(dur * 0.58, { scale: new Vec3(1.07, 1.07, 1) }, { easing: 'backOut' })
        .to(dur * 0.42, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
        .start();
}

/**
 * 「缩放回去」消失：1 → 0.78 并淡出，动画结束后执行 onDone（默认销毁）。
 * 与 popIn 严格互逆，所以关掉再打开不会有残影。
 * 若节点还没有 UIOpacity 会补一个（用 UIOpacity 而非 Sprite.color，才不会破坏合批）。
 */
export function popOut(n: Node, dur = 0.16, onDone?: () => void) {
    clearPopTween(n);
    const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
    tween(n).to(dur, { scale: new Vec3(0.78, 0.78, 1) }, { easing: 'quadIn' }).start();
    tween(op).to(dur, { opacity: 0 }).call(() => {
        // 复位缩放，避免下次 popIn 从 0.78 起步时叠加
        if (n.isValid) { n.setScale(1, 1, 1); }
        if (onDone) { onDone(); } else if (n.isValid) { n.destroy(); }
    }).start();
}

/** 遮罩淡入（配合 popIn 用，遮罩只淡入不缩放，否则整屏会「涨大」） */
export function maskIn(n: Node, dur = 0.16) {
    const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 0;
    tween(op).to(dur, { opacity: 255 }).start();
}

/** 遮罩淡出 */
export function maskOut(n: Node, dur = 0.14) {
    const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    tween(op).to(dur, { opacity: 0 }).start();
}

/** 滚动容器 */
/**
 * 滚动指示条。
 *
 * 之前所有滚动列表都没有任何「下面还有内容」的提示，最后一行常常半截被遮罩
 * 裁掉，读起来就像「文字被挡住了」。这里给每个 ScrollView 配一条细指示条，
 * 自己盯着 content 高度与滚动偏移，只有变了才重排（每帧两次 getter，无开销）。
 */
@ccclass('UIScrollBar')
export class UIScrollBar extends Component {
    sv: ScrollView = null!;
    content: Node = null!;
    thumb: Node = null!;
    trackH = 0;
    viewH = 0;
    private lastH = -1;
    private lastOff = -999;

    update() {
        const c = this.content;
        if (!c || !c.isValid || !this.thumb || !this.thumb.isValid || !this.sv || !this.sv.isValid) { return; }
        const ct = c.getComponent(UITransform);
        if (!ct) { return; }
        const ch = ct.height;
        const off = Math.round(this.sv.getScrollOffset().y);
        if (ch === this.lastH && off === this.lastOff) { return; }
        this.lastH = ch; this.lastOff = off;

        // 内容比视口矮 → 没有可滚动的，整条指示条收起来
        if (ch <= this.viewH + 2) { this.thumb.active = false; return; }
        this.thumb.active = true;

        const th = Math.max(36, this.trackH * (this.viewH / ch));
        const maxOff = ch - this.viewH;
        const t = maxOff > 0 ? Math.max(0, Math.min(1, off / maxOff)) : 0;
        const span = this.trackH - th;
        const tu = this.thumb.getComponent(UITransform);
        if (tu) { tu.setContentSize(6, th); }
        this.thumb.setPosition(0, span / 2 - t * span, 0);
    }
}

/**
 * 带遮罩的竖向滚动区 + 右侧滚动指示条。
 * 指示条是 `parent` 的子节点（在视口外侧），所以既不会被遮罩裁掉、也不跟着内容滚。
 */
export function scrollView(parent: Node, w: number, h: number, x: number, y: number): { root: Node, content: Node, sv: ScrollView } {
    const root = nd(parent, 'scroll', w, h, x, y);
    const view = nd(root, 'view', w, h, 0, 0);
    const mask = view.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    const content = nd(view, 'content', w, 10, 0, h / 2, 0.5, 1);
    const sv = root.addComponent(ScrollView);
    sv.content = content;
    sv.vertical = true;
    sv.horizontal = false;
    sv.inertia = true;
    sv.brake = 0.72;
    sv.elastic = true;
    sv.bounceDuration = 0.2;

    const trackH = h - 24;
    const track = nd(parent, 'sbar', 6, trackH, x + w / 2 + 12, y);
    const trSp = track.addComponent(Sprite);
    setFrame(trSp, 'ui/px_white2', 6, trackH);
    trSp.color = new Color(255, 255, 255, 28);

    const thumb = nd(track, 'thumb', 6, 48, 0, 0);
    const thSp = thumb.addComponent(Sprite);
    setFrame(thSp, 'ui/px_white2', 6, 48);
    thSp.color = hex('#C8A44A');
    thumb.active = false;

    const bar = root.addComponent(UIScrollBar);
    bar.sv = sv;
    bar.content = content;
    bar.thumb = thumb;
    bar.trackH = trackH;
    bar.viewH = h;
    return { root, content, sv };
}

/** 让节点铺满父节点（Cocos Widget） */
export function stretch(n: Node, l = 0, r = 0, t = 0, b = 0) {
    const w = n.addComponent(Widget);
    w.isAlignLeft = w.isAlignRight = w.isAlignTop = w.isAlignBottom = true;
    w.left = l; w.right = r; w.top = t; w.bottom = b;
    w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
    w.updateAlignment();
}

export function vlayout(n: Node, spacing: number, paddingTop = 0) {
    const l = n.addComponent(Layout);
    l.type = Layout.Type.VERTICAL;
    l.resizeMode = Layout.ResizeMode.CONTAINER;
    l.spacingY = spacing;
    l.paddingTop = paddingTop;
    return l;
}

export function destroyChildren(n: Node) {
    const cs = n.children.slice();
    for (const c of cs) { c.destroy(); }
}

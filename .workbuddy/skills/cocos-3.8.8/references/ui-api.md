# UI 组件 API · Cocos Creator 3.8.8

> 枚举取值已逐个对 `cc.d.ts` 校验。类是 `GraphicsComponent` / `MaskComponent` / `RichTextComponent` 的别名，**import 时用 `Graphics` / `Mask` / `RichText`**。

## UITransform（一切 2D 节点的尺寸/锚点/坐标基础）

```ts
const ut = node.getComponent(UITransform) || node.addComponent(UITransform);
ut.setContentSize(w, h); ut.setContentSize(new Size(w, h));
ut.width / ut.height / ut.contentSize
ut.setAnchorPoint(x, y); ut.setAnchorPoint(new Vec2(x, y));
ut.anchorPoint; ut.anchorX; ut.anchorY
ut.convertToNodeSpaceAR(worldVec3, out?)     // 世界 → 本节点局部（锚点原点）
ut.convertToWorldSpaceAR(nodeVec3, out?)
ut.getBoundingBox(); ut.getBoundingBoxToWorld(); ut.hitTest(screenPoint)
ut.priority; ut.visibility; ut.cameraPriority
```
- 锚点 `(0.5, 0.5)` = 居中；`(0, 0.5)` = 左中；`(0.5, 1)` = 上中（本项目 `bar()` 的 fill 用 `(0, 0.5)` 做左对齐增长）。
- **触摸命中区 = UITransform 的矩形**，与 Sprite 的显示尺寸无关（Sprite 用 TRIMMED 时会改 UITransform！见坑 1）。

## Sprite

```ts
sp.spriteFrame = sf;
sp.type = Sprite.Type.SIMPLE;             // SIMPLE=0 | SLICED=1 | TILED=2 | FILLED=3
sp.sizeMode = Sprite.SizeMode.CUSTOM;     // ★ CUSTOM=0 | TRIMMED=1(默认) | RAW=2
sp.trim = false;                          // 透明边裁剪，配合 CUSTOM 用
sp.fillType = Sprite.FillType.HORIZONTAL; // HORIZONTAL=0 | VERTICAL=1 | RADIAL=2
sp.fillRange = 0.5; sp.fillStart = 0; sp.fillCenter = new Vec2(0.5, 0.5);
sp.grayscale = true;
sp.color = color;                         // 着色（与贴图相乘）。★ 运行时改色用 UIKit.tint()，禁用 Color.fromHEX(sp.color,...)（就地改引用不变 → setter 早退 → 不生效，坑 34）
sp.customMaterial = mat;                  // 改渲染材质，能做外发光/溶解
```
| 想做的事 | 组合 |
|---|---|
| 固定尺寸显示一张图 | `sizeMode = CUSTOM` + `trim = false` + 赋 frame + `setContentSize(w,h)` → **本项目 `setFrame()` 就是干这个的** |
| 九宫格拉伸不变形 | frame 设 `insetLeft/Right/Top/Bottom` + `type = SLICED` → 本项目 `Res.slice()` + `sliced()` |
| 纯色块 | 白点贴图 + `color` + `type = SIMPLE` → 本项目 `rect()` |
| 进度条 | `type = FILLED` + `fillType` + `fillRange`，或本项目 `bar()`（用 Graphics） |

`SpriteFrame` 关键属性：`rect`、`originalSize`、`insetLeft/Right/Top/Bottom`、`texture`、`packable`、`flipUVX/flipUVY`。

## Label（3.8 起内置描边，不要再加 LabelOutline）

```ts
lb.string = '文字';
lb.fontSize = 28; lb.lineHeight = 32;
lb.color = color;                         // ★ 运行时改色用 UIKit.tint(lb, '#xxx')，禁用 Color.fromHEX(lb.color,...)（坑 34）
lb.isBold / isItalic / isUnderline / underlineHeight
lb.horizontalAlign = Label.HorizontalAlign.CENTER;   // = HorizontalTextAlignment: LEFT=0 | CENTER=1 | RIGHT=2
lb.verticalAlign   = Label.VerticalAlign.CENTER;     // = VerticalTextAlignment: TOP=0 | CENTER=1 | BOTTOM=2
lb.overflow = Label.Overflow.SHRINK;                 // NONE=0 | CLAMP=1 | SHRINK=2 | RESIZE_HEIGHT=3
lb.enableWrapText = true; lb.spacingX = 0;
lb.cacheMode = Label.CacheMode.BITMAP;               // NONE=0 | BITMAP=1 | CHAR=2
lb.font = ttfFont; lb.useSystemFont = false;         // 用本工程 TTF：Res.I.font
lb.fontFamily = 'Arial';                             // useSystemFont 时才生效
lb.outlineColor = color; lb.outlineWidth = 3;        // ★ 3.8.2+ 内置描边
```
- `Overflow.SHRINK` 才会自动缩字适配宽度；`NONE` 会溢出（本项目默认 `none`，靠给足宽高来排版）。
- **描边会让 Label 走额外渲染分支**。UI 上几十个带描边的中文大字时，用 `CacheMode.BITMAP` 换性能（数字滚动那种每帧变的反而别用）。
- `LabelOutline` / `LabelShadow` 组件在 3.8 已废弃（`@deprecated since v3.8.2`），**不要 import**。
- 改 `string` 后尺寸要生效：若是 `NONE` + 固定宽高，节点尺寸不变，直接改即可。

## RichText（图文混排，富文本标签）

```ts
rt.string = '<color=#FF0000>红</color><b>粗</b><outline color=#000 width=2>描边</outline><size=40>大</size> <img src="emoji" />';
rt.fontSize / lineHeight / maxWidth / horizontalAlign / verticalAlign / font / useSystemFont / cacheMode
rt.imageAtlas; rt.handleTouchEvent;
```
支持标签：`color` / `size` / `b` / `i` / `u` / `br` / `outline` / `img` / `on`。`img` 只能引用同一个 ImageAtlas 里的图（SpriteAtlas 资源）。

## Graphics（矢量绘制——本项目大量用它替代切图）

```ts
const g = node.addComponent(Graphics);
g.fillColor = color; g.strokeColor = color;
g.lineWidth = 4; g.miterLimit = 10;
g.lineJoin = Graphics.LineJoin.ROUND;    // BEVEL=0 | ROUND=1 | MITER=2
g.lineCap  = Graphics.LineCap.ROUND;     // BUTT=0 | ROUND=1 | SQUARE=2

g.moveTo(x, y); g.lineTo(x, y); g.bezierCurveTo(c1x,c1y,c2x,c2y,x,y);
g.quadraticCurveTo(cx, cy, x, y); g.arc(cx, cy, r, startRad, endRad, counterclockwise);
g.ellipse(cx, cy, rx, ry); g.circle(cx, cy, r);
g.rect(x, y, w, h); g.roundRect(x, y, w, h, r); g.close();
g.fill(); g.stroke(); g.fillRect(x, y, w, h); g.clear();
```
> **坐标系是节点局部坐标，原点在锚点处。** 所以本项目 `roundedPanel` 画 `roundRect(-w/2, -h/2, w, h, r)`。
> **重绘前必须先 `g.clear()`**，否则会不断累积路径（本项目 `bar()` 的 `draw()` 就做了这件事）。
> 每帧重绘 Graphics 会重建顶点，**别放在 `update` 里高频改**；美术表现优先用 Sprite + tween。

## Widget（对齐父节点，自适应）

```ts
const w = node.addComponent(Widget);
w.isAlignLeft = w.isAlignRight = w.isAlignTop = w.isAlignBottom = true;
w.left = 0; w.right = 0; w.top = 0; w.bottom = 0;
w.isAlignHorizontalCenter / isAlignVerticalCenter; w.horizontalCenter / w.verticalCenter
w.target = someNode;
w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;   // ONCE=0 | ALWAYS=1 | ON_WINDOW_RESIZE=2
w.isAbsoluteLeft/Right/Top/Bottom/HorizontalCenter/VerticalCenter   // 绝对值而非相对父节点
w.updateAlignment();                               // 手动触发一次
```
本项目 `stretch(n, l, r, t, b)` 封装了「四边对齐 + `ON_WINDOW_RESIZE` + `updateAlignment()`」。
> ⚠️ 改完 `isAlign*` 后编辑器侧有个已知 bug（`_alignFlags` 位掩码不重算），MCP 里已做兼容；**纯代码创建则无此问题**。

## Layout（自动排列）

```ts
const l = node.addComponent(Layout);
l.type = Layout.Type.VERTICAL;       // NONE=0 | HORIZONTAL=1 | VERTICAL=2 | GRID=3
l.resizeMode = Layout.ResizeMode.CONTAINER;  // NONE=0 | CONTAINER=1 | CHILDREN=2
l.spacingX = 8; l.spacingY = 12;
l.paddingLeft/Right/Top/Bottom; l.padding
l.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;      // BOTTOM_TO_TOP=0 | TOP_TO_BOTTOM=1
l.horizontalDirection = Layout.HorizontalDirection.LEFT_TO_RIGHT;  // LEFT_TO_RIGHT=0 | RIGHT_TO_LEFT=1
l.startAxis = Layout.StartAxis.HORIZONTAL;   // HORIZONTAL=0 | VERTICAL=1（GRID 用）
l.constraint = Layout.Constraint.FIXED_ROW;  // NONE=0 | FIXED_ROW=1 | FIXED_COL=2
l.constraintNum = 3; l.cellSize = new Size(100, 100);
l.alignHorizontal / alignVertical; l.affectedByScale
```
- `resizeMode = CONTAINER`：**自动改父节点尺寸**→ 放 ScrollView content 里最常用（本项目 `vlayout()`）。
- 改完子节点要立即重排：`l.updateLayout()`。

## ScrollView（竖向列表 / 背包 / 技能树）

```ts
const sv = node.addComponent(ScrollView);
sv.content = contentNode;        // 必填
sv.vertical = true; sv.horizontal = false;
sv.inertia = true; sv.brake = 0.72; sv.elastic = true; sv.bounceDuration = 0.2;
sv.scrollToTop(t?, attenuated?); sv.scrollToBottom(t?); sv.scrollTo(anchorVec2, t?);
sv.scrollToOffset(new Vec2(x, y), t?); sv.getScrollOffset(); sv.getMaxScrollOffset();
sv.stopAutoScroll(); sv.isScrolling(); sv.isAutoScrolling();
sv.horizontalScrollBar = bar; sv.verticalScrollBar = bar;
```
事件（挂在 **sv.node** 上）：
```ts
sv.node.on(ScrollView.EventType.SCROLL_ENDED, cb);   // 'scroll-ended'
// SCROLL_TO_TOP / SCROLL_TO_BOTTOM / SCROLL_TO_LEFT / SCROLL_TO_RIGHT
// SCROLL_BEGAN / SCROLL_ENDED / SCROLLING / BOUNCE_TOP / BOUNCE_BOTTOM / BOUNCE_LEFT / BOUNCE_RIGHT
```
标准搭法（本项目 `scrollView()` 已封装）：
```
root(ScrollView)
└─ view(UITransform，尺寸=可视区) ── 挂 Mask
   └─ content(UITransform，锚点 (0.5, 1)，y = 可视高/2)
```
> **翻页/列表项的触摸穿透**：`view` 上的 `Mask` 只裁剪显示，不拦事件；遮挡点击要用 `BlockInputEvents`。

## Mask（裁剪）

```ts
const m = node.addComponent(Mask);
m.type = Mask.Type.GRAPHICS_RECT;    // GRAPHICS_RECT=0 | GRAPHICS_ELLIPSE=1 | GRAPHICS_STENCIL=2 | SPRITE_STENCIL=3
m.inverted = false;                  // 反向遮罩
m.spriteFrame = sf;                  // SPRITE_STENCIL 时需要
```
> 3.8 **没有** `Mask.Type.RECT` / `ELLIPSE`（2.x 的名字），必须用 `GRAPHICS_RECT` / `GRAPHICS_ELLIPSE`。`GRAPHICS_STENCIL` 需配合同节点 Graphics 画的路径。

## Button

```ts
const b = node.addComponent(Button);
b.interactable = true;                        // false = 置灰不可点
b.transition = Button.Transition.SCALE;       // NONE=0 | COLOR=1 | SPRITE=2 | SCALE=3
b.target = someNode;                          // 作用目标，默认自身
b.zoomScale = 0.95;   b.duration = 0.1;       // SCALE 用
b.normalColor / pressedColor / hoverColor / disabledColor
b.normalSprite / pressedSprite / hoverSprite / disabledSprite
node.on(Button.EventType.CLICK, cb);          // 'click'
```
`Button.State`: `NORMAL=0 | HOVER=1 | PRESSED=2 | DISABLED=3`。
> 本项目**不用 Button 组件**，`UIKit.button()` 直接用 `TOUCH_START/END/CANCEL` 手写按下缩放 + `TOUCH_END` 触发回调——因为要挂音效、要支持 `disabled` 而不置灰（价格不够时仍显示原色）。加新按钮时**继续用 `button()`，别混用两套**。

## 其它交互组件

| 组件 | 关键成员 |
|---|---|
| `Toggle` | `isChecked`、`checkMark`(Sprite)、`toggleGroup`、`EventType.TOGGLE='toggle'`、`checkEvents` |
| `ToggleContainer` | `allowSwitchOff`、`checkEvents` |
| `Slider` | `progress`(0~1)、`handle`、`direction`(`Horizontal=0 / Vertical=1`)、`EventType.SLIDE='slide'` |
| `ProgressBar` | `progress`、`barSprite`、`mode`(`HORIZONTAL/VERTICAL/FILLED`)、`totalLength` |
| `EditBox` | `string`、`placeholder`、`inputMode`、`maxLength`、`EventType.TEXT_CHANGED/EDITING_DID_ENDED/EDITING_RETURN` |
| `PageView` | `content`、`scrollToPage(i)`、`EventType.PAGE_TURNING`、`SizeMode.Unified/Free` |
| `SafeArea` | 自动避开刘海/圆角；竖屏全屏项目值得加在根节点上 |

## 显示与输入辅助

```ts
const op = node.addComponent(UIOpacity);   // ★ 节点整体透明度
op.opacity = 0;      // 0~255
// 淡入淡出：tween(op).to(0.2, { opacity: 0 }).start()

node.addComponent(BlockInputEvents);       // 吞掉穿透到下层的事件（弹窗根节点必加）
```
> **节点透明度只能用 `UIOpacity`**，`Node` 没有 `opacity`；改 `Sprite.color.a` 只影响该 Sprite（子节点不跟随）。
> 本项目 `modalMask()` = 半透明 Sprite + `BlockInputEvents`，这是弹窗的标准底座。

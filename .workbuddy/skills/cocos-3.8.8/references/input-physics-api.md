# 输入 · 物理 · 系统能力 · Cocos Creator 3.8.8

## 两套输入入口，别混用

| 入口 | 适用 | 特点 |
|---|---|---|
| **节点事件** `node.on(Node.EventType.TOUCH_*)` | UI 按钮、瓶子、面板（**本项目全用这个**） | 自动做命中测试，只在该节点矩形内触发，天然支持层级遮挡与冒泡 |
| **全局输入** `input.on(Input.EventType.*)` | 键盘、全屏手势、拖拽、任何位置的点击 | 不依赖节点，拿的是屏幕坐标 |

```ts
import { input, Input, Node, EventTouch, EventKeyboard, KeyCode } from 'cc';

// 全局
input.on(Input.EventType.TOUCH_START, this.onDown, this);
input.once(Input.EventType.KEY_DOWN, start);          // 本项目 showSplash 用 once 只监听一次
input.off(Input.EventType.TOUCH_START, this.onDown, this);

// 节点
this.node.on(Node.EventType.TOUCH_END, (e: EventTouch) => { ... }, this);
```
`Input.EventType`：`TOUCH_START / TOUCH_MOVE / TOUCH_END / TOUCH_CANCEL`、`MOUSE_DOWN / MOUSE_MOVE / MOUSE_UP / MOUSE_ENTER / MOUSE_LEAVE / MOUSE_WHEEL`、`KEY_DOWN / KEY_PRESSING / KEY_UP`、`DEVICEMOTION`、`GAMEPAD_INPUT`。
> 移动端单指 = `TOUCH_*`；桌面浏览器鼠标也会转成 `TOUCH_*`，所以只写 TOUCH 即可兼容两端。

### EventTouch（用户触摸）

```ts
e.getUILocation();        // ★ UI 坐标系（设计分辨率下的坐标，做 UI 判定用这个）
e.getLocation();          // 原始屏幕像素坐标
e.getUILocationX(); e.getUILocationY();
e.getLocationX(); e.getLocationY();
e.getUIDelta(); e.getDelta();             // 相对上一次的位移
e.getPreviousLocation(); e.getStartLocation();
e.getID();                                // 触摸点 id，多点触控区分手指
e.touch;                                  // 底层 Touch 信息
e.propagationStopped = true;              // ★ 阻止继续向上冒泡
e.preventSwallow = true;                  // 阻止被下层吞掉
```
把屏幕点换成节点内坐标：
```ts
const p = node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(e.getUILocation().x, e.getUILocation().y, 0));
```

### EventMouse / EventKeyboard

```ts
e.getButton();            // EventMouse.BUTTON_LEFT / BUTTON_MIDDLE / BUTTON_RIGHT
e.getScrollY();           // 滚轮
e.getUILocation(); e.getUIDelta(); e.getButton(); e.movementX;

// 键盘
input.on(Input.EventType.KEY_DOWN, (e: EventKeyboard) => {
    if (e.keyCode === KeyCode.SPACE) { ... }
    if (e.keyCode === KeyCode.ARROW_LEFT) { ... }
}, this);
e.keyCode; e.isPressed;
```
`KeyCode` 常用值：`SPACE=32`、`ARROW_LEFT=37`、`ARROW_UP=38`、`ARROW_RIGHT=39`、`ARROW_DOWN=40`、`ESCAPE=27`、`ENTER=13`、`A~Z=65~90`、`DIGIT_0~9=48~57`。

> 本项目只有 `GameRoot.showSplash()` 用了键盘（`input.once(KEY_DOWN, start)`，方便桌面端按任意键开始）。要做「按 ESC 关面板」这类功能，用 `input.on(KEY_DOWN)` + 自己判 `Modal` 栈顶。

### 触摸不响应的排查顺序

1. 节点有没有 `UITransform`，`contentSize` 是不是 0（`nd()` 建节点默认有，但手写 `new Node()` 没有）。
2. 尺寸/位置对不对——**锚点在中心时 `(x, y)` 是中心**，别按左上角算。
3. 上层有没有节点盖住它且**没有** `propagationStopped`（上层收不到就会继续往下传，反之则被吞）。
4. 父链上有没有 `active = false` / `UIOpacity.opacity = 0`（透明不影响点击，但 inactive 会）。
5. 有没有被 `BlockInputEvents` 拦住（弹窗遮罩常见）。
6. 节点在 `Canvas` 之外（没有 `UITransform` 祖先 → 不参与 UI 事件分发）。

## 2D 物理（Box2D）

**本项目未启用物理**——所有碰撞都是手写判定（瓶子只跟自己的落点比较）。要引入时：

```ts
import { RigidBody2D, BoxCollider2D, CircleCollider2D, PolygonCollider2D,
         Collider2D, Contact2DType, PhysicsSystem2D, ERigidBody2DType } from 'cc';

const rb = node.addComponent(RigidBody2D);
rb.type = ERigidBody2DType.Dynamic;    // Static=0 | Kinematic=1 | Dynamic=2 | Animated=3
rb.gravityScale = 1; rb.fixedRotation = true; rb.linearDamping = 0.1;
rb.linearVelocity = new Vec2(0, 10);   rb.applyForceToCenter(new Vec2(0, 5), true);
rb.applyLinearImpulseToCenter(impulse, true);

const col = node.addComponent(BoxCollider2D);
col.size = new Size(40, 40); col.offset = new Vec2(0, 0);
col.density = 1; col.friction = 0.2; col.restitution = 0.4; col.sensor = false;
col.group = 1 << 0; col.mask = 1 << 0;   // 用位掩码做分组过滤

// 碰撞回调（挂在 Collider 上）
col.on(Contact2DType.BEGIN_CONTACT, (self, other, contact) => {}, this);
col.on(Contact2DType.END_CONTACT, ...);
col.on(Contact2DType.PRE_SOLVE, ...); col.on(Contact2DType.POST_SOLVE, ...);

PhysicsSystem2D.instance.enable = true;
PhysicsSystem2D.instance.gravity = new Vec2(0, -320);
PhysicsSystem2D.instance.raycast(p1, p2, ERaycast2DType.Closest);
PhysicsSystem2D.instance.on(Contact2DType.BEGIN_CONTACT, cb, this);
```
> 需要在 **项目设置 → 物理 → 2D 物理** 里填重力/是否开启，否则 `enable` 无效。像素比：默认 `PHYSICS_2D_PTM_RATIO = 32`，即 32 px = 1 m，设力度时按米算。
> 对「点瓶子」这类纯 UI 玩法，**加物理是过度设计**——继续用手写碰撞（比较坐标/矩形相交）更可控、性能更好。只有需要真实弹跳堆叠时才上物理。

## 3D 物理（简要）

`physicsSystem`（单例）、`RigidBody`、`BoxCollider / SphereCollider / CapsuleCollider / MeshCollider`、`PhysicsSystem.instance.gravity`、`raycast`。本项目纯 2D，用不到。

## 射线检测（UI 层级）

```ts
import { geometry, PhysicsSystem } from 'cc';
// 3D 场景用：camera.screenPointToRay(x, y, out)
// UI 场景判断某点是否在节点内：
const inside = node.getComponent(UITransform)!.getBoundingBoxToWorld()
                   .contains(new Vec2(worldX, worldY));
```

## 与系统有关的常用能力（`sys`）

```ts
sys.isMobile / sys.isBrowser / sys.isNative / sys.isXR
sys.platform      // Platform.ANDROID / IOS / WINDOWS / MACOS / WECHAT_GAME ...
sys.os            // OS.ANDROID / IOS / WINDOWS / MACOS / LINUX
sys.language      // Language.ZH_CN / EN ...
sys.localStorage  // ★ 存档用；别用 window.localStorage
sys.now()         // 毫秒时间戳（比 Date.now 更稳，推荐计时）
```

## 事件总线的取舍

引擎自带 `EventTarget`：
```ts
import { EventTarget } from 'cc';
const bus = new EventTarget();
bus.on('money-changed', cb, this); bus.emit('money-changed', v); bus.off(...); bus.targetOff(this);
```
**本项目不用它**，统一走 `G.addListener(fn)` + `G.notify()`（`Core/State.ts`）。理由：状态只有一个源头，UI 刷新需要「合并一帧内多次变化」；`Panel.ts` 的 `PanelHost` 把通知节流到 0.15s 再统一重建面板内容。
加新 UI 时：`G.addListener(() => { this.dirty = true; })`，在 `update` 里节流重建——**不要在 notify 里直接重建节点**（一次点击可能触发 5 次 notify，会疯狂 new/destroy）。

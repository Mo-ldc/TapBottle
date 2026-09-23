# 引擎核心 API · Cocos Creator 3.8.8

> 全部签名已对 `cc.d.ts` 校验。3.x **没有全局 `cc`**（`declare const cc: never`），必须 `import`。

## 导入

```ts
import { _decorator, Component, Node, Vec3, Color, Size, Rect, Quat, math,
         CCInteger, CCFloat, CCBoolean, CCString, Node as CCNode } from 'cc';
```

`_decorator` 解构（3.x 唯一写法）：

```ts
const { ccclass, property, menu, executeInEditMode, requireComponent,
        executionOrder, disallowMultiple, help, type, integer, float,
        boolean, string, visible, serializable } = _decorator;
```

| 装饰器 | 作用 |
|---|---|
| `@ccclass('Name')` | 注册组件类。**参数必须给字符串**（不传则用类名，压缩后可能冲突） |
| `@property` | 序列化字段。3.x 可裸用 `@property`（靠 TS 类型推断），也可 `@property(Node)` / `@property({ type: [Node] })` |
| `@property({ tooltip, displayName, range: [a,b], min, max, step, multiline })` | 编辑器呈现控制 |
| `@menu('分类/名字')` | 组件面板归类 |
| `@requireComponent(Sprite)` | 加组件时自动要求依赖 |
| `@executionOrder(-1)` | 同帧执行顺序，值小先执行 |
| `@disallowMultiple` | 同节点只允许一个 |
| `@executeInEditMode` | 编辑器里也跑生命周期 |

## Component 生命周期（按调用顺序）

```ts
onLoad()          // 节点激活时一次；做初始化、取引用。此时子节点已就绪
onEnable()        // 每次 active 变 true
start()           // 首次在 update 前调用一次；做依赖其他组件的初始化
update(dt: number)      // 每帧
lateUpdate(dt: number)  // 每帧，update 之后
onDisable()       // 每次 active 变 false
onDestroy()       // 销毁；清 listener / timer / 存档
resetInEditor()   // 编辑器里「重置」按钮
```

常用成员：`this.node`、`this.enabled`、`this.getComponent(T)`、`this.schedule(fn, interval?, repeat?, delay?)`、`this.scheduleOnce(fn, delay)`、`this.unschedule(fn)`、`this.unscheduleAllCallbacks()`。

```ts
// 定时器（优于 setTimeout）
this.schedule(() => { G.tick(0.1); }, 0.1);          // 每 0.1s，无限
this.schedule(cb, 1, 5);                              // 每 1s，共 5 次
this.scheduleOnce(() => G.save(), 3);
```
> 组件 `enabled=false` 或节点 `active=false` 时 `schedule` 暂停；`unscheduleAllCallbacks()` 在销毁前清干净。

## Node

```ts
const n = new Node('name');          // 新节点，无隐含组件（除 Transform）
parent.addChild(n);  parent.insertChild(n, 0);
n.removeFromParent(); n.destroy();   // destroy 延迟到帧末真正销毁
n.destroyAllChildren();
n.getChildByName('x'); n.getChildByPath('a/b/c');
n.children; n.parent; n.getSiblingIndex(); n.setSiblingIndex(i);
n.getComponent(Sprite); n.getComponent('cc.Sprite');
n.addComponent(Sprite); n.addComponent('cc.Sprite');
n.getComponentsInChildren(Label);
n.walk(pre, post);                    // 遍历自身+子孙
n.isValid                            // 销毁后为 false，异步回调里必须先判
```

**Transform**（Transform 组件在 3.x 上合并进 Node，直接改属性）：

```ts
n.setPosition(x, y, z); n.setPosition(v3);
n.position                      // Readonly<Vec3>，改它无效！
n.setWorldPosition(v); n.worldPosition
n.setScale(x, y, z); n.setScale(v)
n.angle = 90                    // 2D 旋转角（度），改这个而不是 rotation
n.eulerAngles = v3
n.setRotationFromEuler(x, y, z)
n.active = false                // 自身开关
n.activeInHierarchy             // 含父级
n.layer = Layers.Enum.UI_2D
```
> ⚠️ `n.position.x = 5` **不会生效**（返回只读对象）。必须 `n.setPosition(x, y, z)`。

## 事件系统

```ts
n.on(Node.EventType.TOUCH_END, cb, target?, useCapture?);
n.once(...); n.off(type, cb?, target?); n.targetOff(target);
n.emit('my-event', a, b);
const et = new EventTarget();  // 自定义事件总线（本项目不用，改用 G.notify）
```

`Node.EventType` 取值（字符串即时值）：
`TOUCH_START='touch-start'`、`TOUCH_MOVE`、`TOUCH_END`、`TOUCH_CANCEL`、`MOUSE_DOWN/UP/MOVE/WHEEL/ENTER/LEAVE`、`KEY_DOWN='keydown'`、`KEY_UP='keyup'`、`SIZE_CHANGED`、`ANCHOR_CHANGED`、`POSITION_CHANGED`、`SCALE_CHANGED`、`ROTATION_CHANGED`、`PARENT_CHANGED`、`CHILD_ADDED`、`CHILD_REMOVED`、`ACTIVE_IN_HIERARCHY_CHANGED`、`TRANSFORM_CHANGED`。

> **节点要能收到触摸，必须有 `UITransform` 且尺寸覆盖点击区**。透明区域也算——本项目用 `rect(card, 150, 76, x, y, '#00000000', 'hit')` 做透明热区，再挂 `TOUCH_END`。
> 阻止冒泡：`e.propagationStopped = true`（见 `Bottle.enableTouch`）。

## 数学类型

```ts
new Vec3(x, y, z); new Vec2(x, y); new Color(r, g, b, a); new Size(w, h); new Rect(x, y, w, h); new Quat()
Vec3.ZERO / ONE / UP / RIGHT / FORWARD
v.clone(); v.set(); v.add(); v.subtract(); v.multiplyScalar(); v.normalize(); v.length(); v.lerp(out, to, t)
Color.fromHEX(color, '#RRGGBB' | '#RRGGBBAA'); c.clone(); c.set(r,g,b,a)
math.clamp(v, min, max); math.clamp01(v); math.lerp(a, b, t); math.toRadian(deg); math.toDegree(rad)
```

> ⚠️ **`Color.fromHEX(out, hex)` 是就地改写（写进 `out` 并返回它，不是新建）。**
> 千万别写成 `Color.fromHEX(sp.color, '#xxx')` 去给组件改色——`sp.color` 返回的是内部 `_color` 本体，
> 引用不变会让 `Renderable2D.color` 的 setter 提前 `return`，`_updateColor()` 不执行，**画面纹丝不动还不报错**。
> 运行时改色一律用本项目 `UIKit.tint(sp, '#xxx')`（内部 `new Color` 再整体赋值）。详见 `references/pitfalls.md` 坑 34。

本项目 `Util.hex('#FF9E7A')` = `new Color()` + `fromHEX` → **每次返回新 Color**（可安全用于赋色）；
`Util.v3(x,y)` = `new Vec3(x,y,z)`。

## director / 场景

```ts
director.loadScene('Main', onLaunched?, onUnloaded?);     // 异步，销毁当前场景
director.preloadScene('Main', onLoaded?);
director.runScene(scene);
director.getScene(); director.getDeltaTime(); director.getTotalTime(); director.getTotalFrames();
director.pause(); director.resume(); director.isPaused();
director.addPersistRootNode(node);     // 常驻节点（不随场景销毁），如全局音频
director.getScheduler();
```
本项目重载入口：`(globalThis as any).__tb_reload()` → `director.loadScene('Main')`（GameRoot.ts）。

## view / screen / sys / game

```ts
view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
view.getDesignResolutionSize(); view.getVisibleSize(); view.getVisibleSizeInPixel(); view.getFrameSize();
view.setResizeCallback(() => {});      // 分辨率变化回调

screen.windowSize; screen.resolution; screen.devicePixelRatio;
screen.isFullScreen = true;

sys.isMobile / isBrowser / isNative / isXR; sys.platform; sys.os; sys.language;
sys.localStorage.getItem(k) / setItem(k, v) / removeItem(k);   // ★ 存档用它，勿用 window.localStorage
sys.now();   // 毫秒级，性能计时用

game.frameRate = 60;  game.totalTime;  game.frameTime;  game.isPaused;
game.once(Game.EVENT_SHOW, cb); game.once(Game.EVENT_HIDE, cb);
```

`ResolutionPolicy` 常量（**不是 enum，是 class 的静态属性**，都是 `number`）：
`EXACT_FIT`（拉伸） / `NO_BORDER`（填满可裁切） / `SHOW_ALL`（完整可见有黑边） / **`FIXED_WIDTH`（本项目用：固定宽、改高）** / `FIXED_HEIGHT` / `UNKNOWN`。

## 存档形态（本项目）

`Core/Save.ts` — 结构 `SaveData`，走 `sys.localStorage`，key = `GameConfig.SAVE_KEY = 'tapbottle.save.v1'`，版本 `SAVE_VERSION = 3`。
`loadSave()` 会做字段合并与兜底（`bottles` 长度必须为 7），**加新字段时记得在 `defaultSave()` 里补默认值**，并考虑旧档兼容。
自动存档：`GameRoot.update` 每 12 秒 `G.save()`，`onDestroy` 再存一次。

## 调试与平台宏

```ts
import { DEBUG, EDITOR, EDITOR_NOT_IN_PREVIEW, PREVIEW, BUILD, BYTEDANCE, WECHAT, ... } from 'cc/env';

if (DEBUG) { console.log('...'); }
if (EDITOR_NOT_IN_PREVIEW) { return; }
```
打印用 `log / warn / error / assert`（`import { log } from 'cc'`）。浏览器预览时 `console.log` 即可；要被编辑器 MCP 读到需要挂 `McpConsoleCapture`（见 editor-mcp.md）。

# 踩坑清单 · Cocos Creator 3.8.x

## A. 3.x 与 2.x / 旧版本的差异（最容易写错）

| 坑 | 正解 |
|---|---|
| `cc.xxx` 全局对象 | 3.0 起已删除（`declare const cc: never`）。必须 `import { Node } from 'cc'` |
| `node.position.x = 5` 不生效 | `position` 返回 `Readonly<Vec3>`。用 `node.setPosition(x, y, z)` |
| `Sprite.SizeMode.TRIM` | 枚举名是 **`TRIMMED`**（`CUSTOM=0 / TRIMMED=1 / RAW=2`） |
| `Sprite.Type.SLICED` 需要先设 inset | 九宫格必须设 `sf.insetLeft/Right/Top/Bottom`，否则 SLICED 退化成 SIMPLE |
| `Mask.Type.RECT` / `ELLIPSE` | 3.8 改成 **`GRAPHICS_RECT` / `GRAPHICS_ELLIPSE`**，另有 `GRAPHICS_STENCIL` / `SPRITE_STENCIL` |
| `LabelOutline` / `LabelShadow` 组件 | 3.8.2 起 `@deprecated`。用 **`label.outlineColor` / `label.outlineWidth`** |
| `Label.HorizontalAlign` 是独立枚举？ | 是别名：`Label.HorizontalAlign` = `HorizontalTextAlignment`（`LEFT/CENTER/RIGHT`）；`Label.VerticalAlign`（`TOP/CENTER/BOTTOM`） |
| `Label.Overflow.RESIZE` | 枚举是 `NONE/CLAMP/SHRINK/RESIZE_HEIGHT`（没有 RESIZE） |
| `node.on('touchstart')` | 事件名是 `'touch-start'` 等。用 `Node.EventType.TOUCH_START` 常量，别写字面量 |
| `ScrollView.scrollEvents` | 2.x 的东西，3.x 没有。用 `sv.node.on(ScrollView.EventType.SCROLL_ENDED, cb)` |
| `widget.isAlignBottom` 改完不生效 | 需要 `widget.updateAlignment()`；纯代码创建无 `_alignFlags` bug |
| `graphics.roundRect(...)` 连续画 | 重绘前必须 `g.clear()`，否则路径累积 |
| `new Node()` 后就能收触摸？ | 不能。需要 `UITransform` 且 `contentSize` 非 0（本项目 `nd()` 已处理） |
| `setTimeout` 做游戏时序 | 不要用。`schedule` / `tween.delay` 才会随节点销毁自动取消 |
| `window.localStorage` 存档 | 用 `sys.localStorage`（多端适配） |
| 异步回调里用已销毁的节点 | 先判 `node.isValid`（tween 的 `.call()` 尤其要注意） |

## B. 本项目专属高频坑

### 坑 1：赋了图但显示成原图大小（或反过来被拉变形）
`Sprite` 默认 `sizeMode = TRIMMED`，**赋 frame 的瞬间会把 UITransform 改成原图尺寸**，你之前设的 `setContentSize` 白设。
→ **永远走 `setFrame(sp, path, w, h, color)`**（它先设 `CUSTOM` + `trim=false`，赋 frame，再兜底 `setContentSize`）。手写时也照这个顺序。

### 坑 2：图是空白但不报错
`Res.sf(path)` 返回 `null` → `setFrame` 里 `if (sf)` 静默跳过。
三条排查：① 文件在 `assets/resources/Textures/` 下吗；② 路径拼对了吗（`'ui/px_white2'`，不带 `Textures/`、不带 `/spriteFrame`）；③ **加进 `Res.TEXTURE_PATHS` 了吗**。

### 坑 3：漏 import（本项目已踩 3 次）
TS 里用了一个没 import 的函数名，`strict: false` 下不一定会让整个编译失败，可能变成运行期静默失效。
→ **改完代码必须跑 `.workbuddy/tools/typecheck.py`**。

### 坑 4：切后台回来数值爆炸
`update(dt)` 的 `dt` 在恢复时可能是几秒。本项目 `GameRoot.update` 里钳了 `Math.min(dt, 0.05)`。
→ 自己写新的 `update` 时也要钳位，尤其是收益/计时累加。

### 坑 5：震屏把面板也抖了
`FxLayer.shake` 作用在 `shakeHolder` 上（包着 worldLayer/fxLayer/uiLayer）。
→ **不要把 `panelLayer` / `toastLayer` 放进 `shakeHolder`**，否则弹窗跟着抖、文字看不清。

### 坑 6：BGM 不播
浏览器自动播放限制。必须在用户手势回调里才 `Res.I.music(true, ...)`（本项目在 `showSplash` 的点击里）。
→ 不要在 `onLoad` / `start` 里直接播 BGM。

### 坑 7：一次点击触发 N 次面板重绘
`G.notify()` 在一次操作里可能被调多次（`spendMoney` + `notify`、`buyBottle` + `notify`…）。
→ 面板刷新统一走 `PanelHost`（节流 0.15s），**不要在 notify 里直接 new/destroy 节点**。

### 坑 8：切场景后旧 UI 还在收事件
`G.addListener` 的订阅不会随节点销毁取消。
→ `GameRoot.onLoad` 第一行 `G.clearListeners()`；自己写的组件在 `onDestroy` 里解绑（或依赖 `clearListeners` 的全局清理）。

### 坑 9：`resources` 里没有但代码里写了路径
`resources.load` 只能读 `assets/resources/`。放 `assets/Textures/`（少了 `resources`）就永远加载不到，回调 `err` 有值但**很多人不检查 err**。
→ 本项目 `Res.loadAll` 会 `console.warn('[Res] texture load error')`，看控制台。

### 坑 10：中文 Label 带描边时性能差 / 字被截
`Label.Overflow.NONE` 不换行也不缩字，超出就裁掉。宽高要给够。
大量带描边中文时设 `cacheMode = Label.CacheMode.BITMAP`；**相反，每帧变的数字不要用 BITMAP**（每次重绘位图更贵）。

## C. 编辑器 / 工具链坑

| 坑 | 正解 |
|---|---|
| `tsc` 直接跑项目 tsconfig 会喷 100+ 条错 | 那是引擎声明自身的噪音。用 `.workbuddy/tools/typecheck.py`（只检查 `assets/**/*.ts` 并过滤引擎路径） |
| `tsconfig.check.json` 里 `types` 路径失效 | `extends` 的子配置里，`types` 相对**子配置所在目录**解析，不是父配置。已在配置里写成 `../../temp/declarations/cc` |
| 扩展目录的 `.ts` 也进检查了 | `check.tsconfig.json` 的 `include` 只写 `assets/**/*.ts`，扩展是编辑器侧（Node 环境）代码，不进游戏编译 |
| 新文件编辑器不认 | `project_refresh_assets`，或删 `library/` 里对应条目重导 |
| 改了代码不生效 | `restart_cocos.py --soft`；顽固的用 `--hard-cache`（删 `temp/programming`）；再不行 `--full` |
| `debug_clear_code_cache` 报错 | **3.8.8 实测不可用**（`Menu item 'Developer > Cache > Clear code cache' not found`）。替代见上一条 |
| `debug_wait_compile` 一直 `timeout:true` | 它的 `timeout` 单位是**毫秒**；没有待编译任务时返回 timeout 属正常，不是错误 |
| 截图抓不到游戏画面 | `debug_screenshot(target:"pages")` 在 3.8.8 实测失败（`navigate failed`）。需在游戏侧接 `McpDebugClient`，见 `editor-ops.md` §6 |
| `read_console` 的 game 源一直是空 | 游戏跑在独立浏览器进程，需在游戏侧挂日志钩子（同上） |
| `asset_query` 返回 `None` | 3.8.8 实测不可靠，改用 `project_find_asset` 或 `res cocos://asset/{uuid}` |
| 手改 `.scene` / `.prefab` 被编辑器覆盖 | 编辑器打开的文件，**只用一种途径改**（要么 MCP，要么关掉编辑器改文件）。`.ts` 脚本直接改磁盘是安全的 |
| `scene_create` 报不支持 | 3.8.x 的已知限制。往 `assets/` 写 `.scene` JSON 再 `project_refresh_assets` |
| `scene_query` 报 `'uuid' is required` | 部分 action 有必填参数：`components` 要 `uuid`、`nodes_by_asset` 要 `assetUuid` |
| 重启编辑器会丢东西 | `restart_cocos.py --full` 会先查场景脏标记并拒绝执行；但**非场景状态**（未保存的面板输入、prefab 编辑模式）仍会丢。先 `--dry-run` 看一眼 |

## D. 缺陷清单（2026-09-21 复核 + 全部修复）

### ⚠️ 最重要的工具链事实：Cocos 命令行构建 **不因 TS 报错而失败**

`CocosCreator.exe --build` 只负责打包，**TypeScript 报错不会中断构建**，日志里连 `error TS` 都没有，
坏代码直接进包，然后在运行时炸 `ReferenceError` / `NaN` 坐标。

> **规则：每次改完源码，先跑 `.workbuddy/tools/typecheck.py`，再跑构建。**

本项目曾因此带病构建了 4 轮（漏 import、配置表少字段、读不存在的属性），
全部由类型检查抓出，构建日志一条都没报。

### 已修复（复核：typecheck.py 归零、verify_assets.py 归零）

| # | 位置 | 问题 | 状态 |
|---|---|---|---|
| 1 | `GameRoot.ts` | 用了 `setFrame` 但没 import | ✅ 已修 |
| 2 | `Game/HelperHands.ts` | 同上 | ✅ 已修 |
| 3 | `UI/SettingsPanel.ts` | `toggle()`/`stepper()` 是**模块级**函数却调用 `openSettings()` 内部的 `refreshAll()` → 作用域不可见，点开关/音量抛 ReferenceError | ✅ 已修（`refresh` 改为入参） |
| 4 | `Core/GameConfig.ts` | `p_cursor` 图标 `'env/cursorwhite'` 未登记 → 空白 | ✅ 已修（改用 `'env/cursor'`） |
| 5 | `Core/GameConfig.ts` | `LAYOUT` 缺 `abilityY` → `Abilities` 读到 undefined，能力条坐标 NaN | ✅ 已修 |
| 6 | `UI/DrawerContent.ts` | `BottleStatDef` 无 `base` 字段却被读 → 词条描述全 NaN | ✅ 已修（**2026-09-23 已整体重构**：词条矩阵进 `BottleStatDef.tiers[]`，描述改由 `等级×step` 推导，`TIERS[].success` 字段已随角度制判定一并删除） |

### 本轮新增坑（已补充到正文对应章节）

- **坑 11 · Label 不解析富文本标签。** Cocos 的 `Label` 遇到 `<color=#xxx>` 会**原样显示标签文字**。
  文案表里的富文本必须剥离（本项目统一在 `Locale.t()` 里用正则 strip）；需要彩色请拆多个 Label 或用 `RichText` 组件。
- **坑 12 · 定时刷新绝不能重建节点。** 抽屉面板最初每 0.25s 调 `rebuild()` → 节点反复销毁重建 →
  点击回调里节点已失效，报 `Cannot read properties of null (reading 'getComponent')`，且购买按钮点不动。
  正确做法：`rebuild()` 只在切页签时调，定时只跑 `refresh()`（只改字符串/颜色）。
- **坑 13 · `button()` 没传 `text` 就不会有 `label` 子节点。** `getChildByName('label')` 返回 null。
  要自定义文案就自己 `label(btn, ...)` 并保存引用。
- **坑 14 · 场景里引用用户脚本的 `__type__` 必须是「压缩 UUID」。**
  写原始 uuid 也能构建通过，但运行时控制台报
  `Sorry, the component of 'XXX' which with an index of 0 is corrupted! It has been removed.`，
  组件被静默摘掉、脚本永不执行（表现：整个游戏空白）。
  压缩算法：32 位十六进制**前 5 位原样保留**，其余每 3 位十六进制 → 2 位 base64（`A-Za-z0-9+/`），共 23 字符。
  核对办法：构建产物 `assets/main/index.js` 里搜 `cclegacy._RF.push({}, "<id>", "<类名>"`。
- **坑 15 · `ELECTRON_RUN_AS_NODE` 会让 CocosCreator.exe 退化成纯 Node。**
  任何宿主 Electron 应用（含智能体运行时）会注入这个变量，导致命令行构建直接报
  `CocosCreator.exe: bad option: --project`。构建前必须 `Remove-Item Env:ELECTRON_RUN_AS_NODE`。

---

## E. 无头浏览器验收 & 批量改文件的坑（2026-09-21 第四轮补充）

> 这一节的经验来自「按原版截图重做左侧竖向瓶盖履带 + 节点图技能树」，由 `E:\LDC_Fby\_cdp.py` 驱动验收。

### 坑 16 · 同一文件的多处编辑会互相覆盖（不是 Cocos 的坑，但会让你白跑几轮构建）

`Edit` 工具按「读盘 → 替换 → 写盘」工作。**在同一条消息里对同一个文件发多个 Edit，后面的会基于旧快照覆盖前面的**，
而且**每一处都返回 success**。本轮有 7 个文件共丢了 12 处编辑，其中一处是「方法已定义但调用点丢失」，
表现为「履带一直不进料、`pendingCaps` 持续增长但 `chips` 恒为 0」——查了很久才定位。

**规矩：**
- 同一文件一次只发一个 Edit。
- 改完立刻做「关键字必须出现」的逐条校验：
  ```python
  for k in ['this.spawnCaps(b, r);', 'private spawnCaps(']:
      print('OK ' if k in src else 'FAIL', k)
  ```
  注意 **只查方法名会漏掉调用点**，要把调用表达式整行一起校验。
- 需要一次改很多处时，写一个**可重放的 Python 补丁脚本**（精确 `str.replace` + 未匹配告警），比连发 Edit 可靠得多。

### 坑 17 · 用「节点世界坐标」点击时，原点在画布左下角

Cocos UI 节点的 `getWorldPosition()` 以**画布左下角**为原点（Canvas 节点的 anchor 是 0.5,0.5，位置在 visibleSize 的一半）。
两套换算公式**不能混用**：

```js
// ① 按设计坐标点（编辑器里量出来的坐标）
cssX = rect.left + (vis.width  / 2 + dx) * scale;
cssY = rect.top  + (vis.height / 2 - dy) * scale;

// ② 按节点世界坐标点
cssX = rect.left + p.x * scale;
cssY = rect.top + rect.height - p.y * scale;   // 注意是 rect.height，不是 vis.height/2
```
写成 `(vis.height/2 - p.y)` 会让点全部落到屏幕右下方的画布外，**没有任何报错**，只见「点了没反应」。
调试口径：先 `eval` 打出 `node.getWorldPosition()` 与 `cc.view.getVisibleSize()`，就能一眼看出用的是哪套。

### 坑 18 · 指令脚本文件带 BOM，首行会被静默跳过

`for line in open(script)` + `line.partition(":")`：若文件带 UTF-8 BOM，首行 kind 变成 `\ufeffeval` 而不等于 `eval`，
**整行被跳过且无任何提示**。若首行恰好是「注入 `window.__xxx` 工具函数」的 eval，后续所有依赖它的指令都会连锁失败。
对策：用 `encoding="utf-8-sig"` 打开；新建脚本文件时确认无 BOM。

### 坑 19 · ScrollView 里的内容坐标：content 的 anchor 是 (0.5, 1)

`scrollView()` 造出的 `content` 锚点在**左上角**，所以子节点的 y 要写成**负值**（距顶部的偏移）：

```ts
contentY(row) = -(70 + (maxRow - row) * STEP_Y + NODE_SIZE / 2);
```
滚动到指定位置用 `sv.scrollToOffset(new cc.Vec2(0, 目标距顶部距离))`（`timeInSecond` 不传即瞬时）。

### 坑 21 · 无头脚本里的 `sleep:N` 实际耗时明显长于 N 毫秒

驱动脚本每执行一条指令都会额外 `pump(0.25)` 收事件，加上 `Runtime.evaluate` 的往返，
**标称 `sleep:700` 实测可能是 1.0~1.2 秒**。据此推算速度/距离会得出「物体瞬移」的错误结论。
判断物理速度时别用标称时间，直接在 `eval` 里打印对象的 `y` 与时间戳，或分两次采样求差。

### 坑 20 · `Sprite` 平铺（TILED）不会缩放贴图

`Sprite.Type.TILED` 是按**原图尺寸**重复，节点尺寸不是原图整数倍时只会被裁切，不会缩放。
竖向长条贴图（如 `env/belt.png` 125×999）想铺满一个 96×536 的节点，用 **SIMPLE + CUSTOM 尺寸拉伸**更省事；
拉伸后若对比度不够（浅色贴图 + 白色粒子），把 Sprite 颜色压暗一档即可。

---

## F. 2D 性能优化套路（本项目实测：同负载 22fps → 55fps）

> 场景：屏幕上会有几十~上百个同类小物件（本项目是传送带上的瓶盖）+ 高频飘字/粒子。
> 全部在 Cocos 3.8 的 UI（`cc.Sprite` / `cc.Label`）体系里做，不涉及 3D。

### 坑 22 · 每帧给 `Label.string` 赋同样的值，也会重建文字网格

`Label` 的 setter 不做脏检查（或检查粒度不够），**每帧写 `label.string = ...` 会每帧重生一次文字几何**。
本项目原来的 HUD 每帧写 5 个 Label（金币/每秒/瓶盖/在途/状态），白烧一大截 CPU。

```ts
// ❌ 每帧都写
this.moneyLb.string = '$' + fmt(this.shownMoney);
// ✅ 自己缓存上一次的字符串
const s = '$' + fmt(this.shownMoney);
if (s !== this.cMoney) { this.cMoney = s; this.moneyLb.string = s; }
```
规律：**凡是"数值驱动"的 Label，一律加字符串缓存**；凡是"状态驱动"的颜色/显隐，一律先比状态再改。

### 坑 23 · `new` / `destroy` / `tween` 是高频特效的三大开销源

一次点击动效如果走「建节点 → 加组件 → 起 tween → destroy」，就等于每次都在分配 + 建渲染数据 + 回收。
改成**开局预建对象池 + 在 `update` 里手算动画**：

```ts
// 池：预建 cap 个，运行时只切 active
private acquire(pool: FxItem[], cap: number, make: () => FxItem) {
    for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
    if (pool.length >= cap) return null;        // 池满就丢弃，绝不无限增长
    const it = make(); pool.push(it); return it;
}
// 动画：位置/缩放/旋转/透明度全手算，零 tween 零 GC
const p = it.t / it.dur;
it.node.setPosition(it.x0 + it.vx * it.t, it.y0 + it.vy * it.t + 0.5 * it.g * it.t * it.t, 0);
it.node.setScale(s, s, 1);
it.op.opacity = /* 按 p 淡出 */;
if (p >= 1) { it.active = false; it.node.active = false; }
```
**必须做的一步：池满时要有降级路径**。本项目瓶盖池满时把价值**直接入账**，既不吞资源也不会把节点数撑爆。

### 坑 24 · 合批的关键是「同层 + 同贴图 + 相邻」

Cocos 3.8 的 2D 批处理会把**渲染顺序上相邻、材质与贴图都一致**的 quad 合进一个 draw call。
所以想合批必须同时满足：

1. **同贴图**。本项目原来 7 张 `capchip_0..6` 混着用 → 每颗瓶盖都可能断批。
   改成**统一一张贴图 + `Sprite.color` 染色**：颜色是逐顶点数据，**不会打断合批**。
   （注意：贴图本身若带明显固有色，染色是相乘，结果会发闷 —— 挑最中性的一张做底。）
2. **同层级**。把「只放 Label」和「只放 Sprite」的内容分到两个容器：
   ```
   fxLayer
     ├─ fxSprites   ← 粒子/星光/冲击波
     └─ fxLabels    ← 所有飘字（建在后面 = 渲染在上）
   ```
   如果 Label 和 Sprite 互相穿插，两边都合不成批。用户说的「字体要放在同一个层级方便合批」就是这个意思。
3. **验证手段**：`cc.director.root.device.numDrawCalls` 每帧读一次，看「物件翻倍时 draw call 涨不涨」。
   本项目实测：瓶盖 25 颗 → 138 draws，64 颗 → 144 draws，**基本不涨**，说明合批生效。

### 坑 25 · `setSiblingIndex` 很贵，按需 + 节流

按 y 排序做前后遮挡时，每次 `setSiblingIndex` 都会触发子节点重排。
24 个物件 × 2 个子节点 × 每秒十几次落地 = 每秒几百次重排，CPU 直接吃掉。

```ts
// ① 请求重排只打脏标记
sortDepth() { this.depthDirty = true; }
// ② update 里节流执行，且顺序没变就 early-out
if (this.depthDirty) {
    this.depthAcc += dt;
    if (this.depthAcc >= 0.12) { this.depthAcc = 0; this.depthDirty = false; this.doSort(); }
}
```

### 坑 26 · 大量同类音效必须节流

`AudioSource.playOneShot` 每次都会起一路播放。10 个自动助手同时落地时，一秒能叠几十路。
按「语义 key」做最小间隔节流即可，别按音效名（同一段音效可能被多个语义复用）：

```ts
playThrottled(name: string, key: string, gapMs = 55, volume = 1) { /* 用 key 记时间戳 */ }
```
另外：**自动化的、非玩家触发的动作要静音**（本项目 `Bottle.flip(..., silent)` 会同时关掉音效与粒子），
否则挂机时音效永远在响。

### 坑 27 · 无头软件渲染（SwiftShader）的 fps 不能当性能结论

`chrome --headless --use-angle=swiftshader` 完全是 CPU 光栅化，**填充率**是瓶颈而不是节点数。
本项目在 720×1280 下，粒子数减半 + 去掉每帧 Label 重建后 fps 从 22 → 55，
但这只能说明「优化方向对」，真机数字要在真设备上量。用它做**相对比较**（优化前 vs 优化后）非常有效。

---

## H. 竖屏自适应布局 & 姿态几何（2026-09-22 补充）

### 坑 28 · `restDy` 这类「姿态补偿量」不能顺手加到附属节点上

本项目 `Bottle` 的贴图锚点在瓶底上方 0.34 处（`anchor = (0.5, 0.34)`），
为了让「180° 翻转后瓶底仍落在地面线」，`poseOf('ok')` 给了 `dy = bottleH*0.32`。
影子最初写成 `shadow.y = node.y - SHADOW_DY`（`node.y` 含 `restDy`）→ **正立时影子被抬到瓶身中段、完全被瓶子盖住**，
肉眼看是「瓶子肚子上一块暗斑」，而躺平/倒立（`restDy≈0`）时又正常，极难从截图判断。
**规则：附属件（影子/光环/血条）永远锚在「地面线」= `homeY`，不要锚在会随姿态位移的本体节点上。**
数值自检：正立 `bY - sY` 应为 `restDy + SHADOW_DY`，倒立为 `SHADOW_DY`，躺平为 `|restDy| + SHADOW_DY` 量级。

### 坑 29 · 姿态几何要按「贴图最低点」算，别按节点原点

本体绕锚点转 θ 后，最低点是矩形四个角旋转后的 min y：
`(±w/2, -a·H)` 与 `(±w/2, (1-a)·H)` 转 `θ` 取 min（`a` = 锚点 y 比例，`w/H` = 贴图渲染尺寸）。
本项目 `fail`（±93°）算得最低点在原点下方 `0.234·H`，而地面线在原点下方 `0.34·H`
→ 原来的 `dy = -8` 让躺瓶**悬空 9px**；正确值是 `-(0.34-0.234)·H = -0.106·H`。
**"躺平/倒立看起来能接受" 不代表数值对** —— 用上面的极值公式算一遍，或让脚本打印节点 y 与影子 y 的差。

### 坑 30 · 装饰件必须放进 `WORLD_ENV` 包络，且要「贴住」主体

`applySafeLayout()` 把 `WORLD_ENV` 这团内容整体缩放并垂直居中于上下 UI 块之间。
桌腿最初在桌面板下方 **47px** 悬空、且已超出 `WORLD_ENV.y0` —— 在 9:16 屏上被底部卡片挡住看不出来，
但**超高屏（9:20）舞台按屏宽放大后，板下会空出一段，两块悬空的暗红桌腿就露在空隙里**。
**规则：① 装饰性子节点要贴住主体（腿心 = 主体 bottom - h/2）；② 位置不能超出 `WORLD_ENV`。**
自检：`python` 算一下各比例下 `legTop` 与 `bandBottom` 的关系，或直接在超高屏截图里看。

### 坑 31 · 无头 CDP 视口 ≠ `--window-size`

实测 `chrome --headless=new --window-size=720,1348` → `view.getVisibleSize()` = **720×1280**（差 68px）。
`FIXED_WIDTH` 下 `visibleSize.width` 恒等于设计宽 720，`height = 720 × 视口高/视口宽`。
所以**要拿到目标设计尺寸，窗口高要比目标值 +68**。四比例验收模板见 `.workbuddy/memory/2026-09-22.md`：
`p16 720×1348 / tall 720×1668 / tab 720×1028 / wide 1280×868`。

### 坑 32 · 诊断脚本里 `shadows.children[i]` 和 `bottles.children[i]` 不是同一只瓶子

`BottleField.doSort()` 会 `setSiblingIndex` 按 y 重排**瓶子层**，但影子层不参与排序（也无需排序），
两个数组的索引随即错位。诊断必须走 `b.getComponent('Bottle').shadowNode`，
否则打印出来的 `dy` 是一堆看似随机、实则毫无意义的数（本轮就被误导过一轮）。

### 坑 33 · 固定 `ResolutionPolicy` + 整块容器缩放 = 放弃「UI 上下适配」

`GameRoot` 现在两条路并存，要清楚各自的适用区：
- `s = min(1, vh/1280)` 把 720×1280 设计板整体缩放居中 → **屏幕高度 ≥ 1280 时 s=1 不生效**，
  此时 `hudDY/navDY` 才真正起作用（把顶部/底部 UI 块钉到安全区、中部舞台按剩余带高与屏宽取小者缩放）。
- 屏幕比 9:16 更「宽」时（平板 3:4、桌面浏览器）s<1，**UI 不再上下适配，而是整板缩小 + 左右留黑**。
  这是有意的取舍（保住设计比例），代价是窄屏两侧有黑边；真机竖屏永远是 s=1，走不到这条路。
改这块前先想清楚要哪条路，别两边都改。

---

## I. 运行时 UI 改色 & 面板重绘（2026-09-22 补充）

### 坑 34 · `Color.fromHEX(sp.color, '#..')` 就地改色**静默失效**（本项目最坑的一条）

想让 Sprite/Label 换色，写了 `cc.Color.fromHEX(sp.color, '#FFD75E')` —— **画面完全不变，也不报错**。
根因在引擎的 `Renderable2D`（`cc.d.ts` 可查）：

```ts
get color(): Readonly<Color> { return this._color; }        // ← 返回内部 _color 本体，不是拷贝
set color(value) {
    if (this._color === value) { return; }                 // ← 引用相同 → 直接 return
    this._color.set(value);
    this._updateColor();                                   // ← 真正刷新顶点色，永不执行
}
```

`Color.fromHEX(out, hex)` 是**就地改写** `out`，`out` 就是 `sp.color`（= `_color` 本体）→
引用没变 → setter 提前 return → 顶点色不刷新，**渲染仍是贴图原色**。
更阴的是**读回来是对的**：`sp.color.toHEX()` 会显示新色，所以脚本自检、日志全看不出问题。

**判定性实验**（同屏 A/B，一眼定性）：节点 A 走 `fromHEX(a.color,'#0000FF')` → 渲染仍为贴图底色
`#BAB7A2`；节点 B 走 `sb.color = new cc.Color(0,255,0,255)` → 渲染 `#00B700`（贴图 × 绿）。
结论：**凡是运行时改色，一律赋一个新 `Color`，绝不用 `fromHEX(现色, ...)`。**

本项目统一收口到 `UIKit.tint()`：

```ts
export function tint(r: Sprite | Label, hexStr: string): void {
    const c = hex(hexStr);                 // Core/Util.hex() 每次都 new Color
    const cur = r.color;
    if (cur.r === c.r && cur.g === c.g && cur.b === c.b && cur.a === c.a) { return; }
    r.color = c;                           // 整体赋值 → 引用变化 → setter 生效
}
```

注意范围：**构建期**（`setFrame`/`label`/`roundedPanel` 里直接传色）本来就是新建 Color，没问题；
**只有「拿到对象后再改」的运行时路径**会中招。本项目一口气扫出 30 处，
分布在 7 个 UI 文件（导航高亮、tab 选中态、技能节点 5 态、价格红绿、等级条）——
也就是说**整套 UI 的「动态状态色」此前全部失效**，节点永远停在 `#28303f` 锁定灰蓝。
批量替换用脚本（正则 `Color.fromHEX\((\w+)\.color,\s*` → `tint($1, `）比手改稳，
替换后记得清掉已不再使用的 `Color` import（否则 lint/typecheck 会报未使用）。

### 坑 35 · 小尺寸下木纹按钮贴图显脏 → 换九宫格纯色底 + 统一 `skinBtn`

`ui/btn_long_active` 是木纹「长条按钮」底，被压到 perk 行那种小尺寸（~150×44）时纹理糊成一团灰褐，
且三态（可买/不可买/满级）差异全靠一个 `active` 贴图切换，灰阶上几乎分不出。
对策：按钮底统一换成 `ui/card_white` **九宫格**（`Res.I.slice`，`[26,26,26,26]`）+ 纯色 `tint`，
把「状态」做成**配色表**而不是换贴图：

```ts
type BtnState = 'on' | 'off' | 'max';
const BTN_SKIN = {
    on:  { bg: '#C8A44A', fg: '#1B2334' },  // 金底深字 = 可买
    off: { bg: '#4A3B36', fg: '#E8BDB4' },  // 暗红底浅字 = 买不起
    max: { bg: '#2E6B4E', fg: '#B6F0C6' },  // 绿底 = 已满级
};
export function skinBtn(btn: Node, lb: Label, st: BtnState) { tint(bg, BTN_SKIN[st].bg); tint(lb, BTN_SKIN[st].fg); }
```

九宫格纯色底在任何尺寸都不糊，状态色一眼可辨，也顺带砍掉了几张贴图。

### 坑 36 · 面板「长高后盖住底部导航」——z-order 与 tab 归属要一起改（**2026-09-23 已作废，见坑 37**）

> 历史记录：抽屉从 430 长到 600 时，`drawerLayer` 渲染顺序在 `navRoot` **之上**，展开态直接糊在底部导航条上，
> 当时的解法是「tab 挪进抽屉头部 + 打开时 `navRoot.active = !o`」。
> **2026-09-23 用户要求「UI 一律从屏幕中间 Q 弹出现、收起是缩放回去」后，升级面板已改成居中模态卡，
> 底栏不再被盖住 → `navRoot.active` 那套已删除，只保留高亮同步**。此坑仅作「z-order 与交互归属要一起考虑」的案例保留。

---

## J. 面板出场动效：中央 Q 弹 + 缩放消失（2026-09-23 定稿）

> 用户明确要求：**任何面板都不许从下方滑入，要「Q 弹中间出现」，隐藏时「缩放回去」**。
> 全部收敛到 `UI/UIKit.ts` 的 4 个函数，别在业务代码里手写 tween。

```ts
/** Q 弹弹入：0.72 → 过冲 1.07 → 回落 1 */
export function popIn(n: Node, dur = 0.32) {
    clearPopTween(n);
    n.setScale(0.72, 0.72, 1);
    tween(n).to(dur * 0.58, { scale: new Vec3(1.07, 1.07, 1) }, { easing: 'backOut' })
            .to(dur * 0.42, { scale: new Vec3(1, 1, 1) },     { easing: 'sineInOut' }).start();
}
/** 缩放消失：1 → 0.78 + 淡出 → 回调（默认 destroy） */
export function popOut(n: Node, dur = 0.16, onDone?: () => void) { /* 同时 tween scale 与 UIOpacity */ }
```

### 坑 37 · 位移滑入 → 缩放弹出的三个必改点

1. **遮罩绝不能跟着缩放**。整屏遮罩必须单独一个节点、只做 `maskIn/maskOut` 透明度；
   若和面板一起 `popIn`，画面会像「整屏黑幕涨大」。
2. **面板节点必须先 `active = true` 再起 tween**：tween 挂在非激活节点上不执行，
   表现为「点了没反应」（本项目 Drawer 改成 `active=false` 收起后立刻踩到）。
3. **居中定位与自适应层解耦**。`drawerLayer` 原本跟着 `navDY` 贴底，模态卡居中后必须把该层钉回 `(0,0)`；
   模态遮罩尺寸也不能写死 `900×1500` —— 宽屏（s<1，可见设计宽 1800+）与超高屏（vhE>1600）都会露出没压暗的边缘。
   对策：`UIKit.MASK_SIZE` 由 `applySafeLayout()` 按 `vwE/vhE` 动态写入。

### 坑 38 · `popOut` 会把 `UIOpacity` 复位成 255 → 对「已经淡到 0」的节点用会闪一下

`clearPopTween()` 的职责是让动画可被打断（连点导航时 `popIn`/`popOut` 互踩会出现「弹一半就消失」），
所以它把 opacity 强行拉到 255。**若节点此刻已经是 0（例如 Toast 的停留结束），再调 `popOut` 会先闪一帧**。
Toast 这类「自己控制全生命周期」的物件要**内联**写缩放+淡出，不要复用 `popOut`。

### 坑 39 · 无头脚本里 `window.cc` 没有全部类，且 `__tb` 暴露的是类不是实例

- `window.cc` 在构建产物里**不含** `cc.UITransform` / `cc.UIOpacity`（`cc.view` / `cc.director` 有）→
  诊断脚本一律用字符串形式 `n.getComponent('cc.UITransform')`，否则 `getComponent: Type must be non-nil`。
- `(globalThis as any).__tb = { field: BottleField, drawer: Drawer }` 暴露的是**类**，实例在静态字段：
  `__tb.field.I` / `__tb.drawer.I`。

### 坑 40 · 用「采样缩放曲线」而不是截图来验证弹感

截图抓不到 0.3s 的过冲（驱动脚本每条指令额外 `pump(0.25)`，等拍到时动画早结束）。可靠做法是让页面自己采样：

```js
window.__SAM = [];
window.__SAMPLE = function (fn, ms) {
    var t0 = performance.now(); window.__SAM = [];
    (function tick() {
        var n = __F('cardUI');
        if (n) window.__SAM.push(Math.round(performance.now() - t0) + ':' + n.getScale().x.toFixed(3));
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
    })();
    fn();                       // 先开采样，再触发动画
    return 'go';
};
```

实测输出 `0:1.000, 43:0.720, 107:1.104, 174:1.075, 230:1.058, 286:1.015, 339:1.000`
→ 0.72 起步、峰值 1.104、340ms 收敛，Q 弹成立。
**顺带一个免费的自证手段**：关闭后的截图与基线截图**字节数完全相同**，说明遮罩与卡片确实收干净了（没有残留压暗）。
对应脚本：`E:\LDC_Fby\_testui.tpl` + `_runui.py`（四比例）。

---

## K. 全屏/大尺寸「状态特效」是遮挡重灾区（2026-09-23）

### 坑 41 · 把「范围半径」直接用大贴图当指示器 → 一只巨手糊在游戏区中间

`BottleField` 的光标原来这样写：

```ts
this.cursor = nd(this.node, 'cursor', 76, 76, 0, -999);
setFrame(sp, 'env/cursor', 76, 76);
const r = 70 * G.cursorSize;      // 升级后 r 最大 154
setSize(this.cursor, r * 2, r * 2);   // ← 把「手指」贴图拉到 308×308
```

用户截图反馈「这么大的图挡住游戏了」。**范围/光圈绝不能用「语义贴图放大」来表达**，正确做法是拆两层：
容器（只负责跟随手指）→ 子节点 `ring`（`env/areacircle` 这类纯圆，低 opacity 当范围）+ `pin`（固定 60px 的手指指针）。
容器记得 `setSiblingIndex(0)` 压到瓶子层之下当地贴，`Modal.open` 时整体隐藏。

同类问题：**状态特效挂在 UI 层又摆在游戏区**。本项目狂暴火焰 220×290 摆在 `(-230, navY+250)`、处决刀 700×900 铺满屏，
都把桌面和瓶子盖住了。收敛原则：
1. 尺寸只比触发它的按钮大一圈（104×104 的按钮 → 特效 ~170×220）；
2. 位置每帧跟随按钮（能力条会按解锁数量重排，`btn.position.x`）；
3. **`setSiblingIndex(0)` 排到所有 UI 之下** —— 特效只会从按钮四周的缝隙透出来，永远不会盖住任何东西。
   注意代价：底部 UI 很密（快捷卡 / 能力条 / 体力条 / 导航四层），可透出的可视窗口只有 ~120px 高，
   想要「大字大图」型的指示就老实放到 HUD 文字行里，别指望一个巨幅贴图。

### 坑 42 · `CocosCreator.exe --build` 的 exit code 会骗人（有编辑器会话在跑时）

命令行构建返回 **exit 36**，日志里出现：

```
Error: Exit process with code:null, signal:SIGTERM in task build-script
```

但同一份日志结尾是 `build Task (web-mobile) Finished in (15 s)`、`Asset DB is resume!`，
**产物其实已经写好**（连注释都在，因为 debug 构建不压缩）。
诱因：本机同时开着**手动启动的 Cocos 编辑器会话**（它占住 `127.0.0.1:3000` 的 MCP 端口，
日志里表现为 `[cocos-creator-mcp] Auto-start failed: listen EADDRINUSE`），两个实例抢 asset-db / 编译子进程时被打 SIGTERM。

**判定构建成功的正确口径**（别只看 exit code）：
```python
s = open('build/web-mobile/assets/main/index.js', encoding='utf-8', errors='replace').read()
for k in ['env/areacircle', '#FF9678']:      # 换成本次新增的独有字符串
    print('OK  ' if k in s else 'MISS', k)
```
再加日志里的 `Finished`；两条都对就是成功。日志文件在 `.workbuddy/build_last.log`。

---

## L. 模态面底色 & 滚动区几何（2026-09-23 第三轮）

用户原话是「**文本层级貌似被挡住了**」——听着像 z-order，实际是两个独立成因，
两个都得量化才能定位，别靠肉眼猜。

### 坑 43 · 模态面板底色留了 3% 透明 → 背后 HUD 文字/图标透出来

`roundedPanel(root, w, h, x, y, '#171E2BF7', ...)` —— alpha `F7` = 247 = 96.9%。
剩那 3% 正好够背后 HUD 的金色金额、设置/奖杯图标变成一层鬼影，
看起来就是「面板里还有一层文字被压住了」。

定位手法（可复用）：
1. 把面板内部那块区域裁出来放大 3 倍，鬼影肉眼可见；
2. 逐行取样 `ImageStat.Stat(im.crop((x, y, x+70, y+4))).mean`，
   鬼影行比干净底高 **+6~10 灰阶**（3% × 亮字 ≈ 这个量级）。

规矩：**模态面板/弹窗底色一律 6 位 hex（alpha=FF）**，遮罩用 `#000000C8` 左右。
只有「盖在游戏画面上、本来就想半透」的元素（HUD 条、快捷购买卡）才允许留 alpha。

### 坑 44 · ScrollView 视口下沿切在节点文字上（「内容被挡住」的另一种成因）

节点是**按固定步长排格**的：节点中心距内容顶 `P = padTop + NODE_SIZE/2`，
相邻行中心相距 `NODE_STEP_Y`。视口下沿若切在节点中心下方一点点，
就会**从节点名称文字中间划过去**——用户看到的就是「文字被挡了一半」。

判据：要让下沿落进行间隙，必须
```
SCROLL_H ≡ P + NODE_STEP_Y / 2   (mod NODE_STEP_Y)
```
本项目 `padTop=84 / NODE_SIZE=112 / STEP_Y=124` → `P=140` → 需 `SCROLL_H ≡ 78`。
原来写死 620，而 `620 mod 124 = 0`，节点中心 ≡ 140 ≡ 16 (mod 124) →
下沿永远切在节点中心下方 **16px**，正是名称那行。

**两个动作一起做才有效**：
1. 改 `SCROLL_H` 满足上面的同余式（本例 620 → 574）；
2. 初始 `sv.scrollToOffset()` 的 offset **对齐到 `NODE_STEP_Y` 的整数倍**，
   否则任意 offset 又会把节点切在别处。

自检：dump 每个节点的世界 Y 与视口下沿，最近的一个应当是「整行都在下沿之上」。

### 坑 45 · 滚动列表没有指示条 → 用户不知道下面还有内容

`ScrollView` 默认不画滚动条。做法是给 `UIKit.scrollView()` 加一条，
挂在 **`parent`**（视口外）而不是 view 里面：既不参与滚动，也不会被 Mask 裁掉。
用一个每帧只比对 `content.height` 与 `sv.getScrollOffset().y` 的小 Component 驱动，
变了才重排 —— 零调用点改动，重建内容（Wizard/分页）也不用通知它。

```ts
@ccclass('UIScrollBar') export class UIScrollBar extends Component {
  sv: ScrollView = null!; content: Node = null!; thumb: Node = null!;
  trackH = 0; viewH = 0;
  private lastH = -1; private lastOff = -999;
  update() {
    const ch = this.content.getComponent(UITransform)!.height;
    const off = Math.round(this.sv.getScrollOffset().y);
    if (ch === this.lastH && off === this.lastOff) { return; }
    this.lastH = ch; this.lastOff = off;
    if (ch <= this.viewH + 2) { this.thumb.active = false; return; }
    this.thumb.active = true;
    const th = Math.max(36, this.trackH * (this.viewH / ch));
    const span = this.trackH - th;
    const t = Math.max(0, Math.min(1, off / Math.max(1, ch - this.viewH)));
    this.thumb.setPosition(0, span / 2 - t * span, 0);
  }
}
```

⚠️ 指示条是 `parent` 的兄弟节点：**谁 override 了滚动区的 Y，谁就要顺手把指示条搬过去**
（`frame.getChildByName('sbar')`），否则视口移动时指示条留在原地。

### 坑 46 · 固定尺寸卡片里塞长文本：先挤死，再溢出，最后被裁

同一个症状（「文字像被挡住」）在固定尺寸卡片里有三种表现，按顺序排查：

| 现象 | 数量级 | 修法 |
|---|---|---|
| 图标/角标压住文字 | 几 px 重叠 | 重排纵向预算，三段首尾相接 + 留 1~2px 缝 |
| 长名被 `overflow:'shrink'` 缩成蚂蚁字 | 字号被压到 <11px | 名字压到 ≤ `盒宽/字号` 个汉字；实在要长就在文案里用 `\n` 手动断行（Label 认 `\n`），并把名称盒高度做成两行 |
| 末字（如收尾的「）」）被挤到第二行当孤字、或被卡片下沿/描边切掉 | 溢出 1 行 | 加宽描述盒 + 加高行高；滚动区下沿再往内收 `bottomPad`，别让卡片描边正好压在行的中段 |

单行展示同一份文案时（信息条）记得 `.replace(/\n/g, ' ')`。

---

## M. 「指针/光标」类 UI：层级 & 输入路由（2026-09-23 第四轮）

症状一句话就能概括：「解锁后图片不在上层、被挡住了、也没出现在手指点击处」——
**三个独立成因**，别当成一个 bug 猜。

### 坑 47 · 指针类节点要按用途拆层级，别整块 `setSiblingIndex(0)`

一个「手指 + 范围圈」的光标，两部分的层级需求是**相反**的：

| 部件 | 用途 | 层级 |
|---|---|---|
| 范围圈 | 地面落点指示 | `setSiblingIndex(0)`，压在影子/物体**之下** |
| 手指指针 | 指针本体 | 追加到子节点**末尾**，永远在最上 |

原来两者共用一个容器、整容器 `setSiblingIndex(0)`，手指跟着一起沉到瓶子层下面 → 被挡住。
改成两个独立节点，各管各的索引即可。

自检（无头脚本）：
```
kids=cursorRing#0,shadows#1,bottles#2,label#3,cursorPin#4
ring sib=0 / pin sib=<children.length-1>
```

### 坑 48 · 投影必须做成**子节点**：同节点的 Sprite 先画、子节点后画

想给指针加一层黑影，如果写成「pin 自己的 Sprite + 一个 shadow 子节点」，
子节点会**盖在**父节点自己的 Sprite 上 —— 实测整只手被染成灰色。
Cocos 的 UI 渲染是深度优先：**节点自身的渲染组件先执行，子节点后执行**。
正确结构 = 无渲染的容器 + 阴影子节点 + 本体子节点（顺序即层序）。

### 坑 49 · 桌面浏览器的「按下」不是 `TOUCH_START`（`input` 级）

`input.on(Input.EventType.TOUCH_MOVE)` 能收到鼠标拖动，但**鼠标按下派发的是
`MOUSE_DOWN`、不是 `TOUCH_START`**。所以只监听 `TOUCH_MOVE` 的指针逻辑在桌面上会表现为
「拖动才动、只点不拖完全不动」。

而且 **节点级 `TOUCH_START` 会被子节点截断**：`Bottle.enableTouch` 里
`e.propagationStopped = true`，点在瓶子上时事件不会冒泡到父节点。
所以「按下即定位」必须同时在 `input` 级接 `MOUSE_DOWN` + `TOUCH_START`：

```ts
const aimTouch = (e: EventTouch) => this.aim(e.getUILocation().x, e.getUILocation().y);
const aimMouse = (e: EventMouse) => this.aim(e.getUILocation().x, e.getUILocation().y);
this.node.on(Node.EventType.TOUCH_START, aimTouch, this);   // 空白处按下 / 真机触摸
this.node.on(Node.EventType.TOUCH_MOVE,  aimTouch, this);
input.on(Input.EventType.TOUCH_START,   aimTouch, this);    // 真机
input.on(Input.EventType.TOUCH_MOVE,    aimTouch, this);
input.on(Input.EventType.MOUSE_DOWN,    aimMouse, this);    // 桌面按下
input.on(Input.EventType.MOUSE_MOVE,    aimMouse, this);    // 桌面跟随
```

### 坑 50 · 坐标映射先验证，再改代码（本例映射本来是对的）

`e.getUILocation()` + `UITransform.convertToNodeSpaceAR()` 是否匹配，**取决于本工程的
UI 世界原点位置**，不要凭记忆下结论。一行探针就能判定：

```js
ut.convertToNodeSpaceAR(node.getWorldPosition())   // ≈ (0,0) 说明「世界坐标」就是这个空间
```
若结果 ≈ (0,0)，则 `convertToNodeSpaceAR(getUILocation())` 正确；
若 ≈ (−W/2, −H/2)（半屏），才需要先加半个可见尺寸。
（本项目实测 = (0,0)，即 UI 世界原点就在可见设计区左下角。）

### 坑 51 · 让「指尖」而不是「贴图中心」落在触摸点

指针贴图的笔尖通常不在中心。用 PIL 量最上面几行不透明像素的重心：

```python
xs = [x for y in range(miny, miny+6) for x in range(W) if px[x, y][3] > 16]
tipx = sum(xs)/len(xs)
# anchor(0.5,0.5) 下，笔尖相对中心的偏移（本地坐标，+y 朝上）
ox, oy = tipx - W/2, H/2 - miny
```
然后 `pin.position = pointer + (−ox, −oy)`（按贴图显示尺寸等比换算）。
本项目 `env/cursor.png` 73×78 量得 `(−0.048, +0.487)`，原来只摆 `(0,-6)`，
笔尖比触摸点高约 23px —— 这也是「没出现在点击处」的一部分。

### 坑 52 · 「点物体」和「点空白」用同一套事件会翻倍触发

如果物体（这里是一张卡片/瓶子）在 **TOUCH_START** 里自己做响应并 `propagationStopped = true`，
而父容器把「空白处点击」的逻辑挂在 **TOUCH_END** 上，那么点物体就会**两条路都走**：

```
点瓶子 → 瓶子的 TOUCH_START 触发（翻转 + 阻断冒泡）
       → TOUCH_END 没有那层阻断，冒泡到父容器 → 「空白处」逻辑再随机翻一只
       = 一次点击翻两只
```

**规矩：父容器判断「是否点在空白处」要用与子节点同一个阶段（TOUCH_START）**，
这样 `propagationStopped` 才能真正把它挡住。顺带响应也从「抬手」提前到「按下」，更跟手。

自检（无头）：给个计数器，单次点击前后各读一次；`+2` 就是踩了这个坑。

### 坑 53 · 「建得早 = 画得早」——特效/飘字层被后来建的内容压住

2D UI 的绘制顺序 = 父节点下**子节点的数组顺序**（后加的画在上面），而不是任何 z 值。
所以「在 `onLoad` 里建层、在后面的 `build()` 里建内容」这个很自然的写法会直接错位：

```
onLoad():      worldLayer.addChild(fxLayer)          // fx 先来 → index 0
buildWorld():  worldLayer.addChild(table)            // 桌子后到 → index 1 → 画在 fx 之上
结果：worldLayer.children = fxLayer#0, table#1, bottles#2, caps#3
      → 所有飘字（+$N / MISS / 扣盖）全被桌面挡住，一个都看不见
```

判据（一行就够）：
```js
worldLayer.children.map((c, i) => c.name + '#' + i).join(',')
```

修法：**等所有内容都 addChild 完之后，再把这个层顶到末尾**：
```ts
this.fxLayer.setSiblingIndex(this.worldLayer.children.length - 1);
```

通用规则：任何「容器/特效层」都不要在 `onLoad` 里建完就以为完事了 ——
只要还有人会往同一个父节点 `addChild`，就要在全部建完之后重新排序一次。

**验证时的坑（会骗人）**：`FxLayer.floatText` 的默认参数是 `dur=0.85`、`fadeStart=0.42`，
即**只有前 0.36 秒是满不透明**，之后一路淡出。抓帧要卡在「落地后 0.2~0.4s」，
抓晚了会看到空白并误判成「根本没渲染」。更稳的做法是直接调一次
`floatText(x, y, 'TEST', '#B7F7A6', 30, 82, 4.0)`（把时长拉到 4 秒）再截图 —— 与真实调用同一个 API，
不受动画时序影响。

### 坑 54 · 节点 `UITransform` 和「看得见的图」不一致 → 点击打空 / 点 A 却影响 B

`UITransform` 的尺寸就是**点击命中矩形**，但它跟子节点里那张 Sprite 的尺寸没有任何绑定关系。
典型错法（本项目真实踩过）：

```ts
const n = nd(parent, 'bottle' + tier, 100, 200, x, y);      // 命中框：100×200（再乘 node.scale）
const bn = nd(n, 'art', 150, 375, 0, 0, 0.5, 0.34);         // 看得见的瓶身：150×375
```

缩放后命中框只有 53×107 世界单位，而瓶子是 80×200 —— **点瓶口、点瓶底全部打空**。
如果这时场地还挂着「空白处按下 → 随机处理一个」的兜底逻辑，就变成
「**点 A 结果 B 有反应**」这种极难从代码上看出来的手感 bug。

**两条口径**：
1. 想让节点自带事件准：把 `UITransform` 尺寸/锚点设成与那张 Sprite 一致
   （`nd(parent, name, ART_W, ART_H, x, y, 0.5, ART_AY)`）—— 改尺寸/锚点不会移动既有子节点，安全。
2. 想要「矩形重叠时互不阻挡 / 可穿透」，就别用节点事件（它只会派给最上层那个），
   改在父层自己做命中：
```ts
hitTest(worldX: number, worldY: number): boolean {   // 放在物体自己的组件里
    const ut = this.node.getComponent(UITransform)!;
    const p = ut.convertToNodeSpaceAR(tmpVec3(worldX, worldY));   // 逆矩阵，旋转/缩放自动算进去
    return p.x >= -ART_W * 0.5 && p.x <= ART_W * 0.5
        && p.y >= -ART_H * ART_AY && p.y <= ART_H * (1 - ART_AY);
}
```
父层遍历所有物体，**命中的全部处理**，就得到「不阻挡 / 穿透」的手感。

**两个配套的坑（会让改动直接失效）**：
- 存指针坐标的 `aim()` 里**不要**带任何「功能是否解锁」的 gate（如 `if (!hasCursor) return;`）——
  指针同时是点击命中的输入源，带了 gate 会导致未解锁时**点击整个失灵**（表现为计数器恒为 0）。
- 指针坐标是**父节点本地坐标**（悬停半径判定用），而 `convertToNodeSpaceAR` 要**世界坐标**，
  中间差着父节点自身的位移/缩放 → 必须先 `ut.convertToWorldSpaceAR(tmp)` 换算一次。

---

## G. 卡住时的求助顺序

1. `cc.d.ts` grep（API 存疑 100% 靠这个，别猜）。
2. `assets/Scripts/` 里找既有同类实现，抄它。
3. `.workbuddy/memory/` 里的历史日志（本项目以前的决策与踩坑）。
4. `read_console` 抓运行时报错。
5. 实在不确定才问用户——优先自己验证。

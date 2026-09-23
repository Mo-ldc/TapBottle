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
| 6 | `UI/DrawerContent.ts` | `BottleStatDef` 无 `base` 字段却被读 → 词条描述全 NaN | ✅ 已修（落地成功率改为叠加在 `TIERS[tier].success` 上） |

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

### 坑 36 · 抽屉面板「长高后盖住底部导航」——z-order 与 tab 归属要一起改

抽屉从 430 长到 600 后，`drawerLayer` 的渲染顺序在 `navRoot` **之上**，展开态直接糊在底部导航条上。
只调 `drawerY` 没用（位置对了，但导航还被盖着）。正确做法是**双管齐下**：
① 把 tab（瓶子/助手）从底部导航**挪进抽屉自己的头部**（面板内可点，不依赖被盖住的导航）；
② 打开/关闭时隐藏导航：`this.drawer.onOpenChanged = (o) => { this.navRoot.active = !o; ... }`。
自检用无头脚本读 `navRoot.active` 与 `drawer.position.y`：开 `-288 / nav=false`，关 `-856 / nav=true`。
（另：抽屉变高要同步调 `LAYOUT.drawerOpenY/drawerClosedY` 与 `drawerH`，三者是一组。）

---

## G. 卡住时的求助顺序

1. `cc.d.ts` grep（API 存疑 100% 靠这个，别猜）。
2. `assets/Scripts/` 里找既有同类实现，抄它。
3. `.workbuddy/memory/` 里的历史日志（本项目以前的决策与踩坑）。
4. `read_console` 抓运行时报错。
5. 实在不确定才问用户——优先自己验证。

# 工程地图 · TapBottle（点瓶子·竖屏）

Cocos Creator 3.8.8 / 纯 2D / 竖屏。**设计分辨率 1440×2560（2K），创作空间 720×1280（`DS=2`）**
——所有布局常量与预制体都按 720×1280 书写，gameRoot/uiRoot 统一 `scale = sA×DS`。
原型是 Unity 的 *Bottle Flip Inc*，玩法为「点击瓶子翻转 → 赚金币 → 买更高档瓶子 / 技能 / 助手 / 能力 → 瓶盖机器」。

**架构（2026-09-24 起）**：已全面从「代码生成 UI」迁到「场景实体化 + Prefab + 编辑器可调」。
旧的运行时 `Graphics` 建树写法全部作废，新界面一律走 `Prefabs/UI/<Name>.prefab` + `UIMgr`。

**目录规范（2026-09-24 第二次重组）**：按**资源类型**归位，不再按界面分目录——
预制体进 `resources/Prefabs/`、脚本进 `assets/Scripts/`、贴图进 `resources/Textures/`，各自再分类。

## 目录职责

```
TapBottle/
├─ assets/
│  ├─ Scenes/                    Boot/Boot.scene（引导）→ Load.scene（预载）→ Game.scene（主场景）
│  ├─ resources/                 ★ 动态加载的根（resources.load 只能读这里）
│  │  ├─ Textures/               （PNG8 压过，单张<200K）
│  │  │  ├─ bottle/ env/ stat/ ability/
│  │  │  └─ ui/                  ★ UI 贴图八分类
│  │  │     ├─ nine/    九宫格底材（可整体 tint）
│  │  │     ├─ panel/   面板/卡片/底板/占位
│  │  │     ├─ button/  按钮三态与选中态
│  │  │     ├─ icon/    图标 / logo / 箭头 / 圈
│  │  │     ├─ bar/     进度条与色条
│  │  │     ├─ deco/    木牌装饰条（banner / rail）
│  │  │     ├─ pixel/   纯色占位方块
│  │  │     └─ misc/    其他
│  │  ├─ Audio/*.mp3             13 个音效/BGM（原 wav 已转 mp3）
│  │  ├─ Fonts/NotoSansSC-Bold.ttf
│  │  ├─ Text/{zh,en}.json       本地化文案（Locale.ts 读）
│  │  └─ Prefabs/                ★ 预制体总目录（`Prefabs.make('Game/Bottle')` / `UIMgr` 按名加载）
│  │     ├─ Game/{Bottle,BottleShadow}.prefab
│  │     └─ UI/{StartPage,SettingDialog,StatsDialog,AchDialog,OfflineDialog,ConfirmDialog}.prefab
│  └─ Scripts/
│     ├─ GameRoot.ts             ★ 唯一入口：装配各层、加载资源、alignCanvas/applySafeLayout、帧循环
│     ├─ Core/
│     │  ├─ GameConfig.ts        ★ 全部数值：DESIGN_W/H(1440×2560)、AUTHOR_W/H(720×1280)、DS、TIERS、SKILLS、LAYOUT…
│     │  ├─ AutoNodeScale.ts     ★ **唯一的适配组件**（父宽高比等比缩放，见 pitfalls 坑 55/56）
│     │  ├─ State.ts             ★ 运行时状态单例 G + 派生数值 getter + 操作 + 成就 + 存档
│     │  ├─ Save.ts / Locale.ts / Util.ts
│     │  ├─ Res.ts               ★ 资源与音频单例 Res.I：sf() / slice() / play() / music() / loadAll()
│     │  ├─ UIMgr.ts             ★ 页面/弹窗管理器（pageRoot/dialogRoot/tipRoot + 按需 load prefab + 并发去重）
│     │  ├─ Prefabs.ts / Pool.ts 预制体清单（随 Res 预加载 + make 实例化）/ 对象池
│     ├─ UI/                     ★ UI 脚本总目录（按职责分层，依赖单向：Base ← Widgets ← Hud/Panels ← Pages/Dialogs）
│     │  ├─ Base/                UIBase / UIKit / Theme / Modal / Toast / Ads   （基础设施：基类·工厂·皮肤·模态·提示·广告接入）
│     │  ├─ Widgets/             AdButtons / UpgradeRows / AchRow / LocLabel / StatRow / StepperRow / ToggleRow
│     │  ├─ Hud/                 Hud / BottomPanel / Guidance                   （主界面：顶栏·底栏·购买引导）
│     │  ├─ Panels/              Panel / AchPanel / SettingsPanel / StatsPanel  （内嵌面板体系，openXxx(parent)）
│     │  ├─ Pages/StartPage.ts   页面（全屏）
│     │  ├─ Dialogs/*.ts         SettingDialog / StatsDialog / AchDialog / OfflineDialog / ConfirmDialog
│     │  └─ _legacy/UIFit.ts     已退役，仅供回溯（适配改由 AutoNodeScale + Widget 承担）
│     └─ Game/                   Bottle / BottleField / HelperHands / CapMachine / Abilities / Fx / Load
├─ extensions/cocos-creator-mcp/ 编辑器 MCP 扩展（见 editor-mcp.md）
└─ .workbuddy/
   ├─ skills/cocos-3.8.8/        ← 你正在看的
   ├─ memory/                    逐轮工作日志 + MEMORY.md（长期口径）
   ├─ prefab_bak/ reorg_bak/     改动前的 .scene/.prefab 备份 / 目录重组前的资源备份
   ├─ texture_src/ audio_src/    压缩/转码前的原始资源
   └─ tools/                     typecheck.py / check_prefab.py / scan_cid.py / fit_prefabs.py / fit_game_scene.py / reorg_ui.py / cocos_mcp.py
```

## 适配层（改布局前先读这条）

「Widget 负责平铺、AutoNodeScale 负责等比缩放」，两边结构严格对称：

| 层 | 节点 | 组件 |
|---|---|---|
| 游戏 | `Canvas` → `GameRoot` | `cc.Widget(alignFlags=45)` 平铺整个摄像机可见区 |
| 游戏 | `GameRoot` → `gameRoot` | `UITransform` 720×1280 + **AutoNodeScale**（等比缩放居中） |
| 游戏 | `GameRoot` → `uiRoot` | `cc.Widget(45)`，1:1 平铺（**不**缩放）→ 下挂 PageRoot/DialogRoot/TipRoot（各自 Widget 45）|
| UI | `<Name>` 预制体根 | `cc.Widget(45)` 跟随画布平铺 |
| UI | `<Name>` → `mask` | `cc.Widget(45)` 跟随父节点铺满 |
| UI | `<Name>` → `fit` | `UITransform` 720×1280（美术默认分辨率）+ **AutoNodeScale** |

等价性：父节点铺满可见区时 `AutoNodeScale` 的 `min(父宽/720, 父高/1280) ≡ 旧的 sA×DS`。
⚠️ `cc.Canvas` 不会自己把节点尺寸同步成可见区，`GameRoot.alignCanvas()` 里手工补——**详见 pitfalls 坑 55**。


## 单例清单（都靠 `static I`，`onLoad` 赋值，用时判空）

| 单例 | 位置 | 关键成员 |
|---|---|---|
| `G` | Core/State.ts | `G.data`（存档）、`G.notify()` / `addListener()`、`tierIncome(t)`、`doFlipResult(t, opts)`、`buyBottle/buyHand/buyMachine/upgrade(id)`、`applyOffline()`、`save()/reset()`、大量派生 getter（`maxBottles`/`successChance`/`flipSpeedMul`…） |
| `Res.I` | Core/Res.ts | `sf(path)` → SpriteFrame、`slice(path,l,r,t,b)`、`play(name,v)`、`playRand([...],v)`、`music(on,v)`、`masterScale`、`font`、`loadAll(cb)` |
| `FxLayer.I` | Game/Fx.ts | `floatText(x,y,text,color,size,dy,dur)`、`burst(x,y,n,tier)`、`shockwave(x,y,maxR,dur,color)`、`sparkle(x,y,size,color)`、`flash(color,alpha,dur)`、`shake(amp,dur)` |
| `Toast.I` | UI/Base/Toast.ts | `show(msg,color)`、`achievement(id)` |
| `Modal` | UI/Base/Modal.ts | `push()` / `pop()` 模态栈 |

## `UIKit.ts` 工厂函数（加界面就用这些，别自己 new Node）

```ts
nd(parent, name, w, h, x=0, y=0, anchorX=0.5, anchorY=0.5): Node      // 带 UITransform 的节点，绝对坐标
setFrame(sp, path, w?, h?, color?): Sprite                            // ★ 唯一的「安全赋图」入口（CUSTOM+trim=false+兜底 setContentSize）
tint(r: Sprite|Label, hexStr: string): void                           // ★ 唯一的「运行时改色」入口（新建 Color 再整体赋值；禁用 fromHEX 就地改色，见 pitfalls 坑 34）
img(parent, path, w, h, x, y, color?): Sprite                         // 图 = nd + Sprite + setFrame
rect(parent, w, h, x, y, color, name='rect'): Node                    // 纯色块（4x4 白点拉伸）
sliced(parent, path, w, h, x, y, inset:[l,r,t,b], color?, name?): Sprite  // 九宫格（设 SpriteFrame.inset*）
label(parent, text, x, y, w, h, o?: LabelOpts): Label
button(parent, o: BtnOpts): Node                                       // Sprite(SLICED)+Label+按下缩放+音效
roundedPanel(parent, w, h, x, y, fill, radius=24, stroke?, strokeWidth=4, name='panel'): Node  // Graphics 画圆角
bar(parent, w, h, x, y, fillColor, bgColor='#1A2030'): { root, fill, set(p) }   // 进度条
modalMask(parent, onClickOutside?): Node                               // 半透明遮罩 + BlockInputEvents
fadeIn(n, dur=0.18) / popIn(n, dur=0.22)
scrollView(parent, w, h, x, y): { root, content, sv }                  // 竖向滚动 + GRAPHICS_RECT 遮罩
stretch(n, l, r, t, b) / vlayout(n, spacing, paddingTop) / destroyChildren(n)
sizeOf(n) / setSize(n, w, h) / setAnchor(n, ax, ay) / WHITE
```

`LabelOpts`：`size, lineHeight, color, hAlign('left'|'center'|'right'), vAlign('top'|'center'|'bottom'), bold, overflow('none'|'clamp'|'shrink'|'resize'), outline, outlineWidth, anchorX, anchorY`
`BtnOpts`：`w,h,x,y, tex?, texColor?, inset?, text?, fontSize?, textColor?, textY?, onClick?, sound?, scale?, disabled?, name?`
（`sound: null` 表示这个按钮不播音效；默认播 `click2`）

## 路径约定（最容易错的地方）

| 场景 | 写法 |
|---|---|
| `Res.I.sf()` / `setFrame()` / `img()` | `'bottle/body_0'`、`'ui/px_white2'`、`'stat/income'` —— 相对 `assets/resources/Textures/`，**不带扩展名** |
| `TEXTURE_PATHS` / `resources.load()` | `'Textures/bottle/body_0/spriteFrame'` —— 带 `/spriteFrame` 后缀 |
| 音频 | `Res.I.play('click2')` → 内部查 `'Audio/click2'` |
| 字体 | 已由 `Res.I.font` 持有（`Fonts/NotoSansSC-Bold`），`label()` 自动套用 |

> 新增贴图后必须**同时**把它加进 `Res.ts` 的 `TEXTURE_PATHS`，否则 `Res.sf()` 返回 `null`，图是空的但不报错。

## 已匹配的原始资源（写新功能前先查这些能不能复用，别急着让用户补图）

`Textures/ui/` 有：`px_white`、`px_white2`（纯白，用于色块/闪光）、`px_circle`、`px_dot`、`card` / `card_dark` / `card_white`、`round_rect` / `round_soft`、`panel_wood` / `panel_deco`、`btn_*` / `btn2_*` 多色态、`circle_ring` / `circle_outline`、`bar_bg` / `bar_fill` / `bar_fill2` / `color_bar`、`slot` / `slot_hover`、`list_select`、`wood_tab`、`icon_*`（gear / shop / skill / stat / ach / save / hand / upgade…）、`x_*`、`arrow_l/r`、`gam_icon`、`bg_placeholder`、`sq_brown/grey`、`icon_cross`、`icon_star2`。
`Textures/env/`：`table` / `table_leg_l/r`、`belt` / `belt_frame` / `belt_leg_l/r`、`machine`、`container`、`disc`、`fog`、`vignette`、`hand`、`cursor`、`star`、`shockwave`、`areacircle`、`recycle`。
效果层优先复用 `env/star`、`env/shockwave`、`env/disc`、`ui/px_white2`。

# 工程地图 · TapBottle（点瓶子·竖屏）

Cocos Creator 3.8.8 / 纯 2D / 竖屏 720×1280 / **无 Prefab、无美术拖拽，UI 全代码构建**。
原型是 Unity 的 *Bottle Flip Inc*，玩法为「点击瓶子翻转 → 赚金币 → 买更高档瓶子 / 技能 / 助手 / 能力 → 瓶盖机器」。

## 目录职责

```
TapBottle/
├─ assets/
│  ├─ Scenes/Main.scene          只有一个 Canvas + GameRoot 组件，其余全部运行时生成
│  ├─ resources/                 ★ 动态加载的根（resources.load 只能读这里）
│  │  ├─ Textures/{bottle,env,stat,ui,ability}/xxx.png
│  │  ├─ Audio/*.wav             13 个音效/BGM
│  │  └─ Fonts/NotoSansSC-Bold.ttf
│  └─ Scripts/
│     ├─ GameRoot.ts             ★ 唯一入口：建 6 个层、加载资源、装配世界与 UI、帧循环
│     ├─ Core/
│     │  ├─ GameConfig.ts        ★ 全部数值：DESIGN_W/H、TIERS、SKILLS、ACHIEVEMENTS、LAYOUT、ABILITY、HAND、MACHINE、SAVE_KEY
│     │  ├─ State.ts             ★ 运行时状态单例 G + 派生数值 getter + 操作 + 成就 + 存档
│     │  ├─ Save.ts              SaveData 结构 / loadSave / writeSave / clearSave（走 sys.localStorage）
│     │  ├─ Locale.ts            L 文案表 + t(key, lang)；Lang = 'zh' | 'en'
│     │  ├─ Res.ts               ★ 资源与音频单例 Res.I：sf() / slice() / play() / music() / loadAll()
│     │  └─ Util.ts              fmt / fmtTime / clamp / clamp01 / randRange / chance / pick / damp / hex / v3 / weightedIndex / ease*
│     ├─ UI/
│     │  ├─ UIKit.ts             ★ 全部 UI 工厂函数（见下表）
│     │  ├─ Panel.ts             openPanel() 标准面板外壳 + PanelHost 节流刷新 + rowCard + denyToast
│     │  ├─ Modal.ts / Toast.ts  模态栈 / 提示条与成就横幅（单例 Toast.I）
│     │  ├─ Hud.ts / NavBar.ts   顶部数值栏 / 底部导航
│     │  └─ ShopPanel / SkillPanel / AchPanel / StatsPanel / SettingsPanel.ts   各 openXxx(parent)
│     └─ Game/
│        ├─ Bottle.ts            单个瓶子：翻转/落地/失败扶正/悬停处决
│        ├─ BottleField.ts       瓶中阵列：布局、点击、双倍/再来一次/随机档
│        ├─ HelperHands.ts       助手手：自动翻瓶
│        ├─ CapMachine.ts        瓶盖机器：传送带 + 瓶盖产出
│        ├─ Abilities.ts         可乐/狂暴/武士 三个能力 + 底栏
│        └─ Fx.ts                表现层单例 FxLayer.I：飘字/爆散/冲击波/星光/闪光/震屏
├─ extensions/cocos-creator-mcp/ 编辑器 MCP 扩展（见 editor-mcp.md）
└─ .workbuddy/
   ├─ skills/cocos-3.8.8/        ← 你正在看的
   └─ tools/typecheck.py         源码类型检查
```

## 单例清单（都靠 `static I`，`onLoad` 赋值，用时判空）

| 单例 | 位置 | 关键成员 |
|---|---|---|
| `G` | Core/State.ts | `G.data`（存档）、`G.notify()` / `addListener()`、`tierIncome(t)`、`doFlipResult(t, opts)`、`buyBottle/buyHand/buyMachine/upgrade(id)`、`applyOffline()`、`save()/reset()`、大量派生 getter（`maxBottles`/`successChance`/`flipSpeedMul`…） |
| `Res.I` | Core/Res.ts | `sf(path)` → SpriteFrame、`slice(path,l,r,t,b)`、`play(name,v)`、`playRand([...],v)`、`music(on,v)`、`masterScale`、`font`、`loadAll(cb)` |
| `FxLayer.I` | Game/Fx.ts | `floatText(x,y,text,color,size,dy,dur)`、`burst(x,y,n,tier)`、`shockwave(x,y,maxR,dur,color)`、`sparkle(x,y,size,color)`、`flash(color,alpha,dur)`、`shake(amp,dur)` |
| `Toast.I` | UI/Toast.ts | `show(msg,color)`、`achievement(id)` |
| `Modal` | UI/Modal.ts | `push()` / `pop()` 模态栈 |

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

---
name: cocos-3.8.8
description: Cocos Creator 3.8.x（本机为 3.8.8）引擎 API 速查 + 工程读写/校验操作手册。当在本机 Cocos 项目的 assets/ 下编写、修改、审查 TypeScript 脚本时使用——涉及 `import ... from 'cc'` 的引擎类（Node / Component / UITransform / Sprite / Label / Graphics / Widget / Layout / ScrollView / Mask / Button / tween / resources / AudioSource / director / view / sys / input 等）、组件生命周期、UI 布局与竖屏适配、缓动与特效、资源与音频加载、输入与 2D 物理、面板/弹窗/存档等玩法模块；或需要查证某个 API 的准确签名与枚举取值、做类型检查、排查「改了没生效 / 不显示 / 不响应」时使用。含 TapBottle（点瓶子·竖屏）工程专属铁律与任务配方。
agent_created: true
---

# Cocos Creator 3.8.8 开发技能

本机 Cocos Creator 装在 `D:\CoCosIDE\Creator\3.8.8`。这份技能解决两件事：
**① 写对 API**（3.x 与 2.x 差异大，且 3.8.2+ 有破坏性改名）；**② 贴合本工程的写法与校验流程**。

---

## 0. 三个信息源，按优先级用

| 优先级 | 来源 | 用途 |
|---|---|---|
| 1 | 引擎权威声明 `D:\CoCosIDE\Creator\3.8.8\resources\resources\3d\engine\bin\.declarations\cc.d.ts` | **任何 API / 枚举 / 签名存疑，先在这里查，不要凭记忆。** 3.3 MB，3.8.8 完整类型 |
| 2 | 本工程源码 `assets/Scripts/` | 既有写法、可复用的工厂函数 |
| 3 | **运行中的编辑器**：`cocos-creator-mcp` 扩展（`http://127.0.0.1:3000/mcp`，本机实测 66 工具） | 看工程/场景真实状态、读控制台、截图、重载与重启。命令行客户端 `tools/cocos_mcp.py`，操作手册 `references/editor-ops.md` |

> 编辑器侧的能力**不是靠文档猜的**——本机编辑器正在运行，MCP 可直连，凡涉及编辑器状态的判断都应该先 `tools/cocos_mcp.py health` 探活再实测。

查 API 的标准动作（Grep 工具，不要用 shell 的 grep）：

- 找类：`pattern: "^\\s*export\\s+class\\s+Sprite\\b"` → 拿到行号，再 `Read` 带 `offset/limit` 读该类完整成员。
- 找枚举：`pattern: "enum\\s+_cocos_2d_components_sprite__SizeMode"`。
- 3.8 的枚举常在 `__private._cocos_xxx__EnumName` 里，而 `Sprite.SizeMode` 这种静态别名只是转发——**取值以 `__private` 里的原始枚举体为准**。

> 引擎声明自身有 ~59 条历史遗留类型错误（GPU* / `____private` / `pal/*`），属正常噪音，**不影响项目代码**，看类型检查结果时直接忽略（`tools/typecheck.py` 已自动过滤）。

---

## 1. 工程铁律（改代码前先读，违反必出问题）

| # | 铁律 | 原因 / 正确做法 |
|---|---|---|
| 1 | **UI 全部由代码构建，本项目没有 Prefab** | `assets/Scenes/Main.scene` 只挂一个 `GameRoot`。加界面 = 写 `openXxx(panelLayer)` 函数，不是拖预制体 |
| 2 | **不要用 `@property` 拖引用** | 资源一律 `Res.I.sf('bottle/body_0')`（内部键是 `Textures/<path>/spriteFrame`） |
| 3 | **改数值只改 `Core/GameConfig.ts`** | 档位 / 技能 / 成就 / 版面 / 存档 key 全在那里。逻辑里不要出现魔法数字 |
| 4 | **Sprite 必须先 `sizeMode=CUSTOM` + `trim=false` 再赋 frame** | 默认 `SizeMode.TRIMMED` 会用原图尺寸覆盖节点尺寸 → 图被拉成原图大小。统一走 `setFrame()` |
| 5 | **Label 描边用内置 `outlineColor` / `outlineWidth`** | 3.8.2 起 Label 自带描边；`LabelOutline` 组件已 `@deprecated`，不要再引 |
| 6 | **单例用 `static I`，在 `onLoad()` 里赋值** | `Res.I` / `FxLayer.I` / `Toast.I`。使用者一律判空：`Res.I?.play('click')` |
| 7 | **状态集中在 `Core/State.ts` 的 `G`，手动订阅刷新** | `G.addListener(fn)` + `G.notify()`；UI 靠 `PanelHost` 节流 0.15s 重建内容。不走事件总线 |
| 8 | **延时/循环一律用 `tween().delay()` 或 `this.schedule()`** | 不要 `setTimeout` / `setInterval`：预览与多端（小游戏）环境不可靠，且对象销毁后仍会回调 |
| 9 | **资源路径不带扩展名，也不带 `resources/`** | `resources.load('Textures/ui/px_white2/spriteFrame', SpriteFrame, ...)`；`Res.sf()` 收的是 `'ui/px_white2'` |
| 10 | **`tsconfig.json` 是 `strict: false`，但引擎声明是 `strict: true`** | 成员声明用 `null!` 断言（`private hud: Hud = null!;`） |
| 11 | **设计分辨率 720×1280，`ResolutionPolicy.FIXED_WIDTH`** | 竖屏。所有坐标以中心为原点，Y 向上。版面常量看 `GameConfig.LAYOUT` |
| 12 | **竖屏 UI 不要用 `Widget` 做自适应** | 本项目用绝对坐标 + `nd(parent, name, w, h, x, y)` 排布，改版直接调 `LAYOUT` |

---

## 2. 标准干活流程

```
1) 定位：这次要改的是「数值 / 新界面 / 新表现 / 新玩法」哪一类 → 见 references/cookbook.md 的配方
2) 查 API：cc.d.ts grep（见 §0），确认类名、方法名、枚举取值
3) 写码：贴现有文件的风格（工厂函数 nd/img/label/button/sliced/roundedPanel/bar/scrollView）
4) 校验：跑 tools/typecheck.py —— 项目源码必须 0 错误
5) 生效：编辑器那边没自动更新就跑 tools/restart_cocos.py --soft（改了资源再加 verify_assets.py）
6) 需要跑起来看：tools/cocos_mcp.py 调 debug_preview / debug_screenshot / read_console（见 references/editor-ops.md）
```

**第 4 步不要跳过。** 本项目历史上曾因跳过它带病构建 4 轮（漏 import、配置表缺字段、读不存在的属性），坏代码**静默进包、运行时才炸**——这类问题肉眼极难发现，只能靠 typecheck + verify_assets。当前两者均为 0 错误，但**每次改完仍必须重跑**（Cocos 命令行构建不因 TS 报错而失败）。

---

## 3. 索引

| 文件 | 内容 |
|---|---|
| `references/project-map.md` | 本工程目录职责、单例清单、`UIKit.ts` 全部工厂函数签名 |
| `references/core-api.md` | 引擎核心：导入方式、装饰器、Component 生命周期、Node、Transform/Vec3、事件系统、定时器、director、view/screen/sys/game、存储 |
| `references/ui-api.md` | UI 组件：UITransform、Sprite、Label、RichText、Graphics、Widget、Layout、ScrollView、Mask、Button/Toggle/Slider、UIOpacity、BlockInputEvents |
| `references/tween-fx-api.md` | tween/Tween 完整方法、全部缓动名、`ITweenOption`、粒子替代方案、Animation/Spine |
| `references/resource-audio-api.md` | `resources` / `assetManager` / bundle、Prefab 实例化、场景加载、AudioSource 与音频、JsonAsset/TextAsset |
| `references/input-physics-api.md` | 输入事件（触摸/鼠标/键盘）、`EventTouch` 取坐标、2D/3D 物理、射线、常用 `sys` 能力 |
| `references/editor-ops.md` | ★ **编辑器操作手册（实测版）**：MCP 客户端用法、重载/重启三档、编辑器能力地图（读/写/跑）、3.8.8 不可用清单、安全边界、**§9 手写 .scene/.prefab 的硬性格式与验证闭环** |
| `references/editor-mcp.md` | `cocos-creator-mcp` 扩展的工具清单（含 README 原始条目）、接入方式、限制 |
| `references/cookbook.md` | 任务配方：加面板 / 加技能 / 加档位 / 加成就 / 调数值 / 加音效贴图 / 排查不显示不响应 |
| `references/pitfalls.md` | 踩坑清单 A–I 节（含运行时改色 `tint`、竖直自适应几何、工具链与无头验收坑）+ D 节历史缺陷清单（均已修复） |

工具（都在 `.workbuddy/tools/`）：

| 脚本 | 作用 |
|---|---|
| `typecheck.py` | 项目源码类型检查（用 Cocos 自带的 tsc，自动过滤引擎声明噪音）。有错误退出码 1 |
| `verify_assets.py` | 资源路径一致性检查：代码引用的贴图/音效路径 ↔ `Res.ts` 的 `TEXTURE_PATHS`/`AUDIO_PATHS` ↔ 磁盘文件，三向对齐。**改过资源路径或加过 `Res.sf()` 调用就跑一次** |
| `cocos_mcp.py` | 编辑器 MCP 的命令行客户端：`health` / `tools` / `call <tool> <json>` / `res <uri>`。不用把 MCP 挂进客户端也能调编辑器 |
| `restart_cocos.py` | **重载/重启项目**，治「引擎不自动更新」。`--status` / `--soft` / `--soft --hard-cache` / `--full`（`--dry-run` 预演） / `--launch` |
| `tsconfig.check.json` | 上述 typecheck 用的配置，只 include `assets/**/*.ts`（`types` 路径是相对本文件解析的，别挪位置） |

```bash
<py> .workbuddy/tools/typecheck.py                    # 类型检查
<py> .workbuddy/tools/verify_assets.py                # 资源路径检查
<py> .workbuddy/tools/restart_cocos.py --status       # 编辑器/工程状态
<py> .workbuddy/tools/restart_cocos.py --soft         # 引擎没自动更新时先跑这个（3~10 秒）
```
`<py>` = `C:\Users\A\.workbuddy\binaries\python\versions\3.13.12\python.exe`
typecheck / verify_assets 正常应**全绿（0 错误）**。若出现错误，先对照 `references/pitfalls.md` D 节（历史缺陷清单，6 条均已修复）判断是不是旧疾复发，再往下查。

### 引擎不自动更新怎么办（本工程已知问题）

按代价从小到大，**不要一上来就重启**：

| 症状 | 处理 |
|---|---|
| 新拷入的贴图/音效不生效 | ① 确认已登记进 `Res.TEXTURE_PATHS`；② `restart_cocos.py --soft`（内部会 `project_refresh_assets` 生成 `.meta`） |
| 改了 `.ts` 没生效 | `restart_cocos.py --soft`（内部等编译）；还不行加 `--hard-cache` |
| 类型/接口改了、编译结果明显是旧的 | `restart_cocos.py --soft --hard-cache`（删 `temp/programming` 强制全量重编译） |
| `library/` 缓存坏了、编辑器整体发懵 | `restart_cocos.py --full --dry-run` 先看计划 → `restart_cocos.py --full` |
| 编辑器根本没开 | `restart_cocos.py --launch` |

`--full` 会先查场景有没有未保存改动，有就**拒绝执行**（除非 `--force`）；非交互环境默认不执行，需显式 `-y`。
细节与实测记录见 `references/editor-ops.md`。

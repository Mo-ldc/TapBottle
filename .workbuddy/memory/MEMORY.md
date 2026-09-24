# TapBottle 长期备忘

竖屏点瓶子（Bottle Flip Inc 复刻），Cocos 3.8.8（`D:\CoCosIDE\Creator\3.8.8`）。
逐轮细节见 `.workbuddy/memory/2026-09-2*.md`；本文件只留**最难重新发现的规则**。

## 仓库与分支（2026-09-24）
- 远端 `https://github.com/Mo-ldc/TapBottle`。
  - `main` = 主线（正在做预制体化改造）。
  - `legacy-runtime-ui` = **无预制体、运行时程序生成 UI** 的存档版，停在 `7a3168a`。
- 本地两个副本：`TapBottle`（开发用）/ `TapBottle_old`（clone 的纯净副本，跑 legacy-runtime-ui 分支）。
- 推送一律走系统代理：`unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy` +
  `-c http.proxy=http://127.0.0.1:10808`（沙箱注入的 58048 时通时不通，别依赖）。

## 架构（2026-09-24 起大改：代码生成 → 预制体化）
- **旧状态已废**：此前 UI 全由 `Scripts/UI/*` 运行时 Graphics 生成、无 Prefab。
  现在全面迁移为「场景实体化 + Prefab + 编辑器可调」，参考工程
  `E:\LDC_Cocos_PJ\Cocos3X_2D\开个便利店_竖屏\项目\StartConvenienceStore4`：
  GameEntry 场景(@property 进度条) → ResMgr/预制体按需加载 → UIMgr(pageRoot/dialogRoot/tipRoot)
  + PoolMgr(Map<string,Node[]>) → director.preloadScene 进主场景。
- 新基础设施：`Core/Prefabs.ts`（预制体清单+随 Res 预加载+make 实例化）、`Core/Pool.ts`（对象池）。
- **★ 目录规范（第二十六轮重组，2026-09-24）**：按资源类型归位，不按界面分目录——
  UI 预制体 = `resources/Prefabs/UI/<Name>.prefab`（`UIMgr.UI_ROOT='Prefabs/UI'`）；
  UI 脚本 = `assets/Scripts/UI/` 内**按职责分层**（依赖单向 Base ← Widgets ← Hud/Panels ← Pages/Dialogs）：
  `Base/`(UIBase/UIKit/Theme/Modal/Toast/Ads) `Widgets/`(行控件+AdButtons+UpgradeRows)
  `Hud/`(Hud/BottomPanel/Guidance) `Panels/`(Panel+3个openXxx面板) `Pages/` `Dialogs/` `_legacy/`(UIFit)；
  UI 贴图 = `resources/Textures/ui/<八分类>/`（nine/panel/button/icon/bar/deco/pixel/misc）。
  旧 `UIRes/`、`UI/Common/` 已删；迁移工具 `reorg_ui.py` + `reorg_ui_scripts.py`，备份 `.workbuddy/reorg_bak/`。
  ⚠️ 任何资源移动都要**连 .meta 一起移**（uuid 不变 → prefab 引用/cid 全不用改）。
- 九宫格皮肤：`Textures/ui/nine/{nine_base,nine_gloss,nine_stroke}`(inset 26) +
  `nine/{nine_chip,nine_chip_gloss,nine_chip_stroke}`(inset 27)，
  白底三层叠加可整体 tint；meta 已写 borderSlice；Theme.woodPlate/chipPlate/woodButton 走 Sprite(SLICED)。
  生成工具 `.workbuddy/tools/gen_nineslice.py`。
- 数值唯一真理源 `GDD v1.1.md` → `Core/GameConfig.ts`；状态单例 `G`；资源单例 `Res.I`
  （贴图登记 `TEXTURE_PATHS`，**任何一条路径失败 → 整批加载不到**）。
- 底栏四件（商店/升级/技能树/下拉框）内嵌面板，口径对齐
  `E:\LDC_Fby\BottleFlipInc\_analysis\model.json`；两列网格 CELL 322×78；跳转 API `showTreeCategory(page)`。
- 购买引导走 `UI/Guidance.ts`，跳转用注入的 NavBridge（直接 import 面板会成环）。

## 流程
1. 改完先 `python .workbuddy/tools/typecheck.py`（源码 0 错）再构建 —— 命令行构建**不因 TS 报错失败**。
2. 构建：`unset ELECTRON_RUN_AS_NODE` 后
   `"D:/CoCosIDE/Creator/3.8.8/CocosCreator.exe" --project <项目> --build "platform=web-mobile;debug=true"`（~25s）。
   **exit code 会骗人**（编辑器占 3000 端口 → 返回 36，但产物已写好）→ 看日志
   `build Task (web-mobile) Finished` + 在 index.js grep 新字符串。
3. 验收：`E:\LDC_Fby\_cdp.py`（无头 Chrome+CDP+本地 http）跑 `.tpl`（sleep/eval/jsclick/jsdrag/shot）。
   参数：`<webroot> <out.png> <http端口8901+> <WAIT**毫秒**> <宽> <高> <模板.tpl> <profile目录> <调试端口9350+>`。
   ⚠️ 用 `C:/Users/A/.workbuddy/binaries/python/envs/default/Scripts/python.exe` 跑（裸 `python` 没有 requests）。
   - ⚠️ **模板路径必须绝对**（内部 os.chdir，相对路径静默跳过）；HTTP 端口传 8901+，**绝不能传 9333**（调试口）。
   - ⚠️ 连跑换独立 profile（第 8 参）+ 调试端口（第 9 参）；先 `unset http_proxy ...` + `NO_PROXY=127.0.0.1`；
     **Bash 沙箱内 Chrome 网络偶发丢请求 → 用 dangerouslyDisableSandbox 跑**。
   - ⚠️ headless 首次 `Input.dispatchMouseEvent` 会被丢弃 → 先 jsdrag 预热再点。
   - ⚠️ **`jsclick:` 的坐标是屏幕像素（原点左上角）**，不是世界坐标：
     `screenX=(wp.x-vo.x)*k`、`screenY=H-(wp.y-vo.y)*k`，`k=window.innerHeight/view.getVisibleSize().height`。
     传错只表现为「点了没反应」，极易误判成业务 bug。
   - ⚠️ `_cdp.py` 窗口传 720×1280 时 `window.innerWidth/Height` 实测只有 **704×1185**（窗口框吃高度）→
     可见区是 1440×2424 而非 2560；排查适配偏差先打这个数。
   - ⚠️ swiftshader 截图对带 CSS transition 的 fixed 层出陈旧纹理伪影 → DOM 求值状态才是真相。
   - ⚠️ `window.cc` 无 `cc.UITransform` 等 → 用 `getComponent('cc.UITransform')`；`__tb.*` 类在 `.I`。
     `F(scene,'bottles')` 命中的是**外层容器**（children=shadows/bottles/label），取瓶子用 `__tb.field.I.bottles[0].node`。
   - ⚠️ `jsclick:`/`jsdrag:` 行 = 先 eval JS 拿 `[x,y]` 再 dispatchMouseEvent；**普通 `eval:` 行返回坐标不会点击**（只记录）——模板里点击必须用 `jsclick:` 前缀，写错是静默空操作（实测踩过）。
   - 脚本被中途打断时 `finally` 不执行 → chrome 会泄漏（每次 ~10 进程/150MB）。
     已修（taskkill /T /F + 按 user-data-dir 兜底），另加 `python _cdp.py cleanup` 一键清进程+profile。
4. **同一文件一次只发一处编辑**（并行多处互相覆盖且都返回 success）。

## 手写 .scene / .prefab 的硬性格式（缺一条编辑器就打不开）
- **prefab 三件套**：`arr[0]=cc.Prefab`(data→1)；每个 Node 有 `_prefab`→`cc.PrefabInfo`
  （root→1、asset→0、fileId 22 字符，DFS **后序**插在该节点组件之后）；
  每个 Component 有 `__prefab`→`cc.CompPrefabInfo`（紧跟组件后）。
- **prefab 里所有 node/component 的 `_id` 必须是空串 `""`**；**scene 里 `_id` 是标准 uuid**。
  写反了编辑器当脏数据，双击打不开。（参考工程 463 个 prefab 节点 `_id` 全为空）
- **scene 根 Canvas 的 `_parent` 必须显式指回 `arr[1]`(cc.Scene)**：否则 `node.scene===null`
  → 整棵树 `UITransform.hitTest` 抛 `Cannot read properties of null (reading 'renderScene')`
  → 表现是「画面完全正常，但所有点击全废」。
- 验证闭环：`prefab_validate` → `prefab_edit{action:open}`（等价于双击）→ 看 `mode:"prefab-edit"`；
  再 `close{save:true}` 后 diff，**只应差 fileId 随机值**（实测已验证字节级等价）。

## 坑（真金白银）
- **一个节点只能挂一个渲染组件**（Sprite/Graphics/Label 都是 UIRenderer）：第二个 addComponent **静默失败**，多层效果各占子节点。
- 运行时改色**必须整体赋值** `new Color(...)`：`Color.fromHEX(sp.color,..)`/`sp.color.set(..)` 就地改
  内部 `_color`，引用未变 → setter 提前 return → 静默不变色。Graphics 改色要 clear()+重描。
- 依赖贴图的构建必须在资源加载回调之后（早了静默空白只剩清屏色）。
- 容器层「建完再顶到末尾」`setSiblingIndex(len-1)`；兄弟创建序 = 渲染序。
- **全局 input 监听不受 BlockInputEvents 约束** → 模态必须 Modal.push/pop。
- ScrollView content 锚点 (0.5,1) → y 写 `viewH/2 - TOP_PAD`；滚动区下沿落进行间隙。
- UI 出场「中央 Q 弹」popIn/popOut；popOut 会把 UIOpacity 复位 255，不能对已淡出节点再调。
- 瓶身 `body_0..6.png` 画的是**瓶口朝下**（angle=180 才正立）；点击命中自己算（Bottle.hitTest 世界坐标判矩形 150×375/ay 0.34）。
- 本机 bash `tail/dirname` 不可用；`&&` 链会整条短路。

## 数值与经济
- **落地判定 = 纯概率制**（覆盖 GDD §3.1-3 角度容差）：成功树立 50%（倒立:正立恒 1:4 分池），
  mastery 每级 +5%，满 10 级=100%。`FLIP.*` + `G.successChance/rollOutcome`；
  `rollLanding/p_stability` 已不参与。⚠️ mastery 的 `base` 同时是价格基数。
- **瓶盖 = 每次成功落地 1 枚**（ok/crit 都给），失败无；没买瓶盖机器（$1000）时归零；
  瓶盖先进 pendingCaps，CapMachine 运到滚筒才入账。助手 `h_unlock` 1200 盖、1.5s/次、超 10 只静默结算。
- 瓶盖无爆散动画，抛物线飞右端入料机；履带**向左运**到左端出售箱（binX -252/feederX +252）。

## 适配层（2026-09-24 第二十五轮起：Widget 平铺 + AutoNodeScale）
- **唯一适配组件** `Core/AutoNodeScale.ts`（从参考工程 `Init/Scripts/Tool/` 搬来，关掉 executeInEditMode）。
  `s = min(父宽/自身宽, 父高/自身高)`，锚点 0.5 天然居中。编辑器实体化，不再运行时算尺寸。
- **两边结构对称**：
  - 游戏：`Canvas` → `GameRoot`[Widget(45) 平铺可见区] → `gameRoot`[UT 720×1280 + AutoNodeScale]；
    `uiRoot`[Widget(45)] 1:1 平铺（**不**挂 AutoNodeScale）。
  - UI 预制体：`<Name>`[Widget(45) 跟随画布] → `mask`[Widget(45) 铺满] / `fit`[UT 720×1280 + AutoNodeScale]。
- **★ 引擎事实**：`cc.Canvas` **不会**把节点 `UITransform` 改成可见区（只管相机 orthoHeight）。
  所以 `GameRoot.alignCanvas()` 必须自己 `Canvas.UITransform.setContentSize(view.getVisibleSize())`，
  否则 Widget 铺的是场景里手写的 1440×2560，AutoNodeScale 会算大（实测 s=2 vs 正确 1.8936）。
- **等价性**：父节点铺满可见区时 `s ≡ 旧的 sA×DS`（FIXED_WIDTH 下父宽恒 1440 → 1440/720=2）。
  三视口实测 1.8936 / 1.845 / 0.5563 与改造前逐位一致。
- 旧 `UIFit.ts`（现 `Scripts/UI/_legacy/`）已退役，保留仅供回溯。
- 改造脚本：`.workbuddy/tools/fit_prefabs.py`（6 个 UI prefab）、`fit_game_scene.py`（Game.scene）。
  **改法**：只「原地改写已有组件」+「数组末尾追加 [组件, 其 CompPrefabInfo]」，**绝不删除/重排**
  （`__id__` 是数组下标，重排要全量 remap）。备份在 `.workbuddy/prefab_bak/`。

## 布局口径（设计 1280，y 以屏幕中心为 0）
- 顶栏 barY 520/h134 → 木桌 statusY 386 → 底部块 abilityY −136 / beltY −256 / navY −356 /
  panelY −508（内嵌面板）。`SAFE_BLOCKS.botTopY −85` 要跟着「底部块最上面是谁」走。
- 瓶子 bottleH 96，BOTTLE_SCALE=0.256；顶栏只留金币+瓶盖两个筹码。
- 奶油底 #F6E3C5 配深棕字 #7A4210；深木牌底才 #F1E0C0；模态面必须实心 6 位 hex。

## 手写 .scene / .prefab（见下方格式节）
- 生成器 `.workbuddy/tools/gen_scene.py` + `build_main_scene.py` / `build_prefabs.py`，
  校验器 `check_prefab.py`（对参考工程 46 个 prefab 全通过才算规则归纳对）。
  脚本组件 `__type__` 用**编译期 cid**（`scan_cid.py` 扫 `temp/programming`），不是脚本 uuid。

## 资产与工具
- 贴图 141 张已压到 <200K/张（PNG8），工具 `tex_compress.py`/`tex_dryrun.py`，原图备份
  `.workbuddy/texture_src/`（unused/ 含死资源可拷回）。字体 NotoSansSC-Bold 10.5MB 是下一个包体大头（未子集化）。
- 音频全转 MP3（lameenc；bgm 96k 立体声），备份 `.workbuddy/audio_src/`。
  ⚠️ lameenc 低码率会悄悄降采样率 → set_out_sample_rate；mp3 循环有 ~0.04s 间隙；
  `clip.duration` 返回 undefined，要用 `clip.getDuration()`。
- 美术流水线 `E:\LDC_Fby\_art_pipe.py`；抠底要先造 L 二值掩膜再 thresh=0 泛洪（floodfill 直接抠会静默失败）。
- 打平台包需本机 npm（`D:\nodejs`）；npm 操作前 `NODE_OPTIONS= NODE_PATH=`；改 PATH 必须完全重启编辑器。

## 场景渲染注册坑（2026-09-24）
- 场景反序列化的 Sprite/Label 可能整树不渲染（节点/贴图/颜色全正常）：preload 提前实例化时
  markForUpdateRenderData 被丢且永不重发。**修复 = removeChild+addChild 重挂子树**，已固化在
  `GameRoot.rebindSceneRenderers()`（afterReady 重挂 hudRoot/navRoot/adRoot）。详见 cocos-3.8.8 技能 pitfalls。
- 玩法 UI 已全部实体化进 Game.scene（build_gameplay_ui.py，580 对象）；组件 bindScene 按节点名接手，
  construct() 是运行时兜底，**两边节点名必须同构**（Hud 曾因 moneyLb 摆放位置不一致每帧 TypeError）。

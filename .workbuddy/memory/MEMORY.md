# TapBottle 长期备忘

竖屏点瓶子（Bottle Flip Inc 复刻），Cocos 3.8.8（`D:\CoCosIDE\Creator\3.8.8`）。
逐轮细节见 `.workbuddy/memory/YYYY-MM-DD.md`；本文件只留**最难重新发现的规则**。

## 仓库
- 远端 `github.com/Mo-ldc/TapBottle`：`main` 主线；`legacy-runtime-ui`（无预制体存档版，停 `7a3168a`）。
- 本地 TapBottle（开发）/ TapBottle_old（纯净 clone）。推送：unset 代理变量 +
  `-c credential.helper=manager -c http.proxy=http://127.0.0.1:10808 push`
  （**缺 credential.helper=manager 会报 terminal prompts disabled**）。
- ★ 提交前：.gitignore 先行；`_prof_*`/`tmp/`/验收截图/一次性 `_*.tpl`/`*_bak/`/`unused_park/` 不入库。
  提交信息=标题+详细 Description（用户硬性要求）。

## 架构
- ★★「以预制体为主」铁律（第79轮）：代码**绝不允许**对 prefab/场景节点写 position/contentSize
  （只许文字/active/事件）；UI 位置编辑器里调。验证闭环 `_q79_prefab_drift.tpl` + `drift_check.py`=漂移0。
  列表行 `UpgradeRow.prefab` 用 `snap()` 快照（第80轮）；constructCell 兜底常量要与 prefab 同步。
- 场景实体化 + Prefab + 对象池（参考 StartConvenienceStore4）；`Core/Prefabs.ts` / `Core/Pool.ts`。
- 目录：UI 预制体 `resources/Prefabs/UI/`；UI 脚本 `assets/Scripts/UI/` 按层
  Base←Widgets←Hud/Panels←Pages/Dialogs；贴图 `resources/Textures/ui/八分类`。资源移动必须**连 .meta**。
- 面板 = bd11 木板底板 + bd12 列表框嵌套（烘进 Game.scene）；展开把手 bd16 向上长 210。
  **布局真源=场景**（bindScene 烘焙值），常量只兜底——「改了场景游戏内不变」就是被旧常量覆盖。
- ★ **第121轮（2026-09-30）：「悬停翻转」全阶默认解锁** —— 真源在 Save.ts：
  `emptyTierStats()` 把 hover 列预置 1、`normalize()` 对老档幂等补齐=1；`hoverUnlocked` 照常读档
  → `haloTriggerOn` 开局 true、光圈即吸附形态(r=55)、升级页/技能树 hover 行因 statMax 消失、
  `p_cursorsize` 开局出现。**新手引导期间悬停触发整段停用**（`BottleField.update` 加 `!Tutorial.active`
  门控）：否则瓶子在引导洞里自动翻飞、空中 `b.idle=false` 点击落空 → `notifyTap` 不计数 → 引导卡死。
- FEAT（Core/Features.ts）：`abilities=false`（可乐/狂暴/处决停用未删，恢复=改 true 重建）；
  `upgradeTab=true`（已恢复）。

## 流程
1. `python .workbuddy/tools/typecheck.py` 0 错再构建；构建 exit code 会骗人，看日志 `build Task Finished`。
2. 构建：`unset ELECTRON_RUN_AS_NODE` + `CocosCreator.exe --project <p> --build "platform=web-mobile;debug=true"`。
3. 验收 `E:\LDC_Fby\_cdp.py`：`<webroot> <out.png> <http 8901+> <WAIT ms> <w> <h> <tpl 绝对路径> <profile> <dbg 9350+>`；
   python 用 `envs/default`；dangerouslyDisableSandbox；profile 放 `点瓶子_竖屏\_workbench\_prof\`；
   连跑换端口+profile；模板库 `_workbench\_tpl\`（先读 README）；日志落 `E:\LDC_Fby\_cdp_log.txt`。
4. 同一文件一次只发一处编辑。

## 编译产物热补丁（应急验证用）
- 直接 patch `build/web-mobile/assets/main/index.js` 可先验手感再落源码；**插桩点必须确认变量定义顺序**
  （第121轮曾把用 `G` 的循环插在 `var G=new State()` 之前 → 模块执行抛 TypeError → 整页黑屏；
  `node --check` 只查语法不查引用顺序）。验证完必须源码落地 + 重建覆盖，不留补丁痕迹。

## 手写 .scene/.prefab 硬格式
- prefab 三件套（PrefabInfo DFS 后序 / CompPrefabInfo 紧跟组件）；**prefab 所有 _id=""，scene _id=uuid**；
  scene 根 Canvas `_parent` 指回 scene，否则画面正常但点击全废。编辑器保存会重排 JSON 缩进 →
  按对象下标配对判真实改动，别看 diff 行数。

## 空间索引（第96轮）
- `Core/SpatialGrid` 均匀网格；脏标记 3 处（sortDepth / onLanded **开头** / sync 末尾），别每帧重建；
  网格按**本地坐标**建，`hitBottles` 入参世界坐标要先 convertToNodeSpaceAR（漏了命中恒 0 且不报错）。

## 坑（真金白银）
- 编辑器预览(7456)点击全灭 = 引擎输入时序 bug → `Core/PreviewInputBridge.ts`（幂等桥）。
- 2D 相机必须 `_projection:0`（ORTHO）；透视 = 竖屏 UI 全消失、点击失效；GameRoot Widget 边距必须 0。
- 一节点只能挂一个渲染组件；改色必须整体赋值 `new Color(...)`；Graphics 改色 clear()+重描。
- 全局 input 不受 BlockInputEvents 约束 → 模态必须 Modal.push/pop。
- `body_0..6` 瓶口朝下（angle=180 正立）；Bottle.hitTest 世界坐标矩形 150×375/ay 0.34。
- 场景反序列化 Sprite/Label 整树不渲染 → `GameRoot.rebindSceneRenderers()` removeChild+addChild 重挂。
- 本机 bash `tail/dirname` 不可用；`&&` 链会整条短路。

## 数值
- 落地纯概率：成功 50%（倒立:正立恒 1:4），mastery 每级 +5% 满 10=100%；mastery 的 base 兼价格基数。
- 瓶盖=成功落地 1 枚，没买瓶盖机器（$1000）归零；pendingCaps 运到滚筒才入账。
- 光圈：`haloRadius = haloTriggerOn ? p_cursorsize : HALO_DOT_R(14)`；广告光圈 = 满级×1.5 且全阶放行。

## 适配
- `Core/AutoNodeScale` 唯一适配组件；cc.Canvas **不会**自动改 UITransform →
  `alignCanvas()` 自己 `setContentSize(view.getVisibleSize())`，否则 AutoNodeScale 算大。

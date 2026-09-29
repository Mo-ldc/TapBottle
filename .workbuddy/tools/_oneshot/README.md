# ⛔ 一次性脚本（_oneshot）—— 默认不要重跑

这里的脚本都是**「一次性生成器」**：它们把当时设计好的布局**直接写进**
`assets/resources/Prefabs/UI/*.prefab` 和 `assets/Scenes/Game.scene`。

## 为什么要单独放

2026-09-29（第七十九轮）用户反馈：**在编辑器里调好的预制体，跑起来又变回「代码设计的样子」**。
根因就是这批脚本被重复执行 —— 它们不读现有 prefab，只按自己内部的常量**整棵重建**
节点位置/尺寸，等于把编辑器里的手改全部覆盖掉。

## 正确的工作流（预制体为主）

1. 想改 UI 位置/大小/层级/皮肤 → **在 Cocos Creator 里直接改 prefab（Ctrl+S 保存）**；
   代码只允许「填文字 / 切 active」，不允许对 prefab 里的节点写 position / contentSize。
2. 改完想确认「运行期 == 预制体」→ 跑漂移检查（见下），别靠肉眼猜。
3. 只有需要**从零重排整棵 UI**（例如新增一整块界面）时才写新脚本，并且：
   - 脚本必须**基于现有 prefab 增量改**（只改要改的节点），不要整棵重建；
   - 跑之前先 `git status` 确认工作区干净，跑完立刻用漂移检查 + 截图验收。

## 漂移检查（prefab ↔ runtime）

三个工具（都在 `.workbuddy/tools/`）：

```
# ① 预制体真相（纯读文件，安全）
python .workbuddy/tools/dump_prefab.py assets/resources/Prefabs/UI/UpgradeRow.prefab

# ② 运行期真相（无头 Chrome，模板 dump 节点树到 E:/LDC_Fby/_cdp_log.txt 的 [eval] 行）
#    弹窗 5 个：_q79_prefab_drift.tpl   列表行：_q80_row_prefab.tpl
#    ⚠️ 跑之前 export CDP_LOG_MAX=40000，否则 dump 行会被日志上限截断
python E:/LDC_Fby/_cdp.py <build/web-mobile> <out.png> 8923 10000 720 1280 \
  E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/_workbench/_tpl/_q79_prefab_drift.tpl \
  E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/_workbench/_prof/<名字> 9378

# ③ 逐节点比对（自动跳过引擎接管/控件状态项，只报真正被代码顶掉的）
python .workbuddy/tools/drift_check.py E:/LDC_Fby/_cdp_log.txt
```

**把「当前有效布局」写回 prefab**（例如代码里改过的值忘了同步给编辑器）：

```
python .workbuddy/tools/set_prefab_node.py assets/resources/Prefabs/UI/UpgradeRow.prefab \
    ic:-128,-6,40,40  name:-98,17,316,60  btn/btnLb:13,1
# 格式：<节点路径>:<x>,<y>[,<w>,<h>]   路径用 / 分隔，如 btn/btnLb
```

（Label 的 width 是运行时按文字算的，允许不一致；pos 必须一致。）

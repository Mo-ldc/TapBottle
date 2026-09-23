# TapBottle 竖屏点瓶子

Cocos Creator 3.8.8 复刻的 Bottle Flip Inc 玩法放置游戏，纯竖屏，UI 全部由代码运行时构建（无 Prefab）。

## 玩法

- 点击/翻转瓶子，翻成功得分与瓶盖，失败扣盖有概率
- 瓶盖经济：解锁回收机后由履带（CapMachine）把瓶盖运到顶端入账，在途量计入存档
- 技能树升级：收益、翻转速度、命中率、回收机等线路
- 抽屉式面板：技能树 / 统计 / 成就 / 设置
- 中英双语（`assets/resources/Text/zh.json` / `en.json`）
- 竖屏自适应：FIXED_WIDTH + 舞台包络缩放，适配 16:9 ~ 超高屏

## 技术要点

- **无 Prefab 架构**：UI 由 `assets/Scripts/UI/UIKit.ts` 工厂函数运行时构建，`Scenes/Main.scene` 只有 Canvas + Camera + GameRoot
- **数值唯一真理源**：`GDD_Bottle_Flip_Inc_Cocos.md` → `Core/GameConfig.ts`
- 状态单例 `G`（`Core/State.ts`），资源单例 `Res.I`（`Core/Res.ts`）
- 存档 `Core/Save.ts` 本地持久化

## 目录结构

```
assets/
  Scenes/          主场景（仅骨架）
  Scripts/
    Core/          配置 / 状态 / 资源 / 存档 / 本地化 / 工具
    Game/          瓶子 / 瓶阵 / 履带 / 技能效果 / 特效 / 小助手
    UI/            HUD / 抽屉 / 面板 / Toast
  resources/       贴图 / 音频 / 字体 / 文案
extensions/        cocos-creator-mcp 编辑器扩展
GDD_Bottle_Flip_Inc_Cocos.md  策划案（数值唯一真理源）
```

## 构建

用 Cocos Creator 3.8.8 打开工程，构建 web-mobile 平台即可；代码改动后建议先跑 `python .workbuddy/tools/typecheck.py` 做离线类型检查。

## 更新日志

### 2026-09-23 · 游戏完整实现

- 全量游戏逻辑落地：瓶子三态物理（成功/暴击/失败）、瓶阵与翻转、瓶盖经济与履带回收机、技能树（五态皮肤节点）、能力系统、小助手
- UI 全套：HUD、抽屉面板（技能/统计/成就/设置）、Toast、快捷购买、模态框
- 资源入库：瓶身/瓶盖贴图、UI 素材、音效（含 BGM）、中英字体与双语文案
- 竖屏自适应方案定稿：安全区钉扎 + 舞台包络缩放
- 开发配套：GDD 数值文档、离线类型检查脚本、编辑器 MCP 扩展、开发日志

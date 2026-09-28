# 资源盘点与清理（scan_unused / clean_unused）

> 适用：Cocos Creator 工程（本工程为按路径 `resources.load` 的加载模型）。
> 工具：`.workbuddy/tools/scan_unused.py`（只读扫描）/ `clean_unused.py`（dry-run + `--go`）。
> 换工程时只需核对两个常量：`TEXTURE_PATHS` 所在文件、`UI_ROOT`/`PREFAB_ROOT` 常量名。

## 1. 本工程的资源加载模型（判定依据）

- **贴图**：必须登记在 `Core/Res.ts` 的 `TEXTURE_PATHS`（带 `/spriteFrame` 后缀），
  `Res.loadAll` 一次性 `resources.load(TEXTURE_PATHS, ...)`。**没登记 = 运行时永远拿不到**。
- **音频**：`AUDIO_PATHS` 同理。
- **预制体**：`Core/Prefabs.ts` 的 `PREFAB_PATHS`（`Game/Bottle` 等）+
  `Core/UIMgr.ts` 的 `UIName` 枚举（每项按 `UI_ROOT='Prefabs/UI'` + 名字动态加载）。
- **例外通道**：prefab / scene / anim 里以 `__uuid__` 直接引用的 SpriteFrame
  （如 StartPage.prefab 引 startUI 组、Load.scene 引 `assets/Scenes/Load/` 组——注意这组**不在 resources 下**）。

## 2. 判定口径（三线索并集，命中任一即在用）

1. **路径字符串**：`TEXTURE_PATHS` / `AUDIO_PATHS` / `PREFAB_PATHS` / `UIName` 枚举展开，
   加上代码里所有 `'xxx/yyy'` 引号串（弱引用，宁漏报不误删）。
2. **uuid 引用**：全工程 `.scene/.prefab/.anim/.mtl` + `settings/`+`profiles/` 里的 `__uuid__`。
3. **子资源归并**：贴图被引用的是 `uuid@f9941`（spriteFrame 子资源），归并回父资源。

### ⚠️ 两个必踩的坑（第一版扫描器全漏）

- **`__uuid__` 是复合格式**：`"e93e27ed-....@f9941"`。正则若写成
  `"__uuid__":\s*"([0-9a-fA-F-]+)"`（要求闭合引号紧跟 hex），会把**所有 spriteFrame 引用全部漏掉**，
  导致「只被 prefab/scene 引用的贴图」全被误判无用（startUI、boot_bar 全中招）。
  正确写法：`"__uuid__":\s*"([^"]+)"` 然后 `.split('@')[0]`。
- **路径前缀要归一**：代码登记的是 `Game/Bottle`、`UI/UpgradeRow`，实际文件在
  `Prefabs/Game/Bottle.prefab`——必须把 `PREFAB_ROOT`/`UI_ROOT` 前缀拼上再比对，
  否则所有预制体都会被误报。

## 3. 清理执行的安全顺序

1. `scan_unused.py` 出报告（分目录 + 体积），**人工分拣**四类：
   - 真死资源（零引用，删）→ 备份到 `.workbuddy/dead_res_bak/` 后删（**连 .meta 一起**）
   - 待接线资源（如换皮 skin/，**不能删**）
   - 存疑项（如 startUI/bd08，用户自己接的线，**问用户**）
   - 重建缓存（build/library/temp，均在 .gitignore，可删但编辑器要全量重导入）
2. `clean_unused.py`（无参 = dry-run 列清单）→ 人工核对 → `--go` 执行。
3. 删完闭环验证：`verify_assets.py`（路径一致性 0 问题）→ 命令行构建（0 missing）→
   `_cdp.py` 无头冒烟（boot 消失、瓶子在、点击翻转 flips 0→1、截图目检）。

## 4. 本次实测数据（2026-09-28）

- 删除：42 个 Chrome 无头验收 profile 目录 + tmp 旧截图日志 = **4.14 GB**；
  死资源 8 项（Lato-Semibold.ttf 653K、OrangeKid.ttf、Text/zh+en.json、boot_bar_*3 张、tri_play）= 0.74 MB。
- `.workbuddy` 4274 MB → **32.7 MB**。
- 保留：`skin/dialog` 57 + `skin/main` 15（待接线）、`startUI/bd08`（用户保留）、全部备份目录。
- 收益大头根本不在 assets 里：**历次无头验收的 Chrome profile 目录每个 ~73 MB**，
  `_cdp.py` 传新 profile 目录就会永久留一份。养成习惯：验收完 `_cdp.py cleanup`，
  或定期跑本工具的 A 类清理。

# 仓库卫生：提交前审计与垃圾隔离

适用：把本项目推送到 GitHub `Mo-ldc/TapBottle` 之前。**核心教训见文末事故记录**。

---

## 1. 硬性顺序：先 `.gitignore`，再 `git add -A`

本工程每轮无头验收（`_cdp.py`）都会在 `.workbuddy/` 下留一个 **20~80MB 的 Chrome profile**。
2026-09-24 那次「整个 `.workbuddy` 一起传」的决策，导致 **20572 个缓存文件被提交进仓库**
（每个 profile 350+ 文件），后来清掉时产生了一个 **-838 万行** 的提交。

> 所以：**`git add -A` 之前必须确认 `.gitignore` 已覆盖所有临时产物。**
> 一旦 `_prof_*` 进了索引，再撤回就得重写历史。

`.workbuddy/` 下**绝不能入库**的（`.gitignore` 已固化）：

| 模式 | 是什么 |
|---|---|
| `.workbuddy/_prof_*/` | 无头验收的 Chrome profile（20~80MB/个，实测攒到 3.6GB） |
| `.workbuddy/cdp_prof_*/` | 同上，早期命名 |
| `.workbuddy/tmp/` | 临时产物（含 `head_snap/` 整棵工程快照） |
| `.workbuddy/_*.png` | 验收截图（每轮十几张） |
| `.workbuddy/_*.tpl` | 一次性验收模板 |
| `.workbuddy/_*.json` | 一次性探针输出（如 `_unused_nodes.json`） |
| `.workbuddy/*_bak/` | 各类备份：`font_bak` `prefab_bak` `scene_bak` `node_bak` `skin_bak` `dead_res_bak` `reorg_bak` |
| `.workbuddy/unused_park/` | 移出待接线的素材 |
| `.workbuddy/audio_src/` `.workbuddy/texture_src/` | 原始 wav / 高清贴图备份（25MB+） |

**用户口径（2026-09-28 拍板）：备份目录一律不上传**，只在本地保留；需要时从 git 历史找回。
允许上传的只有：`assets/`、`.workbuddy/tools/`、`.workbuddy/skills/`、`.workbuddy/memory/`。

---

## 2. 审计手段：porcelain + python 统计

工作区攒久了 `git status` 能到 **1.6MB / 2 万条**（Read 工具直接读会超限）。做法：

```bash
git status --porcelain > /tmp/sp.txt      # 或 status --short
```

再用脚本按 **状态码 / 一级目录 / 扩展名** 三向统计（`.workbuddy/_prof_*` 会自动聚成大头）。
判定要点：

- **` D` 占绝对多数且集中在 `.workbuddy/` → 是清理，不是事故**（磁盘早删、索引还挂着）。
- **`??` 里出现 `_prof_*` / `tmp/` → 危险**，说明 ignore 漏了，停下先补规则。
- 建议按 `--diff-filter=A`（新增）单独审一遍：新增文件才是"真正要入库的东西"，
  扫一眼一级目录就能发现异常（正常应只有 `assets/` + `.workbuddy/tools|memory|skills`）。

**中文路径坑**：`git` 默认把非 ASCII 路径转成八进制转义并加引号
（`".workbuddy/_prof_du3/.../\346\234\252..."`），导致 `grep "^\.workbuddy/"` 这类按行首过滤
**整条漏判**（实测踩过：以为有 6 个垃圾被 add，其实是过滤没匹配上）。加 `-c core.quotepath=false` 即可：

```bash
git -c core.quotepath=false diff --cached --name-only --diff-filter=A
```

---

## 3. 提交策略：清理与功能分成两个 commit

一次迭代往往同时包含「删死资源/清垃圾」和「功能改动」。合成一个 commit 时，
两万条删除会把功能 diff 完全淹没（GitHub 上没法看）。拆法：

```bash
git reset -q                                   # 先全部取消暂存
git add -A -- .gitignore '.workbuddy/_prof_*' '.workbuddy/cdp_prof_*' '.workbuddy/tmp'
git commit -F msg_clean.txt                    # ① chore: 清理
git add -A
git commit -F msg_feat.txt                     # ② feat: 功能
```

- `git add -A -- <pathspec>` 可只暂存指定路径的增删（含**已跟踪文件的删除**）。
  pathspec 写 `.workbuddy/tmp` 时 git 会提示 "paths are ignored"——**这是正常的**：
  ignore 只拦未跟踪文件的新增，已跟踪文件的删除照样记录。
- commit message 一律**标题 + 详细 Description**（用户硬性要求）；正文按
  「美术 / 预制体 / 性能 / 资源治理 / 交互 / 工具 / 文档」分节列点。

---

## 4. 推送

```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
GIT_TERMINAL_PROMPT=0 git -c credential.helper=manager \
  -c http.proxy=http://127.0.0.1:10808 push origin main
```

- 沙箱注入的代理 `127.0.0.1:58048` 对 github.com 时通时不通（常 502），**别依赖**。
- 系统代理 `127.0.0.1:10808`（v2rayN）需开着；直连被墙。
- 凭据走 Git Credential Manager（已授权过一次，之后免登录）。
- Windows 上 `unset` 是 bash 内置，`env -u` 不可用（本机 `env` 命令不存在）。

---

## 5. 历史事故记录（2026-09-28 清理）

| 项 | 数据 |
|---|---|
| 误提交的缓存文件 | 20572 个（40+ 个 profile 目录 + `tmp/`） |
| 清理提交 | `02c34a0` chore —— 20573 files changed, **-8,384,656 行** |
| 功能提交 | `9af7046` feat —— 347 files changed, +12360 / -108445 |
| 推送 | `bae3da2..9af7046` → main |

要点：**清理只取消跟踪，`.git` 体积不会因此变小**（blob 仍在历史里）。
真要瘦身得 `git filter-repo` 重写历史 + `gc --aggressive`，代价是全员重 clone——本项目没做。

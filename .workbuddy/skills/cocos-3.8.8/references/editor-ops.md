# 编辑器操作手册 · 实测版（3.8.8 / 2026-09-21 实测）

本机 Cocos Creator 3.8.8 **正在运行**，`cocos-creator-mcp` 扩展已启用并监听 `http://127.0.0.1:3000/mcp`（66 工具）。
本文所有「✅ 实测」标记都是在本工程上真跑过并拿到正确返回的，不是从扩展 README 抄的。

---

## 1. 前置：确认 MCP 活着

```bash
<py> .workbuddy/tools/cocos_mcp.py health
# {"status": "ok", "tools": 66}
```
不可达 = 编辑器没开 或 扩展未启动。启动方式：扩展 → 扩展管理器 → 启用 Cocos Creator MCP → 打开面板 → Start Server。
`settings/cocos-creator-mcp.json` 里 `autoStart: true`，正常情况下随编辑器自启。

> **说明**：这套工具不需要把 MCP 挂进 AI 客户端也能用 —— `cocos_mcp.py` 是命令行客户端，直接走 HTTP。

## 2. 命令行客户端 `cocos_mcp.py`

```bash
<py> .workbuddy/tools/cocos_mcp.py health
<py> .workbuddy/tools/cocos_mcp.py tools [关键字]          # 列出工具（可按关键字过滤）
<py> .workbuddy/tools/cocos_mcp.py call <tool> '<json>'    # 调工具
<py> .workbuddy/tools/cocos_mcp.py res <uri>               # 读只读资源
```
例：
```bash
<py> .workbuddy/tools/cocos_mcp.py call scene_query '{"action":"dirty"}'
<py> .workbuddy/tools/cocos_mcp.py call node_find_by_name '{"name":"Canvas"}'
<py> .workbuddy/tools/cocos_mcp.py res "cocos://project/info"
```
`<py>` = `C:\Users\A\.workbuddy\binaries\python\versions\3.13.12\python.exe`
退出码：0 成功 / 2 服务不可达 / 3 工具返回 isError。

## 3. 重载与重启 `restart_cocos.py`

治「引擎不自动更新」的正解。**优先用软重载，别一上来就重启。**

| 命令 | 耗时 | 做什么 | 适用 |
|---|---|---|---|
| `--status` | <1s | 只报告：进程数 / MCP / 项目 / 场景 / 脏标记 / 代码缓存 | 先看状态 |
| `--soft`（默认） | 3~10s | 刷新资源库 → 等编译 → 软重载场景 → 打印控制台 error/warn | 新加贴图不显示、改了脚本没生效 |
| `--soft --hard-cache` | 10~60s | 上面 + 删 `temp/programming` 强制全量重编译 | 软重载无效、类型改了不生效 |
| `--full --dry-run` | <2s | 预演完整重启计划（不执行） | 重启前先确认 |
| `--full` | 30~180s | 优雅退出编辑器 → 按原命令行重启 → 等 MCP 就绪 → 收尾刷新 | `library/` 缓存坏了、编辑器整体发懵 |
| `--launch` | 30~180s | 编辑器没开时直接启动本项目 | 编辑器不在 |

安全设计：
- `--full` 前会查 `scene_query(action:"dirty")`，**场景有未保存改动会直接拒绝**（除非 `--force`）。
- 先尝试 `Editor.App.quit()` **优雅退出**；失败才 `taskkill /PID <主进程>`；只有 `--force` 才 `taskkill /F /IM`（会影响所有 Cocos Creator 窗口）。
- 非交互环境（无 TTY）默认**不执行** `--full`，需显式 `-y`——避免脚本里误重启。
- 重启命令不是硬编码的，是从活着的编辑器里读 `Editor.App.args` + 主进程 PID 还原出来的，所以换版本/换路径也不会错。

实测（本工程，2026-09-21）：
```
--status  → 进程 18 / MCP ok / 项目 TapBottle / 场景 Main / dirty=False
--soft    → 3.6 秒完成，debug_wait_compile 真的触发了一次编译(2096ms)
--full --dry-run → 还原出的重启命令与 WMI 抓到的真实命令行逐字一致
```

## 4. 编辑器能力地图（按任务）

### 4.1 读：看工程现在长什么样

| 目的 | 调用 | 实测 |
|---|---|---|
| 项目名/路径 | `res cocos://project/info` | ✅ |
| 引擎版本/安装路径/编辑器 home | `res cocos://editor/info` | ✅ |
| 当前场景名+uuid | `res cocos://scene/current` | ✅ |
| 全部场景文件 | `call scene_manage '{"action":"list"}'` | ✅ 返回 `[{uuid, path, name}]` |
| 场景节点树 | `call scene_manage '{"action":"hierarchy"}'` | ✅ 含 uuid/name/children |
| 所有节点（平铺） | `call node_get_all '{}'` | ✅ 含 uuid/name/active/position |
| 按名找节点 | `call node_find_by_name '{"name":"Canvas"}'` | ✅ 返回 uuid + 父节点 |
| 节点详情+组件 | `res cocos://node/{uuid}` | ✅ |
| 组件属性全量 | `res cocos://component/{uuid}` | ✅ |
| 场景整体包围盒 | `call scene_query '{"action":"scene_bounds"}'` | ✅ |
| 场景里用到的类 | `call scene_query '{"action":"classes"}'` | ✅ |
| 场景有效性体检 | `call debug_validate_scene '{}'` | ✅ `issueCount:0` |
| 未保存改动？ | `call scene_query '{"action":"dirty"}'` | ✅ |
| 当前选中对象 | `call editor_selection '{}'` | ✅ |
| 工程设置（含设计分辨率） | `call project_get_settings '{"protocol":"project"}'` | ✅ 返回 `designResolution 720x1280 fitWidth:true` |
| 工程日志文件 | `call debug_logs '{"action":"info"}'` | ✅ 给出 `temp/logs/project.log` |
| 编辑器窗口截图 | `call debug_screenshot '{"target":"window"}'` | ✅ 存 `temp/screenshots/*.webp` |

`scene_query` 里几个 action 必须带参数，否则报错：
`components` 要 `uuid`；`nodes_by_asset` 要 `assetUuid`；`component_has_script` 要 `uuid`。

### 4.2 写：改场景/节点/组件

| 目的 | 调用 |
|---|---|
| 建节点（可带组件、父节点、widget） | `node_manage '{"action":"create", ...}'` |
| 一次建整棵树 | `node_create_tree '{...}'` |
| 删/复制/移动 | `node_manage '{"action":"delete"/"duplicate"/"move",...}'` |
| 批量设属性 | `node_set_property`、`node_set_transform`、`node_set_active`、`node_set_layout`（UITransform+Widget 一把梭） |
| 加/删组件 | `component_manage '{"action":"add"/"remove",...}'` |
| 改组件属性（反射） | `component_set_property`（支持 `db://` 资源路径、枚举名、`{x,y,z}`/`{r,g,b,a}`/`{width,height}` 字面量） |
| 自动绑定 `@property` | `component_auto_bind`（按节点名匹配） |
| 场景存取 | `scene_manage '{"action":"save"}'`、`scene_save_as`、`scene_soft_reload`、`scene_undo` |
| 资源库 | `project_refresh_assets`、`asset_manage '{"action":"create"/"delete"/"move"/"import"/"reimport"/"save_meta",...}'` |
| Prefab | `prefab_create`(simple/replace/from_spec)、`prefab_instantiate`、`prefab_update`、`prefab_edit`、`prefab_validate` |
| 任意编辑器 JS | `execute_editor_script '{"code":"..."}'`（**逃生舱**，见 §5） |

> **本工程基本用不上 4.2**。因为这个项目没有 Prefab、UI 全代码构建，改界面应当改 `.ts` 而不是改场景。
> 4.2 的价值在：验证场景结构、排查节点/组件引用、以及帮其它传统 Cocos 工程干活。

### 4.3 跑与看

| 目的 | 调用 | 实测 |
|---|---|---|
| 启动/停止游戏预览 | `debug_preview '{"action":"start"/"stop","waitForReady":true,"waitTimeout":90}'` | ✅ 能起能停 |
| 编辑器窗口截图 | `debug_screenshot '{"target":"window"}'` | ✅ |
| 抓游戏画面 | `debug_screenshot '{"target":"pages","pages":["X"]}'` | ❌ **失败** `navigate failed` |
| 录屏 | `debug_record '{"action":"start"/"stop"}'` | 未测 |
| 控制台（三源合并） | `read_console '{"action":"get","types":["error","warn"],"sources":["editor","scene","game"],"count":20}'` | ✅（game 源需挂采集，见 §6） |
| 等编译 | `debug_wait_compile '{"timeout":15000}'` | ✅ **timeout 单位是毫秒**，别传秒 |
| 清代码缓存 | `debug_clear_code_cache` | ❌ **3.8.8 报错**：`Menu item 'Developer > Cache > Clear code cache' not found` |

## 5. `execute_editor_script` —— 逃生舱（很好用）

在**编辑器场景进程**里跑任意 JS，`await` 可用。可用全局：`Editor`（完整 Message API）、`cc`、`console`，以及 `process`。

实测可用：
```js
// 拿编辑器真实启动参数 + 主进程 PID
var o={}; o.mainPid=process.ppid; o.args=Editor.App.args;
o.version=Editor.App.version; o.project=Editor.Project.path;
return o;
// → mainPid 26556，args {project: ..., can-show-upgrade-dialog: 'true'}
```
`Editor` 下可用的命名空间（实测枚举）：`App / Dialog / EditMode / I18n / Message / Layout / Menu / Metrics / Network / Package / Panel / Profile / Project / Selection / Task / Theme / UI / User / Utils / Module / Clipboard`。

典型用途：
- 官方工具没覆盖的批量操作（写个循环一次改 50 个节点）
- 读编辑器内部状态（Profile / Project / Settings）
- 优雅退出：`setTimeout(()=>Editor.App.quit(), 80)`（先 return 让响应发出去，再退）

## 6. 让 AI 能「看到游戏」和「读到 game 日志」

这是当前**没接通的一环**（实测确认）：

- `debug_preview` 能起预览，但返回 `gameReady:false`，note：`GameDebugClient did not connect within timeout`
- `debug_screenshot target=pages` 失败（`navigate failed`），因为它依赖 game 侧的页面注册
- `read_console` 的 `game` 源始终为空，因为游戏跑在独立浏览器进程里，日志传不出来

根因：工程的游戏代码**没挂** `extensions/cocos-creator-mcp/client/` 下的两个采集脚本。要接通，在游戏侧加自包含的钩子（**不要把 `extensions/` 的相对路径 import 进 `assets/`，跨目录解析有风险；直接把下面这段抄进 `assets/Scripts/` 里更稳**）：

```ts
// assets/Scripts/Debug/McpBridge.ts —— 只在开发预览时生效
const MCP = 'http://127.0.0.1:3000';
const buf: any[] = [];
(['log', 'warn', 'error'] as const).forEach((lv) => {
    const orig = (console as any)[lv];
    (console as any)[lv] = (...args: any[]) => {
        orig.apply(console, args);
        buf.push({ timestamp: new Date().toISOString(), level: lv,
                   message: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') });
    };
});
setInterval(() => {
    if (!buf.length) { return; }
    fetch(MCP + '/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(buf.splice(0, 50)) }).catch(() => {});
}, 500);
```
接通后 `read_console '{"sources":["game"]}'` 就能拿到游戏运行时的 `console.log/error`。
`McpDebugClient` 则提供 `screenshot`（RenderTexture 抓游戏画面）和 `click`（按节点名点击），通过 `debug_game_command` 调用。
> 这两个钩子未运行时静默失败（`catch` 掉），可以安全留在开发版里。

## 7. 3.8.8 上确认不可用 / 受限的清单（实测）

| 工具 | 状态 |
|---|---|
| `debug_clear_code_cache` | ❌ 菜单项不存在。替代：删 `temp/programming/` 后软重载（`restart_cocos.py --hard-cache` 已封装） |
| `debug_screenshot(target=pages)` | ❌ `navigate failed`，需 game 侧接 `McpDebugClient` |
| `debug_extension(action=list)` | ⚠️ 返回 `[]` + `note: Extension query not supported`；`action=reload` 是否可用未确认 |
| `asset_query` | ❌ 传 `path`/`details` 都失败（返回 `None`），**不可靠**，改用 `project_find_asset` / `res cocos://asset/{uuid}` |
| `preferences_manage(action=get_all)` | ⚠️ 返回空 `{}` |
| `builder_manage(action=get_settings)` | ⚠️ 返回 `null` |
| `project_query_scripts` | ⚠️ 返回 `[]`（疑似只查扩展脚本） |
| `scene_create` | ❌ 3.8.x 已知不支持（README 明说）。绕过：直写 `.scene` JSON + `project_refresh_assets` |
| `debug_wait_compile` | ⚠️ `timeout` 单位是**毫秒**；无待编译任务时返回 `timeout:true`（不是错误）；传 >30s 会撞 MCP 请求超时 |

## 8. 安全边界（改之前先想清楚）

1. **编辑器打开的文件 vs 磁盘文件会互相覆盖**。`.scene` / `.prefab` / `.meta` 这类**只用一种途径改**：要么走 MCP 让编辑器改，要么关掉编辑器改磁盘。`.ts` 脚本直接改磁盘是安全的（编辑器会监听并重编译）。
2. `--full` 会关闭编辑器。虽然先查了 `dirty`，但**非场景状态**（比如没保存的面板输入、临时开的 prefab 编辑模式）会丢。
3. `taskkill /F /IM CocosCreator.exe` 会杀掉**所有** Cocos Creator 窗口，包括其它工程。只在 `--force` 下触发，且会先提示。
4. `execute_editor_script` 有编辑器完整权限，**只能用于本地开发**，别把它接到任何外部输入上。
5. 预览窗口、截图、录屏都会在 `temp/` 下堆文件。`temp/screenshots/` 记得定期清。

## 9. 手写 .scene / .prefab（绕过编辑器直接生成文件）

编辑器 MCP 的 `scene_manage open` 在 3.8.8 上实测**返回 success 但不真的切场景**（树建到了未命名场景上）。
需要批量/程序化建场景时，改为**直接生成 .scene / .prefab 文件**，可控且可校验。
本机工具：`.workbuddy/tools/gen_scene.py`（库）+ `build_main_scene.py` / `build_prefabs.py`（脚本）
+ `check_prefab.py`（校验器）+ `scan_cid.py`（脚本 cid 扫描）。

### 9.1 硬性格式规则（缺一条编辑器就打不开）

| # | 规则 | 反例后果 |
|---|------|---------|
| 1 | `arr[0]` 必须是 `cc.Prefab`（`data` → 根节点 idx 1） | 不识别为预制体 |
| 2 | 每个 **Node** 有 `_prefab` → `cc.PrefabInfo`（`root`→1、`asset`→0、`fileId` 22 字符） | 双击打不开 |
| 3 | 每个 **Component** 有 `__prefab` → `cc.CompPrefabInfo`（`fileId`） | 双击打不开 |
| 4 | **prefab 里所有 node/component 的 `_id` 必须是空串 `""`** | 被当成脏数据 |
| 5 | **scene 里 `_id` 是标准 uuid**（与 prefab 相反！） | — |
| 6 | scene 根 Canvas 的 `_parent` 必须显式指回 `arr[1]`(cc.Scene) | 见下 |
| 7 | PrefabInfo 插入位置 = **DFS 后序**（该节点的子组件全部排完之后） | — |

规则 6 漏掉的后果极隐蔽：`node.scene === null` → 整棵树 `UITransform.hitTest` 抛
`Cannot read properties of null (reading 'renderScene')` → **画面完全正常，但所有点击全废**。

### 9.2 脚本组件的 `__type__` 是编译期 cid，不是脚本 uuid
`temp/programming/packer-driver/targets/editor/chunks/**` 里有
`_RF.push({}, "<22字符cid>", "<类名>")`。用 `scan_cid.py` 扫出「类名→cid」映射表并缓存到
`.workbuddy/_cid_map.json`。写错会用 uuid，构建报 `Script ... is missing or invalid`。

### 9.3 验证闭环（三重）
1. `check_prefab.py <file>` —— 拿参考工程的 prefab 跑一遍确认校验器自身规则归纳正确；
2. `prefab_validate{uuid}` → `valid:true`，再 `prefab_edit{action:"open", path, force:true}`
   → 返回 `mode:"prefab-edit"` 即等价于双击打开成功，再用 `scene_manage{hierarchy}` 看树；
3. `prefab_edit{action:"close", save:true}` 让编辑器保存一次，diff 保存前后
   —— **只应差 `fileId` 随机值**（实测字节级等价）。

### 9.4 meta 字段（照抄编辑器真产物）
`ver:"1.1.50"`、`imported:true`、`files:[".json"]`、`userData.syncNodeName:<根节点名>`。
**补全 meta 时要保留已有 uuid**，重分配会静默断掉按 uuid 的引用。

### 9.5 改完必须跑
`typecheck.py` → 命令行构建 → 无头验收。构建 exit code 会骗人（编辑器占 3000 端口返回 36），
看日志 `build Task (web-mobile) Finished` + 0 个 `missing or invalid` 才作数。

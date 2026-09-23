# 编辑器 MCP · cocos-creator-mcp

> ⚠️ **本文是工具清单（含从扩展 README 抄来的条目，未逐条验证）。**
> **要看「在本机 3.8.8 上哪些真能用、怎么用、怎么重启」→ 读 `editor-ops.md`（实测版）。**
> 两处实测已纠正的差异：`debug_clear_code_cache` 在 3.8.8 **报错不可用**；`debug_screenshot(target=pages)` **失败**；
> `asset_query` 不可靠；`debug_wait_compile` 的 `timeout` 单位是**毫秒**。

工程里已装了这个扩展：`extensions/cocos-creator-mcp/`（v2.0.0，本机实测 66 个工具）。
它让 AI 直接操作 **Cocos Creator 编辑器进程**——建节点、改属性、存 prefab、构建、预览、截图、读控制台。

配置：`settings/cocos-creator-mcp.json` → `{ "port": 3000, "autoStart": true }`。
命令行客户端：`.workbuddy/tools/cocos_mcp.py`（不用挂 MCP 客户端也能调）。

## 先确认服务在不在

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","tools":64}
```
Windows 下 shell 若不可用，用 PowerShell：`Invoke-RestMethod http://127.0.0.1:3000/health`。
**返回失败 = 编辑器没开，或扩展没启动。** 此时不要报错卡住，改用纯文件级编辑（本项目本来就以代码为主，编辑器不是必需的）。

启动路径：Cocos Creator → 扩展 → 扩展管理器 → 启用 **Cocos Creator MCP** → 扩展 → Cocos Creator MCP → Open Panel → **Start Server**。

## 接入本机 AI 客户端

写入 `~/.workbuddy/mcp.json`（**注意不是 `.mcp.json`**），二选一：

```jsonc
// 方案 A：stdio 桥（推荐，避开 http 型 MCP 的 OAuth 自动注册 bug）
{ "mcpServers": { "cocos-creator-mcp": {
    "command": "node",
    "args": ["E:\\LDC_Cocos_PJ\\...\\TapBottle\\extensions\\cocos-creator-mcp\\client\\stdio-bridge.js"]
} } }

// 方案 B：直连 HTTP
{ "mcpServers": { "cocos-creator-mcp": {
    "type": "http", "url": "http://127.0.0.1:3000/mcp"
} } }
```
写完后**不会自动生效**：到连接器管理页右上角的「自定义连接器」入口，对新服务器点「信任」。

## 工具清单（按用途分组）

| 分组 | 工具 |
|---|---|
| **场景** | `scene_manage(open/save/close/list/current/hierarchy)`、`scene_create`、`scene_save_as`、`scene_set_parent`、`scene_soft_reload`、`scene_clipboard(copy/paste/cut)`、`scene_undo(snapshot/begin/end/cancel)`、`scene_array(move/remove)`、`scene_reset(transform/property/component/restore_prefab)`、`scene_query(dirty/ready/classes/components/nodes_by_asset/scene_bounds)`、`scene_execute_script`、`scene_execute_component_method` |
| **节点** | `node_manage(create/delete/duplicate/move)`、`node_create_tree`（一次建整棵树）、`node_set_property`、`node_set_transform`、`node_set_active`、`node_set_layout`、`node_get_info`、`node_find_by_name`、`node_get_all`、`node_detect_type` |
| **组件** | `component_manage(add/remove/available/enum)`、`component_set_property`（反射赋值）、`component_auto_bind`（按节点名自动填 `@property`） |
| **Prefab** | `prefab_edit(open/close)`、`prefab_create(mode: simple/replace/from_spec)`、`prefab_instantiate`、`prefab_update`、`prefab_revert`、`prefab_duplicate`、`prefab_validate` |
| **资源** | `asset_manage(create/delete/move/copy/save/reimport/import/save_meta/open_external)`、`asset_query(path/uuid/url/details/dependencies/users/missing/ready/generate_url)` |
| **工程** | `project_refresh_assets`（新增文件后必调）、`project_get_asset_info`、`project_find_asset`、`project_get_settings`、`project_set_settings`、`project_query_scripts` |
| **调试** | **`read_console`**（Editor/Scene/Game 三源日志合并，可过滤 error/warn）、**`execute_editor_script`**（任意编辑器侧 JS）、`debug_execute_script`、`debug_logs`、`debug_validate_scene`、`debug_wait_compile`、`debug_clear_code_cache`、`debug_preview`、**`debug_screenshot(target: window/pages)`**、`debug_game_command`、`debug_record(start/stop)`（录屏 MP4/WebM）、`debug_list_messages` |
| **视图** | `view_gizmo`、`view_settings`、`view_camera(focus_on_nodes/...)` |
| **其它** | `preferences_manage`、`builder_manage`、`server_status`、`refimage_manage/set/query`、`selection-tools` |

### MCP Resources（只读，用 URI 读）

`cocos://scene/current`、`cocos://scene/list`、`cocos://scene/hierarchy`、`cocos://node/{uuid}`、`cocos://node/{uuid}/components`、`cocos://component/{uuid}`、`cocos://prefab/list`、`cocos://prefab/{uuid}`、`cocos://project/info`、`cocos://project/engine`、`cocos://editor/info`、`cocos://asset/{uuid}`
→ **`cocos://project/engine` 能直接确认引擎版本与安装路径**，比猜靠谱。

## 值引用写法（`component_set_property` / `prefab_create_from_spec`）

```jsonc
{ "value": "db://assets/textures/foo.png" }              // 资源路径
{ "value": "<uuid>" }                                     // 资源/节点 UUID
{ "value": "@path:Canvas/Background" }                    // 场景内节点路径
{ "value": "HORIZONTAL" }                                 // 枚举名（v2 新增，也接受数字）
{ "value": { "x": 100, "y": 50, "z": 0 } }                // cc.Vec3
{ "value": { "r": 255, "g": 0, "b": 0, "a": 255 } }       // cc.Color（0~255）
{ "value": { "width": 200, "height": 100 } }              // cc.Size
```

## 典型用法

```
1) 改脚本后先 project_refresh_assets，再 debug_wait_compile，然后 read_console(types:["error"]) 确认编译过
2) 看编辑器状态：debug_screenshot(target:"window") → Read 那张图（注意本工程场景是空的，画面价值有限）
3) 抓运行时报错：read_console(sources:["game"], types:["error"])   ← game 源需要游戏侧挂采集钩子
4) 新拷入的图/音效：project_refresh_assets 让它生成 .meta
5) 改了不生效：优先跑 .workbuddy/tools/restart_cocos.py --soft（详见 editor-ops.md）
```
> ⚠️ 上面第 2 条原写的是 `target:"pages"` —— **实测在 3.8.8 上失败**（`navigate failed`）。要抓游戏画面必须先在游戏侧接 `McpDebugClient`。
> ⚠️ 清缓存原写 `debug_clear_code_cache` —— **实测报错菜单项不存在**，改用 `restart_cocos.py --hard-cache`。

### 游戏预览日志（game 源）需要手动挂

`client/McpConsoleCapture.ts` 会 hook `console.log/warn/error` 并 POST 到 `http://127.0.0.1:3000/log`。
在游戏代码里加一次：
```ts
import { initMcpConsoleCapture } from '../../extensions/cocos-creator-mcp/client/McpConsoleCapture';
initMcpConsoleCapture();
```
（未运行时静默忽略，开发版可长期留着。）
`client/McpDebugClient.ts` 则提供 AI 驱动游戏的能力：内置 `screenshot` / `click(nodeName)`，并支持 `customCommands` 注册项目专属命令，通过 `debug_game_command` 调用。**本项目目前没挂这两个脚本**——需要时再挂，并记得它们依赖 `extensions/` 目录存在。

## 限制与坑

**本机实测确认（3.8.8，完整清单见 `editor-ops.md` §7）：**

| 工具 | 实测结果 |
|---|---|
| `debug_clear_code_cache` | ❌ 报错 `Menu item 'Developer > Cache > Clear code cache' not found`。替代：删 `temp/programming/`（`restart_cocos.py --hard-cache` 已封装） |
| `debug_screenshot(target=pages)` | ❌ `navigate failed`（需游戏侧接 `McpDebugClient`）；`target=window` ✅ 可用 |
| `debug_preview` | ✅ 能起停，但 `gameReady:false`（同上原因） |
| `debug_wait_compile` | ⚠️ `timeout` 单位是**毫秒**；无编译任务时返回 `timeout:true` 属正常；传 >30s 会撞 MCP 请求超时 |
| `asset_query` | ❌ 传 `path`/`details` 均失败，不可靠 → 改用 `project_find_asset` |
| `debug_extension(action=list)` | ⚠️ 返回 `[]` + `note: Extension query not supported` |
| `preferences_manage(get_all)` / `builder_manage(get_settings)` | ⚠️ 返回空 |
| `execute_editor_script` | ✅ 完全可用，`Editor` / `cc` / `process` 都在，能拿 `Editor.App.args` 和主进程 PID |

**其余（来自 README / 历史经验）：**

- **`scene_create` 在 3.8.x 不工作**：底层 Editor 消息没暴露。绕过方式：直接往 `assets/` 写 `.scene` JSON，再 `project_refresh_assets`。
- `view_*` 系列在 3.8.x 上部分 API 不支持，会返回 `note` 而不是报错，**要检查返回值**。
- Prefab 属性保存曾有 `Widget._alignFlags: 45` 卡住的老 bug，v1.14.0 已修；**纯代码创建的 Widget 不受影响**。
- 工具的 `category_action` 命名：一个工具带 `action` 参数切行为（如 `scene_manage(action:"save")`），不要按 v1 的老名字调用。有些 action 还要求必填参数（如 `scene_query(components)` 要 `uuid`、`nodes_by_asset` 要 `assetUuid`），缺参直接报错。
- 它操作的是**编辑器里打开的工程**，与直接改磁盘文件**会互相覆盖**。改 `.scene` / `.prefab` 这类编辑器打开的文件时，**只用一种途径**：要么让编辑器改，要么关掉编辑器再改文件。`.ts` 脚本文件直接改磁盘是安全的（编辑器会监听重编译）。

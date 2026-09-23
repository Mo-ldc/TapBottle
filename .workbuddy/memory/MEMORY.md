# TapBottle 项目长期备忘

竖屏点瓶子（Bottle Flip Inc 复刻），Cocos Creator 3.8.8，`D:\CoCosIDE\Creator\3.8.8`。

## 硬约定
- **无 Prefab**：UI 全部由 `assets/Scripts/UI/UIKit.ts` 的工厂函数运行时构建；`Scenes/Main.scene` 只有 Canvas+Camera+GameRoot。
- **数值唯一真理源**：`GDD_Bottle_Flip_Inc_Cocos.md`（项目根）→ 落到 `Core/GameConfig.ts`（LAYOUT/TIERS/BOTTLE_STATS/SKILL_GRAPH/MACHINE/PLAY_AREA/WORLD_ENV/SAFE_BLOCKS）。
- 状态单例 `G`（`Core/State.ts`，`addListener`/`notify`）；面板刷新走 `PanelHost` 节流 0.15s。
- 资源单例 `Res.I`，贴图/音效必须在 `Core/Res.ts` 的 `TEXTURE_PATHS`/`AUDIO_PATHS` 登记，且只认 `assets/resources/` 下的文件。
- 瓶盖经济：未解锁 `p_machine` → 瓶盖直接入账；解锁后 → 只累加 `G.pendingCaps`，由 `CapMachine` 运到顶端 `recycleCaps()` 才真正入账（在途量进存档）。

## 必须遵守的流程
- **改完源码先 `python .workbuddy/tools/typecheck.py`（源码 0 错）再构建** —— Cocos 命令行构建**不因 TS 报错而失败**，坏代码会静默进包。
- 构建：`unset ELECTRON_RUN_AS_NODE` 后
  `"D:/CoCosIDE/Creator/3.8.8/CocosCreator.exe" --project <项目> --build "platform=web-mobile;debug=true"`（约 6~17 秒，产物 `build/web-mobile`）。
- 验收：`E:\LDC_Fby\_cdp.py`（无头 Chrome + CDP）+ `_run4.py` 四比例跑批（`_testgx.tpl` 模板）。
  **无头视口 = 窗口高 - 68**；比例窗口：`p16 720×1348 / tall 720×1668 / tab 720×1028 / wide 1280×868`。
- **同一文件一次只发一处编辑**（并行多处编辑会互相覆盖且都返回 success），改完按「关键字必须出现」写脚本校验。

## 竖屏自适应（已定稿，2026-09-22）
- `FIXED_WIDTH` + `contentRoot` 整体 `s = min(1, vh/1280)` 缩放居中；真机竖屏 s=1 不生效（不留黑边）。
- s=1 时 `hudDY/navDY` 把顶部/底部 UI 块钉到安全区（抽屉跟着底部走），中部舞台按 `WORLD_ENV` 包络
  `ws = min(fitH, fitW)` 缩放并使「瓶子活动区 + 履带」整体水平居中、垂直居中于上下 UI 之间。
- 屏幕比 9:16 更宽（平板/桌面浏览器）走 s<1：整板缩小 + 左右留黑（有意取舍）。

## ★ 运行时改色必须走 tint()，禁止 Color.fromHEX(x.color, ...)（2026-09-22）
- Cocos `Renderable2D.color` setter 第一步 `if (this._color === value) return;`，
  而 `sp.color` 返回的就是内部 `_color` 本体 → `Color.fromHEX(sp.color, '#..')` 就地改色后
  引用未变 → setter 提前 return → **`_updateColor()` 从不执行 → 渲染仍是旧顶点色（贴图原色）**。
  读回来的 `sp.color` 却是新值，极难发现。
- 统一用 `UIKit.tint(spriteOrLabel, '#RRGGBB')`（内部新建 Color 再整体赋值）。
  构建期传色（`label(..., {color})`、`setFrame(sp,...,color)`、`roundedPanel`/`rect`）走 setter，本来就没问题。
- 同理：`Graphics` 改色要 `clear()` + 重描；节点卡底图用 `ui/card_white` 九宫格染色，
  **别用 `ui/slot`**（土黄木槽贴图，染任何色都脏）。

## 技能树 / 升级面板（2026-09-22 重做）
- 技能树 `NODE_SIZE 112 / STEP_X 120 / STEP_Y 124`；节点三层：glow(S+16 脉动) / ring(S+8 状态描边) / card(S 内芯)，
  五态皮肤 `SKIN`（locked/poor/buy/owned/max）；挂锁是右上角**角标**不遮图标；
  底部信息条整条即购买按钮；打开自动滚到首个 `buy` 节点。
- 抽屉 `drawerH 600 / openY -288 / closedY -856`，滚动区 496；
  **抽屉底沿会盖住底栏 → 页签搬进抽屉头部 + 开合时 `navRoot.active = !open`**；
  `Drawer.setTab()` 里 content 的 y 写 `SCROLL_H/2`（view 局部坐标，不是 drawer 坐标）；
  按钮统一 `skinBtn(btn, lb, 'on'|'off'|'max')`，不用 `ui/btn_long_active`。
- 履带（`CapMachine`）**解锁前是暗的且瓶盖直接入账**，要 `skLv('p_machine')>0` 才运转：
  路径 `sk_root`(免费) → `g_capgain`(50) → `p_machine`(180)。

## 三态与几何（易错）
- `bottle/body_*.png` 贴图本身是**瓶口朝下**：`ok`(瓶口朝上)=angle 180 + `dy 0.32H`；`crit`(扣盖)=angle 0；`fail`(平放)=±93° + `dy -0.106H`。
- **附属件（影子）锚在 `homeY`（地面线）**，不要锚在会随姿态位移的本体节点上。
- 装饰性子节点要贴住主体且落在 `WORLD_ENV` 内，否则超高屏舞台缩放后会在空隙里露出来。

# TapBottle 项目长期备忘

竖屏点瓶子（Bottle Flip Inc 复刻），Cocos Creator 3.8.8，`D:\CoCosIDE\Creator\3.8.8`。

## 硬约定
- **无 Prefab**：UI 全部由 `assets/Scripts/UI/UIKit.ts` 的工厂函数运行时构建；`Scenes/Main.scene` 只有 Canvas+Camera+GameRoot。
- **数值唯一真理源**：`GDD_Bottle_Flip_Inc_Cocos.md`（项目根）→ 落到 `Core/GameConfig.ts`（LAYOUT/TIERS/BOTTLE_STATS/SKILL_GRAPH/MACHINE/PLAY_AREA/WORLD_ENV/SAFE_BLOCKS）。
- 状态单例 `G`（`Core/State.ts`，`addListener`/`notify`）；面板刷新走 `PanelHost` 节流 0.15s。
- 资源单例 `Res.I`，贴图/音效必须在 `Core/Res.ts` 的 `TEXTURE_PATHS`/`AUDIO_PATHS` 登记，且只认 `assets/resources/` 下的文件。
- 瓶盖经济（**2026-09-23 第五轮改正**）：**没在商店买下「瓶盖机器」之前，扣盖完全不产出瓶盖**
  （`doFlipResult` 里 `if (!hasMachine) caps = 0;`，桌台下方也不画履带 —— `CapMachine` 整节点 `active=false`）。
  机器本身是**商店设施、$1,000 金币**（`MACHINE.buyPrice`，存档字段 `data.machine`），不是技能树节点。
  买下之后：瓶盖只累加 `G.pendingCaps`，由 `CapMachine` 运到顶端 `recycleCaps()` 才真正入账（在途量进存档）。
  ⚠️ `CapMachine` 在 `active=false` 时 `update()` 不跑 → 必须 `G.addListener(() => refreshLock())` 才能在买下机器（notify）时醒过来。

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

## 技能树 / 升级面板（2026-09-22 重做，2026-09-23 尺寸微调）
- 技能树 `NODE_SIZE 112 / STEP_X 130 / STEP_Y 124`（列缝 18px）；节点三层：glow(S+16 脉动) / ring(S+8 状态描边) / card(S 内芯)，
  五态皮肤 `SKIN`（locked/poor/buy/owned/max）；挂锁是右上角**角标**不遮图标；
  底部信息条整条即购买按钮；打开自动滚到首个 `buy` 节点（当前四张图根节点都在最上一行 → 初始 offset 恒为 0）。
- 升级面板 `drawerH 820`，滚动区 `820-104-28 = 688`（`SCROLL_Y = -410+28+344 = -38`）；页签在卡片头部；
  `Drawer.setTab()` 里 content 的 y 写 `SCROLL_H/2`（view 局部坐标，不是 drawer 坐标）；
  按钮统一 `skinBtn(btn, lb, 'on'|'off'|'max')`，不用 `ui/btn_long_active`。
- 履带（`CapMachine`）**解锁前是暗的且瓶盖直接入账**，要 `skLv('p_machine')>0` 才运转：
  路径 `sk_root`(免费) → `g_capgain`(50) → `p_machine`(180)。

## ★ UI 出场/收起一律「中央 Q 弹 + 缩放回去」（2026-09-23 定稿）
- 用户明确要求：**任何面板都不许从下方滑入**。统一用 `UI/UIKit.ts`：
  `popIn(n, 0.32)` = 0.72 → 过冲 1.07 → 回落 1（`backOut`+`sineInOut`）；
  `popOut(n)` = 1 → 0.78 + 淡出 → 回调里复位 scale 并销毁/隐藏；
  `maskIn/maskOut` 只管遮罩透明度（遮罩**不能**跟着缩放，否则整屏会「涨大」）。
- `popIn/popOut` 内部 `Tween.stopAllByTarget` 清旧 tween（连点导航时开/关互相打断会出现「弹一半就消失」）。
- ⚠️ `popOut` 会把 UIOpacity 复位成 255 → **不能在已经淡到 0 的节点上再调 popOut**（会闪一下），Toast 自己内联做缩放+淡出。
- 升级面板（原「底部抽屉」）已是**居中模态卡**：全屏遮罩（点击关闭）+ 卡片挂 `BlockInputEvents`（防点卡片空白处穿透到遮罩被误关）；
  `drawerH 820`、卡片在 contentRoot 原点；`drawerLayer` 不再跟随 `navDY`；打开时**保留底栏**（只同步高亮），不再 `navRoot.active=false`。
- `MASK_SIZE`（UIKit 导出）由 `GameRoot.applySafeLayout` 按可见设计区动态写：宽屏/超高屏写死 900×1500 会露出没压暗的边缘。
- 面板类（`openPanel` → 技能树/成就/统计/设置）、离线弹窗、删档确认全部收敛到这套。

## 验收脚本（UI 动效专用）
- `E:\LDC_Fby\_testui.tpl` + `_runui.py`（四比例）—— 用 `__SAMPLE()` 采 `cardUI.getScale().x` 曲线证明 Q 弹
  （实测 `0.720 → 1.104 → 1.000`），截图落 `_shots/ui<ratio>N.png`（注意 `___TAG___` 占位两侧的下划线会被吃掉）。
- 跑批脚本里 `window.cc` **不含** `cc.UITransform`/`cc.UIOpacity` → 必须用 `getComponent('cc.UITransform')` 字符串形式。
- `__tb.drawer` 暴露的是**类**，实例在 `__tb.drawer.I`（同理 `__tb.field.I`）。

## ★ 状态指示特效不许盖住游戏区（2026-09-23 定稿）
- 「状态类」特效（狂暴火焰 `berserkFx`、处决刀 `samuraiFx`）**必须**：① 挂 `navRoot`/`abilityBar` 并 `setSiblingIndex(0)`
  排在 UI 之下（只从缝隙透出来，不遮任何东西）；② 尺寸只比 104×104 的能力按钮大一圈（火焰 176×224、刀 160×184）；
  ③ 位置每帧跟随按钮 `btn.position.x`（能力条会按解锁数量重排）。
  反面教材：原来火焰 220×290 摆在 `(-230, navY+250)` 压在桌面左下，武士刀 700×900 直接铺满屏。
- **光标 = 范围圈 + 指针两层，层级需求相反，必须拆成两个独立节点**（2026-09-23 修正）：
  `cursorRing`（`env/areacircle` 染 `#FFD75E`、opacity 55、随升级放大到 `r*2`）→ `setSiblingIndex(0)` 当地面贴片（压在影子/瓶子之下）；
  `cursorPin`（`env/cursor`）→ 追加到子节点末尾 = 最上层（用户要求「要在上层」）。
  ⚠️ 曾经共用一个容器、整容器 sib=0，手指跟着沉底被瓶子挡住。
  `cursorPin` 内部是「无渲染容器 + shadow 子节点 + hand 子节点」（Cocos 同节点自身 Sprite 先画、子节点后画，
  把投影做成兄弟会盖在手指上）；shadow = 同贴图染 `#101010`、opacity 95、偏 (3,-4)，让手指压在粗黑描边的瓶子上仍可读。
  贴图中心按指尖偏移让位：PIL 量得指尖在中心 `(−0.048,+0.487)` 比例处 → `pin = pointer + (+2.7, −29.2)`，指尖才精准落在触摸点。
  首次可用时 `pointer` 播种到 `PLAY_AREA` 中心，否则停在节点原点。
- **指针输入必须四路都接**：节点级 `TOUCH_START/MOVE` + `input TOUCH_START/MOVE` + `input MOUSE_DOWN/MOUSE_MOVE`。
  桌面浏览器鼠标**按下**派发 `MOUSE_DOWN` 而非 `TOUCH_START`；且 `Bottle.enableTouch` 里 `propagationStopped=true`
  会截断点在瓶子上的节点级 TOUCH_START。`Modal.open` 时整个光标隐藏。
- 状态可读性兜底：HUD 已有「狂暴 ×N +X% / 决意 %」文字行 + 触发 Toast + 屏幕闪光，特效只做辅助，别指望它当唯一指示。

## 构建 exit code 会骗人（2026-09-23）
- 本机常有用户手动开的 Cocos 编辑器会话占着 `127.0.0.1:3000`（MCP），命令行构建与它撞车时
  `CocosCreator.exe --build` 会返回 **exit 36**，日志出现 `Exit process with code:null, signal:SIGTERM in task build-script`，
  但同一份日志结尾是 `build Task (web-mobile) Finished in (Ns)`，**产物其实已经写好**（debug 构建不压缩、注释都在，可直接 grep 新符号验证）。
- 判定构建是否成功：看日志 `build Task (...) Finished` + 在 `build/web-mobile/assets/main/index.js` 里 grep 本次新增的独有字符串，
  **不要只看 exit code**。

## ★ 内容对齐原版 v1.1（2026-09-23 第二轮，数值层全部换血）
- `Core/GameConfig.ts` 已是「原版真实数值」版：`TIERS`（BaseIncome $1→$2500 / TimesIncome ×1→×7 / techCost 1600~90000 瓶盖 /
  shopBase $7~$2500 + shopGrowth / cap 全 30 / hoverCost / critMult 5.0（铜瓶 6.0） / mass 1.0~2.5）、
  `BOTTLE_STATS`（**11 词条 + 1 一次性悬停解锁 = 12 行**，每行 `tiers[7]` 带 base/max/r/step 的真实矩阵）、
  `SKILLS`（四大分支真实节点：瓶子 6 / 玩家 13 / 助手 12 / 技能 9）、`FLIP`（容差角 18°×(1+0.1L) 等）。
- 四页签技能树：`SKILL_GRAPH` / `PLAYER_GRAPH` / `HELPER_GRAPH` / `ABILITY_GRAPH`，画布只有 **5 列**（col −2..2，NODE_STEP_X 120 / CANVAS_W 640）。
- **瓶子的悬停触发是「每阶各自一次性解锁」**（不是全局）：`State.hoverUnlocked/hoverable/anyHover/buyHover`；
  未解锁该阶 → 该阶瓶子只能点击翻转、光标圈压根不出现；解锁后 → 手指圈（半径 `0.55m×(1+0.05L)` = 55~82.5px）只触发圈内**该阶已解锁**的瓶子。
  实现在 `BottleField.update()` 的光标循环里（`if (!G.hoverable(b.tier)) continue;`）。
- 判定改**角度制**：`State.rollLanding()` 掷目标角 0°/180° + 近似正态误差（受 mass 与 `p_stability` 影响），`outcomeOf()` 用容差角判三态。
- 助手只抓「已购自动化许可」的阶数：`HELPER_PERMIT[1..6]` → `h_bronze..h_diamond`；T1 天生允许。上限 = 10 + 5×`h_limit` 级。
- 旧存档兼容：`SAVE_VERSION 5`，版本不符时**只重置 `tierStats` 与 `skills`**（词条索引与技能 id 空间都重排过），货币/瓶子/成就/设置保留。
- 数值自检脚本：改完跑 `E:\LDC_Fby\_testv11.tpl` + `_runv11.py`（dump `incomeT1/tolT1/capT1/costT2/techT2/hoverT1/cursorR/handCost/cokeCd/berserkMult` 与 T1 十二行词条，逐项对 GDD §4.1/§4.2）；
  悬停流程自检：`_testhover.tpl`（A~E 五个阶段打印 `r= / flips= / 各瓶到指针的距离 + 是否 hoverable`）。

## ★ 模态面必须实心 + 滚动区下沿要落进行间隙（2026-09-23 第三轮）
- **面板/弹窗底色一律 6 位 hex（alpha=FF）**。曾经用 `#171E2BF7`（96.9%），剩下 3% 会让背后 HUD 的
  金色金额与图标透出来（放大 3 倍可见，逐行取样 +6~10 灰阶），用户描述为「文本层级貌似被挡住了」。
  已改：`Panel.frame #171E2B` / `Drawer.bg #141A24` / 离线弹窗与删档确认 `#1B2230`；`modalMask` alpha 170→200。
- **ScrollView 下沿切在节点文字上**是「文字被挡住」的另一种成因。节点在内容里按 `NODE_STEP_Y` 排格，
  节点中心距内容顶 `P = padTop + NODE_SIZE/2`；要让下沿落进行间隙，必须
  `SCROLL_H ≡ P + NODE_STEP_Y/2 (mod NODE_STEP_Y)`，并把初始 offset 对齐到 `NODE_STEP_Y` 的整数倍。
  本项目：`P=140`、`STEP_Y=124` → 需 `SCROLL_H ≡ 78`；原来写死 620（≡0）→ 每次都在名称文字中间划一刀。
  现 `SCROLL_H=574 / SCROLL_Y=-15`（视口 −302…272，上下各留 30px）。
- **所有滚动列表必须给滚动指示条**，否则用户不知道下面还有内容。`UIKit.scrollView()` 现在自带 `UIScrollBar`
  组件（track 6px 白 alpha28 / thumb 6px `#C8A44A`，挂在 `parent` 上=视口外，不参与滚动也不被 Mask 裁）。
  它每帧只比对 content 高度与 offset，变了才重排，零调用点改动。
  ⚠️ 指示条是 `parent` 的子节点，**override 滚动区 Y 时要同步搬它**（见 `SkillPanel.openSkill` 里的 `sbar`）。
- **卡片内三级文本**（技能树节点）：图标 44@y28 / 名称盒 106×30@y-16（可两行，行高 15）/ 状态盒 22@y-42，
  三段零重叠。长名要么压到 ≤6 汉字，要么在 Locale 里用 `\n` 手动断行（Cocos Label 认 `\n`）；
  信息条那种单行位要 `.replace(/\n/g,' ')`。
- 升级面板词条行：行高 118 / 行距 128 / 描述框 320×54（3 行）/ 按钮 y=-20；
  `Drawer` 加 `BOTTOM_PAD 28`，滚动区下沿从卡片描边上收回 28px（否则描边切掉最后一行）。
- 跑批脚本坑：传给 `_cdp.py` 的那个输出路径会被**终态截图覆盖**，首张截图必须换个文件名。
  另外 `tail`/`dirname` 在本机不可用，`&&` 链会整条短路（曾出现「构建根本没跑却 echo exit=127」）。

## ★ 「建得早 = 画得早」：特效层被后续建的内容压住（2026-09-23 第六轮）
- `fxLayer`（所有飘字：`+$N` 金币 / `扣盖` / `MISS` / `处决 +600%`）在 `GameRoot.onLoad()` 里就挂进了 `worldLayer`，
  而 `table / bottles / hands / caps` 是后面 `buildWorld()` 才建的 —— 兄弟序上 **fx 永远是第 0 个**，
  于是后建的桌面把整个特效层盖住，桌面上战斗时一个字都看不到。
- 现场判据（一行动手就有答案）：`worldLayer.children` 的打印顺序。
  修法：`buildWorld()` 末尾 `this.fxLayer.setSiblingIndex(this.worldLayer.children.length - 1);`
- 通用规则：**任何「容器层」都不能在 onLoad 里建完就完事** —— 只要后续还有人往同一个父节点 addChild，
  就要在全部建完之后重新把该层顶到末尾。
- 顺带记住飘字的可见窗口：`floatText(..., dur=0.85)`、`fadeStart=0.42` →
  **只有落地后前 0.36s 是满不透明**。抓帧验证要卡在落地后 0.2~0.4s，晚了会误判成「没渲染」。

## ★ 点击命中一律自己算，不用节点事件（2026-09-23 第七轮）
- `Bottle` 节点的 `UITransform` 原来写 100×200，而**可见瓶身贴图是 150×375**（再乘 `BOTTLE_SCALE`）
  → 命中框比看得见的瓶子小一半多，点瓶口/瓶底打空；打空后事件回落到场地的「空白处随机翻一只」
  → 玩家看到「点 A 翻了 B」。节点事件在矩形重叠时也只有最上层收得到。
- 现行方案：`Bottle.hitTest()`（逆变换进节点本地 + 判瓶身贴图矩形 `ART_W/H/AY = 150/375/0.34`，
  姿态旋转自动生效）+ `BottleField.tapAt()`（命中的瓶子**全部**各翻一次 = 瓶子之间互不阻挡/可穿透）。
  `Bottle.enableTouch` 已删除，场地也**不再**「点空白随机翻一只」。
- ⚠️ 两条铁律：
  1. **`pointer` 是点击命中与悬停共用的输入源，`aim()` 里绝不能带 `!G.hasCursor` 这类解锁条件**
     （开局没光标 → pointer 永不更新 → 点击完全失效）。光标显示与否在 `update()` 里单独 gate。
  2. `hitTest` 内部用 `convertToNodeSpaceAR`（要**世界坐标**），而 `pointer` 存的是 **field 本地坐标**
     → `tapAt` 必须先 `convertToWorldSpaceAR` 换算。（造临时 Vec3 用 `node.getWorldPosition().clone()`，
     无头脚本里 `window.cc` 没有 `cc.Vec3`。）

## 三态与几何（易错）
- `bottle/body_*.png` 贴图本身是**瓶口朝下**：`ok`(瓶口朝上)=angle 180 + `dy 0.32H`；`crit`(扣盖)=angle 0；`fail`(平放)=±93° + `dy -0.106H`。
- **附属件（影子）锚在 `homeY`（地面线）**，不要锚在会随姿态位移的本体节点上。
- 装饰性子节点要贴住主体且落在 `WORLD_ENV` 内，否则超高屏舞台缩放后会在空隙里露出来。

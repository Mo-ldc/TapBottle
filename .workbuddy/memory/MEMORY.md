# TapBottle 长期备忘

竖屏点瓶子（Bottle Flip Inc 复刻），Cocos 3.8.8（`D:\CoCosIDE\Creator\3.8.8`）。
逐轮细节见 `.workbuddy/memory/2026-09-2*.md`；本文件只留**最难重新发现的规则**。

## 硬约定
- **无 Prefab**：UI 全由 `assets/Scripts/UI/*` 运行时构建；场景只有 Canvas+Camera+GameRoot。
- 数值唯一真理源 `GDD_Bottle_Flip_Inc_Cocos_v1.1.md` → `Core/GameConfig.ts`；状态单例 `G`
  （`Core/State.ts`，addListener/notify）；资源单例 `Res.I`，贴图必须登记 `Core/Res.ts` 的
  `TEXTURE_PATHS`（只认 `assets/resources/`）。
- 皮肤统一 `UI/Theme.ts`（`WOOD` + woodPlate/woodButton/chipPlate/woodBanner/woodRail/beltFace）；
  控件用 Graphics 画，只有木纹/瓶身/机器/滚筒/猫爪/绿叶用贴图。
- 购买引导统一走 `UI/Guidance.ts`（差额提示 + 「去研发」跳转 + 「下一步」）；跳转用注入的
  NavBridge，别直接 import 面板（BottomPanel 反向依赖 Guidance，会成环）。
- **底栏四件【商店】【升级】【技能树】【下拉框】**（第十轮起内嵌面板，非弹窗）：
  `UI/BottomPanel.ts` 常驻在底栏下方（navRoot），内容口径对齐原版解析
  （`E:\LDC_Fby\BottleFlipInc\_analysis\model.json` + report_cn.txt）：
  · 商店（无下拉全平铺）= 每阶「买瓶数量」按钮 + 瓶盖机器 + 助手之手；
  · 升级（无下拉全平铺）= 研发下一阶(页顶) + 每阶词条（名字加「瓶子·」前缀；悬停翻转也在升级页，原版数据如此）
    + 光标圈大小(需光标天赋 p_cursor) + 瓶盖机收入(需机器) + 各阶助手许可(需助手)；
  · 技能树 = 唯一带下拉框的页签，四条科技线（履带/挂机/手部/特殊）；
    p_cursorsize / p_machineinc / h_bronze..h_diamond **不进树**（在升级页，见 TREE_*_NODES / HELPER_CAP_NODES）。
  列表是**两列网格**（`UI/UpgradeRows.ts` makeCell，CELL 322×78 / COLS 2），只画能解锁的项
  （locked/maxed 不出列表，空了给 all_done 占位行）；下拉菜单右缘对齐下拉框右缘、贴底栏顶沿弹出。
  旧的 Drawer/SkillPanel/DrawerContent/NavBar 已删除；`__tb.bottom` 是类，实例 `.I`，
  跳转 API `showTreeCategory(page)`（0→升级页 / 1履带 / 2手部 / 3特殊）。

## 流程
1. 改完先 `python .workbuddy/tools/typecheck.py`（源码 0 错）再构建 —— 命令行构建**不因 TS 报错失败**。
2. 构建：`unset ELECTRON_RUN_AS_NODE` 后
   `"D:/CoCosIDE/Creator/3.8.8/CocosCreator.exe" --project <项目> --build "platform=web-mobile;debug=true"`（~25s）。
   **exit code 会骗人**（有人开着编辑器占 3000 端口 → 返回 36/SIGTERM，但产物已写好）→ 看日志
   `build Task (web-mobile) Finished` + 在 `build/web-mobile/assets/main/index.js` grep 新字符串。
3. 验收：`E:\LDC_Fby\_cdp.py`（无头 Chrome+CDP+本地 http server）跑 `.tpl`
   （`sleep/eval/click/jsclick/shot`）。四比例窗口 `p16 720×1348 / tall 720×1668 / tab 720×1028 /
   wide 1280×868`；**无头视口 = 窗口高 − 68**。
   - ⚠️ **模板路径必须绝对**：`_cdp.py` 内部 `os.chdir(ROOT)`，相对路径会静默跳过整份脚本。
   - ⚠️ 第 8 参可传独立 Chrome profile 目录：复用同一 profile 时 `--window-size` 会被上次
     会话记住的窗口几何覆盖（四比例截成同一尺寸）；连跑两次之间旧 chrome 可能没死干净，
     占住 9333 调试口 → `chrome did not start` / 403 / socket closed 三种死法，
     **第 9 参可指定调试端口（连跑多次换端口）**，异常日志也落 `_cdp_log.txt`。
   - ⚠️ **headless 首次 `Input.dispatchMouseEvent` 会被丢弃**（页面未激活）→ 点一下没反应先发
     `jsdrag` 预热（mouseMoved）再点，别误判成业务 bug。
   - ⚠️ **第 3 参是本地 HTTP 服务端口，绝不能传 9333**（= Chrome 调试口）：服务器先占 9333 →
     chrome 起不来 → `chrome did not start`，极易误判成端口被残留占用。HTTP 端口传 8901+。
   - ⚠️ 跑之前 `unset http_proxy https_proxy ...` + `export NO_PROXY=127.0.0.1,localhost`
     （沙箱代理 env 和 Windows 注册表系统代理都会劫持 python→127.0.0.1 的请求）；
     **Bash 沙箱内 Chrome 网络偶发丢请求（假 404/REFUSED）→ 验收用 dangerouslyDisableSandbox 跑**。
   - ⚠️ headless 首次 `Input.dispatchMouseEvent` 会被丢弃（页面未激活）→ 点一下没反应先发
     `jsdrag` 预热（mouseMoved）再点，别误判成业务 bug。
   - ⚠️ **boot overlay（`#tb-boot`）与 headless**：进度/切标题已改为 **不依赖 rAF**
     （样式一次写入 + CSS transition + setInterval 轮询，2026-09-24 修复 rAF 停摆根因）。
     但 swiftshader 截图对带 transition/animation 的 fixed 层会出**陈旧纹理伪影**
     （「双进度条」/标题页下还挂着加载条）——DOM 求值状态才是真相；要干净截图就在 tpl 开头
     eval 注入 `*{transition:none!important;animation:none!important}`。旧绕过法（强删节点）仍可用。
   - ⚠️ **同层后建节点吞触摸**：角标（newTag/adIcon）必须挂在**价格按钮下**当子节点（坐标用按钮
     本地），挂在 cell 上会盖住按钮右上角、事件被角标吃掉 → 「点选项有晃动反馈但没效果」。
   - ⚠️ `window.cc` 无 `cc.UITransform/UIOpacity/Vec3` → 用 `getComponent('cc.UITransform')`。
   - `__tb.bottom`/`__tb.cap`/`__tb.field` 是**类**，实例在 `.I`；`__tb` 还带 `panels`、`ui`、`goal`。
   - 本机 `tail/dirname` 不可用，`&&` 链会整条短路。
4. **同一文件一次只发一处编辑**（并行多处会互相覆盖且都返回 success）。
5. **打平台包（vivo/huawei/xiaomi/honor）需要本机 Node 环境**：插件在
   `<Creator>/resources/tools/<平台>-pack-tools` 里跑 `npm install` + `npm run build|release`，
   npm 不在 PATH 就报 `Command failed: npm.cmd install`；`mg -v` 不能跑就报
   `Please install tools: npm install -g @vivo-minigame/cli`。已装 `D:\nodejs`（官方 LTS 便携版）
   + 全局 `@vivo-minigame/cli`，均在 HKCU 用户 PATH。
   **改完 PATH 必须完全重启编辑器**（`restart_cocos.py --full` 从 shell 重启不可靠，会继承工具的 POSIX PATH）；
   **所有本机 npm 操作前先 `NODE_OPTIONS= NODE_PATH=`**（WorkBuddy 注入的 node shim 会搞坏目录）。

## 坑（真金白银）
- **一个节点只能挂一个渲染组件**（Sprite/Graphics/Label 都是 UIRenderer；warnID 12002）：
  `addComponent` 第二个渲染组件会**静默失败**。Theme 里 woodPlate/chipPlate/beltFace/woodRail
  的高光/描边/辊条各占一个**子节点** —— 2026-09-23 前描边从来没画出来过（按钮一直无描边）。
- 运行时改色**必须整体赋值**（`new Color(...)` / `UIKit.tint`）：`Color.fromHEX(sp.color,..)` 与
  `sp.color.set(..)` 是就地改内部 `_color`，引用未变 → setter 提前 return → `_updateColor()` 不跑
  → 静默保持原贴图色。Graphics 改色要 `clear()` + 重描。
- `buildBackground()` 必须在资源加载完之后调用（`img()/rect()` 依赖 `Res.I.sf()`，早了静默空白）。
- 容器层要「**建完再顶到末尾**」（`setSiblingIndex(len-1)`），否则后建的节点盖住它（fxLayer 被桌面盖住）。
- 组件挂在 `navRoot` 上时不能 `this.node.active=false`（会连底栏一起关）；组件要自带子节点当容器。
- **全局 `input` 监听不受遮罩 BlockInputEvents 约束** → 模态必须 `Modal.push/pop`（Drawer、离线弹窗
  已登记），否则在面板上点任何位置都会顺手翻一只背后的瓶子。
- 兄弟创建序 = 渲染序；竖排（固定头+滚动体+固定底）必须用算术串竖带，各自按中心定位一定重叠。
- ScrollView content 锚点 (0.5,1) → y 必须写 `viewH/2 - TOP_PAD`（写 0 会下沉半屏）；滚动区下沿要落进
  行间隙 `SCROLL_H ≡ padTop + STEP_Y/2 (mod STEP_Y)`；滚动条 `UIScrollBar` 挂在视口外，改滚动区 Y 要一起搬。
- 奶油底 `#F6E3C5` 上只能深棕字 `#7A4210`；深木牌底才用 `#F1E0C0`。**模态面必须实心 6 位 hex**。
- UI 出场一律「中央 Q 弹」`popIn/popOut`（绝不上滑）；`popOut` 会把 UIOpacity 复位成 255，
  不能对已淡到 0 的节点再调。
- 点击命中自己算（`Bottle.hitTest` 逆变换判瓶身矩形 `150×375 / ay 0.34` + `BottleField.tapAt`）；
  `pointer` 是点击与悬停**共用**输入源，`aim()` 不能带解锁条件；`hitTest` 要**世界坐标**；
  输入四路都接（TOUCH 与 MOUSE 的 START/MOVE，桌面浏览器按下派发 MOUSE_DOWN）。

## 数值与经济（2026-09-23 第十五轮口径）
- **落地判定 = 纯概率制**（2026-09-24 第二十一轮拍板，**覆盖 GDD §3.1-3 的角度容差模型**）：
  所有瓶子一个口径 —— 成功树立 **50%**（倒立 10% / 正立 40%），失败 50%；
  各阶「翻转精通」`mastery` 每级 **+5%**，满 **10 级 = 100%**（必成立）。
  实现：`FLIP.successBase/successStep/critShareOfSuccess` + `G.successChance/critChance/okChance/rollOutcome`；
  **成功池内部恒为 1:4 分配** —— 倒立/正立占比之和恒 = 1（倒立 20% / 正立 80%，不是「倒立固定 10%」），
  且 `critChance + okChance ≡ successChance`；满级 = 倒立 20% + 正立 80% = 100%。
  `rollLanding/outcomeOf/tierTolerance` 与 `p_stability` 抗扰度**已不参与判定**（旧角度制仅存于 GDD 历史段）。
  ⚠️ `mastery` 的 `base` 同时是**价格基数**（`State.statCost`），改效果只能改 `step` / `successStep`。
- **瓶盖 = 每次落地 1 枚**：树立(ok)/倒立(crit) 都给 1 枚对应品质瓶盖（`doFlipResult` 统一 `caps=1`），
  翻倒(fail) 无；没装瓶盖机器时 caps 归零（原版规则保留）。瓶盖**无爆散动画**，
  直接从瓶身中心沿抛物线飞进右端入料机（CapMachine phase1 起）。
- `CAP_GAIN_BASE` 已不在主流程使用（保留备用）；'capgain' 词条暂无实际效果。
- 扣盖黑圈特效 = `Fx.shockwave`（`env/shockwave.png` 本身是黑色同心环）—— 已删，crit 只留金色星光。
- 点瓶音效 = `pop3`（TAP_SFX 单元素）；Toast 提示条在**屏幕正中**（BAR_Y 0），成就横幅 y=110。
- 顶栏**无横幅背景**（Hud.fitWidth 是 no-op）、无猫爪挂牌/绿叶装饰（buildDecor 已清空）。
- 瓶盖机器是**商店设施 $1,000 金币**（`MACHINE.buyPrice`，存档 `data.machine`）；买之前不产瓶盖也不画
  履带。装好后瓶盖先进 `pendingCaps`，靠 `CapMachine` 运到滚筒 `recycleCaps()` 才入账。
- 助手是唯一吞吐放大器（`h_unlock` 1200 瓶盖；`handInterval` 1.5s；超 10 只走 `directFlip` 静默结算）。
- 瓶盖三段特效（爆散→飞向履带→上带行进）全在 `CapMachine.update()` 手算，零 tween / 零 new；
  颜色按阶走 `CAP_COLOR`（T7 从 `CAP_RAINBOW` 逐颗随机）。

## 布局口径（木纹卡通，设计 1280，y 以屏幕中心为 0）
- 顶栏 `barY 520 / barH 134` → 木桌（`statusY 386`、猫爪+绿叶在 hudRoot y≈384/398、
  `PLAY_AREA y −90..270`）→ 底部块（第十轮串联）`abilityY −136 / beltY −256 h124(beltH) /
  navY −356 h72 / panelY −508 panelH 216（内嵌面板，屏幕最底）`。
  `SAFE_BLOCKS.topY 587 / topBottomY 453 / botTopY −85 / botBottomY −616`、`safeBottom 24`；
  `botTopY` 要跟着「底部块最上面是谁」走（改错会白丢舞台高度）。
- 底栏三件：商城 / 技能树 / 瓶子种类下拉框（各 214/214/246 宽），下面常驻内嵌升级面板。
- 瓶子 `bottleH 96`（=原 160×0.6，用户要求）；`BOTTLE_SCALE = bottleH/375 = 0.256`。
- 履带**向左运**（第十四轮用户口径）：瓶盖飞向**右端深色入料机**（黑色滚轮），通过履带
  向左运到**左端出售箱**（木箱+瓶盖图示）回收入账。MACHINE 几何：`binX -252`（出售箱）/
  `feederX +252`（入料机）/ `beltEntryX +160` / `beltExitX -160`（span 为负，闸门插值自动成立）。
  履带横置挂 navRoot（UI 层，不随舞台缩放），**全部 Graphics 矢量画**
  （木框机器盒+绿屏+深色辊面+右滚筒，总宽 654）；贴图拉伸是当初「履带变形」的根因。
  世界↔屏幕换算用 `GameConfig.WORLD_XFORM`。
- 顶栏**只留两个筹码**（金币 + 瓶盖数）——速率「/秒 $X」与「履带回收中 +N」副行文本已删。
- 瓶身贴图 `body_0..6.png` 画的是**瓶口朝下**（`angle=180` 才正立）；画布比例 0.4、内容底对齐。

## 引导层（加载页 + 标题页，2026-09-24）
- 全在 **`build-templates/web-mobile/`**：`index.html`（生成版的完整复制 + `#tb-boot` 引导层，
  **改引擎模板相关内容要同步这里**，构建时整体覆盖产物）+ `boot/loading_bg.jpg`（参考图原画）
  + `boot/bottle.png`（body_4 逆时针转 90° 横躺）+ `boot/logo.png`（app_logo）。
- 钩子：`Res.loadAll` onProgress 加权（tex .85/aud .10/fnt .05）→ `__tbBootProgress(f)`；
  `GameRoot.afterReady` → `__tbBootReady()`；用户点击标题页 → `__tbOnStart()` → GameRoot
  `music(false)+(true)` 重播 BGM（无手势首次播被浏览器自动播放策略拦掉）。
- 语言自适应 `navigator.language` 前缀 zh。标题页 = logo + Bottle Flip Inc + 点瓶子 + 点击屏幕开始。
- **进度/切标题不依赖 rAF**（headless/后台标签 rAF 停摆会永远卡加载页）；
  动画全走 CSS transition，切标题 setInterval 轮询 450ms 后置 `.title`。

## 可复用
- 美术流水线 `E:\LDC_Fby\_art_pipe.py`：生成→抠底→规整→`assets/resources/Textures`。
  别用 `floodfill(thresh=T)` 直接抠底（Pillow 的 `_color_diff` 是三通道差值和，近白底噪点即超阈值且
  **静默失败**）→ 先造 L 二值掩膜再在掩膜上 `thresh=0` 泛洪；`RGBA.getbbox()` 不认 alpha，
  要用 `im.split()[3].getbbox()`；可拉伸部件切 `_l/_m/_r` 三件拼。

## 贴图（2026-09-24 全量压到 200K 以下）
- `assets/resources/Textures` 141 张 png，目录 **7.7MB → 2.6MB**，已无 >200K 的单图。
- 工具 `.workbuddy/tools/tex_compress.py`（`--purge-dead` 移出死资源）、`tex_dryrun.py`（试算体积/PSNR）；
  **原图备份 `.workbuddy/texture_src/`**（`unused/` 里是移出的死资源，含 meta，可直接拷回恢复）。
- 压缩手法：唯一色 ≤256 的图走**精确调色板 PNG8（无损）**；其余 `quantize(256, FASTOCTREE)`
  存 PNG8。全分辨率 PSNR 27~42dB，但**在真实显示尺寸下（tab 图标才 42px）都 ≥40dB**，
  评价贴图压缩必须按显示尺寸算失真，别看全分辨率数字。
- **已移出的死资源**（只在 `TEXTURE_PATHS` 里、全工程无绘制调用）：
  `env/drum / env/fog / env/leaves / env/machine_box / env/paw_card` + `ui/wood_banner`
  （木牌实际用 `wood_banner_l/m/r` 三件）；同时从 Res.ts 摘掉了前 5 条。
- ⚠️ **`resources.load(数组)` 里任何一条路径失败 → 整批贴图都加载不到**（不是跳过单个）。
  所以移走/改名贴图必须同步改 `Res.ts` 的 `TEXTURE_PATHS`，否则进游戏整屏只有清屏色。
- 下一个包体大头是**字体**：`Fonts/NotoSansSC-Bold.ttf` 10.5MB + `Lato-Semibold.ttf` 669KB，
  占 resources 的 11/15MB —— 中文字体子集化能省 10MB 量级（尚未做）。

## 音频（2026-09-24 全量转 MP3）
- **assets/resources/Audio 下只有 13 个 .mp3**（wav+meta 已删），代码按 `'Audio/xxx'` 路径加载
  不带扩展名，无需改 TS；uuid 已变（旧 uuid 无引用）。
- **本机无 ffmpeg** → 用 venv 里的 `lameenc`（纯 wheel 自带 LAME）编码；
  工具 `.workbuddy/tools/audio_conv.py`（转换+备份+--purge 删 wav）、`audio_verify.py`（解析 MPEG 帧
  校验时长/声道/采样率）、`audio_info.py`。**原始 wav 备份在 `.workbuddy/audio_src/`**（含旧 meta）。
- 码率分档：bgm 96k 立体声（20.5MB→1.37MB）、win/buy/hit/slash 128k 立体声、button 96k、
  click/click2/pop1-5 64k 单声道。总计 20.32MB → 1.40MB（6.9%）。
- ⚠️ **lameenc 低码率时会悄悄把输出降到 32kHz**（LAME 自动优化）→ 必须
  `set_out_sample_rate(与源相同)` 保持 44.1k/48k。
- mp3 有 ~0.04s 编码器延时（576+1152 采样）；**BGM `loop=true` 循环点会有一小段静音间隙**
  （mp3 固有，浏览器不解码 LAME gapless tag）——原版 wav 是无缝的，用户若反馈循环断裂，需
  换回 wav/ogg 或改用 Web Audio 手动 buffer 循环。
- Cocos web 端 AudioClip：`clip.duration` getter 返回 `undefined`（序列化字段），要用
  **`clip.getDuration()`**（本机实测 mp3 正确返回 116.61s）；`_nativeAsset` 是 AudioMeta 对象
  `{url,type,player}`，不是 ArrayBuffer。

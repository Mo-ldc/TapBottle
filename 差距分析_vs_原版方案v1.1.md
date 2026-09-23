# TapBottle ×《Bottle Flip Inc.》原版方案 v1.1 —— 差距分析

> 对比日期：2026-09-23
> 基准 A：`E:\LDC_Fby\BottleFlipInc\Bottle Flip Inc Demo\GDD_Bottle_Flip_Inc_Cocos.md`（v1.1.0，79 KB，原版二进制提取的真实数值）
> 基准 B：`E:\LDC_Fby\BottleFlipInc\Bottle Flip Inc Demo\Bottle_Flip_Inc_全量资源导出`（133 纹理 + 290 精灵 + 15 音频 + 8 字体 + 93 着色器 + 43 材质 + 13 网格）
> 被检对象：`TapBottle`（Cocos Creator 3.8.8 / TS，工程内 GDD 仍是 v1.0.0，30 KB）

---

## 0. 一句话结论

**玩法骨架已经 100% 跑通**（三态翻转、双货币、7 阶瓶子、4 分支技能树、履带 + 双倍闸门、助手机械手、三大终极技能、24 项成就、离线收益、中英双语、四比例自适应竖屏），
**差的不是"有没有"，而是"数值是不是原版的"** ——
具体是三块：① 全部经济数值目前是自造的（原版真实值都在 v1.1 里，可直抄）；② 6 个整块系统完全缺失（里程碑 / 商店 / 11 词条 / 助手阶数许可 / 随机连锁 / 完成度通关）；③ 落地判定是概率而非角度，导致"操作技巧"和"落地精通"升级的语义丢失。

---

## 0.5 更新记录：2026-09-23 第二轮已落地的对齐（本节优先于下方旧结论）

用户要求「科技树/瓶子升级的内容要跟原版一致，并且瓶子按阶各自解锁悬停触发」，本轮已按 v1.1 真实数据重写：

| 项 | 状态 | 落地位置 |
| :--- | :--- | :--- |
| 七阶瓶子真实数值（BaseIncome $1→$2500、TimesIncome ×1→×7、科技解锁 1600→90000 盖、商店 $7/$2000…、同屏上限全 30、悬停解锁 $100→$230000、扣盖倍率 5.0/铜瓶 6.0） | ✅ 已替换 | `Core/GameConfig.ts` TIERS |
| **单瓶 11 大升级词条 × 7 阶真实矩阵**（Base / Max / R 全量）+ 一次性「悬停翻转模式」 | ✅ 已替换（12 行） | `BOTTLE_STATS`（`tiers[]` 每阶一组 base/max/r/step） |
| **四大科技树真实节点**（瓶子 6 / 玩家 13 / 助手 12 / 特殊技能 9）与四页签 | ✅ 已替换 | `SKILLS` + `SKILL_GRAPH` / `PLAYER_GRAPH` / `HELPER_GRAPH` / `ABILITY_GRAPH`，`SkillPanel` 4 页 |
| **每阶瓶子各自解锁「悬停翻转」**；未解锁该阶只能点击翻转；解锁后手指圈只触发圈内「已解锁悬停」的瓶子 | ✅ 已实现 | `State.hoverUnlocked/hoverable/anyHover/buyHover` + `BottleField` 光标循环过滤 |
| 落地判定改角度制（容差角 18°×(1+0.1×精通)、目标角 0°/180°、质量与稳定性科技参与） | ✅ 已实现（物理用角度模型近似，视觉仍是三态动画） | `State.rollLanding/outcomeOf` |
| 结算公式（M_landing ×5.0 / M_double +10%·L / M_berserk 1.0+1.5L / M_samurai 1.0+0.3L / M_global 钻石瓶 ×2） | ✅ 已实现 | `State.doFlipResult` |
| 助手：解锁 1200 盖、单价 4000×1.10ᴺ、上限 10+5L、**六张阶数自动化许可**（未许可的阶数机械手不抓） | ✅ 已实现 | `HAND` + `HELPER_PERMIT` + `HelperHands` |
| 瓶盖机 1000 盖解锁 / 产出 +10%·L / 线速 +10%·L / 闸门 8000 盖 + 10%·L 双倍 | ✅ 已实现 | `SKILLS`（p_machine / p_machineinc / p_machinespeed / p_gateunlock / p_gatechance） |
| 连环二次翻转 +2%·L、随机连锁翻转（点燃另一只正立瓶子）+2%·L | ✅ 已实现 | `BottleField.onLanded` |
| 可乐 75s−20s·L（3 级）/ 数量 1+L（9 级）；狂暴 3 连击、2+L 次、1.0+1.5L 倍；武士 0.8+0.3L 秒、1.0+0.3L 倍 | ✅ 已实现 | `ABILITY` + `State` |

**仍未做**：里程碑 24 阶（§7）、商店 Modal（§8.4，目前仍靠底部快捷购买 + 科技树解锁）、成就 24 项的「真实阈值 + 奖励发放」、完成度/100% 通关（§10.1）、新手引导（§8.6）、缺口 UI 皮肤与瓶子逐帧序列资源的导入。

**数值自检**（无头脚本实读，与 v1.1 §4.1/§4.2 逐项一致）：
`incomeT1=1 / tolT1=18 / capT1=30 / costT2=2000 / techT2=1600 / techT7=90000 / hoverT1=100 / cursorR=55px / handCost=4000 / handMax=10 / cokeCd=75 / berserkNeed=3 / berserkMult=1.0`；
T1 十二行词条 `hover 100 / purchase 7·30 / income 40·20 / capincome 20·10 / multiplier 40·10 / speed 35·10 / capgain 200·4 / limit 70·4 / mastery 50·10 / double 1200·3 / again 700·5 / random 400·5`。

**两处 GDD 自相矛盾的处理**：一律以 §4.2「真实全量参数总矩阵表」为准（§4.5 的举例数值与之冲突）；
T4~T7 多行整齐的 `Base $10 / R 1.50` 按原文保留，疑似反编译缺失字段的填充值，建议后续复核。
另：`IncomeUpgradeCap`（瓶盖收益词条）原文只给了「+1/+5/+20 每级」的数值，本实现按「扣盖时额外获得等额金币、消耗瓶盖升级」落地。

---

## 1. 已经做完、不需要再做的（对照 v1.1 §1.1 模块清单）

| 原版模块 | TapBottle 对应实现 | 状态 |
| :--- | :--- | :--- |
| `BottleFlip` 三态姿态 | `Game/Bottle.ts`：ok 正立 / crit 扣盖 / fail 平躺 + 挤压回弹 + 影子 | ✅ 观感完整 |
| `BottleFlipManager` 池化 | `Game/BottleField.ts`：同屏多瓶、自由落点、层级重排 | ✅ |
| `BottleCap` + `MachineController` | `Game/CapMachine.ts`：瓶盖飞入履带 → 顶端回收才入账（在途量进存档） | ✅ |
| `MachineGate` 双倍闸门 | `CapMachine` + `p_gate` / `p_gatechance` | ✅（数值需改） |
| `HelperMovement` 机械手 | `Game/HelperHands.ts` | ✅ |
| `FlyingCoke` 冲击波 | `Game/Abilities.ts`：可乐横穿 + 全屏 shockwave + 全瓶起飞 | ✅ |
| `BerserkController` 狂暴 | `State.berserkStreak/Flips/Bonus` + HUD 文字行 + 火焰特效 | ✅ |
| `SamuraiExecutionController` 处决 | `State.samuraiGauge/Timer` + katana Fx | ✅ |
| `UpgradeManager` 升级派发 | `State.upgradeSkill / upgradeStat / buyBottle / buyHand` | ✅ |
| `SaveManager` 存档 | `Core/Save.ts` + SAVE_VERSION 4（含在途瓶盖） | ✅ |
| `EventManager` 事件总线 | 用 `G`（State）单例 + `addListener/notify` 代替 | ✅（架构等价） |
| `ObjectPoolManager` 对象池 | `Game/Fx.ts` + `POOL` 配置（chip/burst/floatText…） | ✅ |
| `BigNumber` 大数格式化 | `Core/Util.ts` `fmt()`（K/M/B/T…） | ✅ |
| `AchievementSO` 24 项 | `ACHIEVEMENTS` + `AchPanel` + 解锁横幅 | ⚠️ 只记录 + 弹横幅，**不发奖励** |
| `Localization` 中英 | `Core/Locale.ts` 内联 233 条 + 设置页切换 | ✅ |
| 竖屏三段式 + 抽屉 + 模态层级 | `GameRoot.applySafeLayout` + `UI/*`（Layer 0~6 齐备） | ✅ |

---

## 2. 数值层差距（最要紧，全部可直接用 v1.1 的值覆盖）

### 2.1 七阶瓶子（v1.1 §4.1 vs `Core/GameConfig.ts` TIERS）

| 项 | TapBottle 现值 | 原版真实值（v1.1） |
| :--- | :--- | :--- |
| 收益基准 `BASE_INCOME` | **12**（自造） | T1 `BaseIncome = $1.0` |
| T1 倍率 | ×1.0 | ×1.0 |
| T2 铜 / T3 银 / T4 金 | **×3.5 / ×12 / ×45** | **×2.0 / ×3.0 / ×4.0** |
| T5 红宝 / T6 翡翠 / T7 钻石 | **×180 / ×800 / ×3500** | **×5.0 / ×6.0 / ×7.0** |
| T2~T7 解锁 | 金币 1 000 / 2.5 万 / 50 万 / 1.5e7 / 5e8 / 2e10 | **瓶盖** 1 600 / 4 800 / 10 000 / 20 000 / 45 000 / 90 000（科技树解锁资格） |
| 同屏默认上限 | 3 / 4 / 5 / 6 / 7 / 8 / 10 | **全部 30** |
| 悬停翻转解锁费 | 无此概念（全局 `p_cursor` 解锁） | T1~T7 分别 **$100 / $6 000 / $16 000 / $10 000 / $25 000 / $100 000 / $230 000** |
| 单瓶升级词条数 | 8 项 | **11 项** |
| 升级价格曲线 | 自造 `baseCost × growth^L` 再乘 `14^tier` | 逐阶 **Base / Max / R** 真实矩阵（v1.1 §4.2 表） |

> 影响：目前 T2 一上来就是 3.5 倍，T7/T1 = 3500×；原版是 2 倍起步、T7/T1 = 2500×。**前期爬坡手感与原版差别很大**，且"金币买高阶瓶 vs 瓶盖研发解锁"这条核心决策链被改掉了。

### 2.2 技能树成本（v1.1 §5.1 vs `SKILLS`）

| 节点 | TapBottle | 原版真实 |
| :--- | :--- | :--- |
| 解锁 T2 / T3 / T4 | 不存在（改金币直购） | 1 600 / 4 800 / 10 000 瓶盖 |
| 解锁 T5 / T6 / T7 | 不存在 | 20 000 / 45 000 / 90 000 瓶盖 |
| 光标范围解锁 / 升级 | 25 / base 20（+12%/级，10 级） | 500 / 3 000（+5%/级，10 级） |
| 挂机解锁 / 时长 / 恢复 | 120 / 60 / 70 | 1 000 / 800（+10%/级，25 级）/ 1 000（−5%/级，15 级） |
| 瓶盖机（履带）解锁 | `p_machine` 180 瓶盖 | **1 000 瓶盖**（商店设施） |
| 履带速度 / 产出 | 90（+8%/级，12 级） | 1 000（+10%/级，30 级）/ 10 000（+10%/级，10 级） |
| 闸门解锁 / 双倍概率 | 260 / 140（+3%/级，10 级） | 8 000 / 8 200（**+10%/级，满级 100% 绝对双倍**） |
| 助手解锁 / 上限 / 移速 / 恢复 | 60 / 50 / 40 / 55 | 1 200 / 1 800（+5 只/级，18 级）/ 800（+5%/级，15 级）/ 800（−5%/级，15 级） |
| 助手购买价 | `400 × 1.25^n` | **`4000 × 1.10^N`**（第 1 只 $4 000，第 10 只 $9 431） |
| 可乐解锁 / 冷却 / 数量 | 200 / 120（60s 起，−5s/级，9 级）/ 300（2 级） | 4 000 / 4 000×3 级（**每级 −20s**：75→55→35→15）/ 3 000×9 级（+1 瓶/级） |
| 狂暴解锁 / 次数 / 倍率 | 400 / 900+160 / 220（+0.75×，12 级） | 12 000 / 12 200（+1 次，3 级）/ 12 200（**+1.5×**，3 级 → 最高 5.5×） |
| 武士解锁 / 定格 / 收益 | 700 / 260（+2s，8 级）/ 300（+0.2×，8 级） | 18 000 / 19 000（+0.3s，3 级）/ 19 000（+0.3×，3 级） |

### 2.3 其它数值

| 项 | TapBottle | 原版真实 |
| :--- | :--- | :--- |
| 扣盖暴击倍率 | 由 `g_critmoney` 成长（base $5，+0.4/级） | 固定 **×5.0**（T2 铜瓶 ×6.0） |
| 落地容差角 | 无（概率制） | **18.0° × (1 + 0.10 × 精通等级)** |
| 24 项成就 | 有 24 条，阈值多为近似（1e5/1e6/1e7/1e8/1e9 金币…） | 24 条真实阈值 + **每项有奖励**（金币 / 瓶盖 / 永久 +10% 收益 / +5% 翻转速度…） |
| 里程碑 | **完全没有** | 24 阶，`M0=10`，`Mₙ = round(Mₙ₋₁×(1.50+0.01n)+5)`，M24 = 1 100 974 |
| 离线收益 | `applyOffline()` 有，上限 4 小时硬编码 | 上限由 `IdleDurationUpgrade` 决定（基础 5s，可升到数小时）+ 广告双倍领取 |
| 瓶盖单价 | 随累计收益 log10 成长（自造） | 由 `MachineIncomeUpgrade`（+10%/级）决定 |

---

## 3. 判定机制差距（唯一影响"手感"的一条）

| | TapBottle | 原版 v1.1 §3.1 |
| :--- | :--- | :--- |
| 判定方式 | `State.rollOutcome()` **纯随机数**先出结论（crit 概率 = `g_crit`，成功 = `TIERS.success + 精通×2%`），再播对应姿态动画 | 真物理：冲量 8.5、力矩 13~16.5、线性阻尼 0.10、角阻尼 0.40、弹性 0.15、摩擦 0.60、CCD；落地后 v<0.25 且 ω<0.6 持续 0.2s 才按**最终角度**判三态 |
| 玩家可操控性 | 无（点击只是触发器） | 有（角度由物理决定，"落地精通"扩容差角能真的提高扣盖率） |
| "落地精通"升级语义 | 变成 "+2% 成功率"（数值上等价，但**不可感知**） | 提高容差角，玩家能明显感觉"更容易站住" |

**建议（最小改动、不动现有动画体系）**：
翻转时先按物理算一个落点角度 θ（受 `flipSpeedMultiplier`、稳定性升级、随机扰动影响），再让 θ 反推 outcome（`|θ|≤容差 → ok`，`|180−θ|≤容差 → crit`，否则 fail）。
`Bottle.flip(outcome)` 已经接收 outcome 并摆姿势，只要把"谁来决定 outcome"从 `Math.random()` 换成 θ 即可，改动集中在 `BottleField.flip()` 一处。

---

## 4. 整块缺失的系统（v1.1 有、工程里 0 命中）

用脚本在 `assets/Scripts` 全文扫关键词，命中 0 文件的有：

| # | 缺失系统 | v1.1 章节 | 工作量估 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **里程碑 24 阶**（阈值表可直抄，含 HUD 进度 + 阶段奖励） | §7 | 中 | **P0** |
| 2 | **商店 Modal**（瓶子采购 / 助手 / 核心设施 三标签）—— 现在只有底部 `QuickBuy` 一张卡 | §8.4 | 中 | **P0** |
| 3 | **单瓶 11 词条中的 4 项**：`IncomeUpgradeCap`(瓶盖收益) / `IncomeMultiplierUpgrade`(全局乘数) / `RandomFlipUpgrade`(随机连锁) / `UpgradeHoverModeCost`(悬停解锁) | §4.2 | 中 | **P0** |
| 4 | **助手 6 张阶数自动化许可**（铜/银/金/翡翠/红宝/钻）—— 目前助手抓任何已拥有瓶 | §5.1 分支3 | 小 | P1 |
| 5 | **完成度检查器 + 100% 究极通关**（Shop/Upgrade/SkillTree/Game Completion） | §1.1 / §10.1 | 小 | P1 |
| 6 | **新手引导 + 全屏转场遮罩**（Layer 6） | §8.6 | 小 | P2 |
| 7 | **成就奖励发放**（24 项奖励：金币/瓶盖/永久收益加成） | §6.4 | 小 | **P0** |
| 8 | **狂暴/决意蓄力条**：现在只有 HUD 一行文字（`狂暴连击 2/3   决意 60%`），v1.1 §8.1 要求两条图形化进度条 | §8.1 | 小 | P1 |

> 已有但形态不同、按 v1.1 需换皮的：技能状态行、悬停翻转（现在是全局 `p_cursor` 一次性解锁，原版是**每阶瓶子各自付费**解锁）。
> 明确**不需要**做的：3D 网格 / 着色器 / 材质（2D 复刻用不上）、Addressables 分包、Unity 内置 splash。

---

## 5. 资源层差距（全量资源导出 vs `assets/resources`）

| 目录 | 参考导出 | TapBottle | 说明 |
| :--- | ---: | ---: | :--- |
| 纹理 / 精灵 | 133 + 290 | **138 png** | 已做成自己的一套命名（`ui/` `env/` `stat/` `bottle/` `ability/`） |
| 音频 | 15 wav | 13 wav | ✅ 基本齐（落地 5 变调、扣盖 2、拔刀、购买、点击、胜利、BGM 都在） |
| 字体 | 8 ttf | **3 ttf** | 缺 `NotoSansJP-Bold` / `NotoSansKR-Bold` / `LiberationSans` / `PerfectDOSVGA437` |
| 着色器 / 材质 / 3D 网格 | 93 / 43 / 13 | 0 | **2D 复刻不需要迁移** |

**已完整覆盖**：`stat/` 17 张数值图标（Income、Bonus、CapGain、Buyable、Chance、Duration、FlipCount、FlipMastery、FlipSpeed、MovementSpeed、Recovery、ResolveGain、Size、Unlock、Plus100、locked…）、`ability/` 5 张（berserk、samurai、katana、flyingcoke×2）、`env/` 15 张（belt/table/leg/frame/machine/recycle/container/cursor/fog/vignette/star/shockwave/disc/areacircle/hand）、`bottle/` 22 张（body_0~6 + capart_0~6 + capchip_0~6 + icon_×7）。

**缺口 A —— UI 皮肤族（装饰/状态类，当前用 `ui/card_white` 九宫格染色替代）**
- 成就：`AchievementBackground` / `AchievementBackgroundUnlocked` / `AchievementIcon` / `achievement_thin|thick outline`
- 槽位：`slot_bg_default|select|empty|hide`、`slot_activeself_on|off`、`slot_item_select_frame`、`slot_icon_*`（18 张，原版是换装/外观系统用）
- 开关与侧键：`Modular_Active|Hover|Inactive|Inactive_Hover`、`SimpleModular_*`、`SideButton_Default|Hover`、`Item` / `Item_Hover`
- 滚动条：`Scroll_Track` / `Scroll_Thumb` / `Scroll_Thumb_Hover`
- 按钮 Hover 态：`Button_Blue|Red|Purple|Grey_*_Hover`、`ButtonLong_Hover`（桌面端有 hover，移动端可忽略）

**缺口 B —— 瓶子/瓶盖逐帧序列（共 46 张，目前一张没用）**
`bottle_add (1)_0~6`、`bottle_add cap (1)_0~6`、`Bottle_New2_0~6`、`Bottle_New_Additional_0~13`、`Bottle_Cap_0~6`、`Bottle_Cap2_0~6`
→ 用途：翻转过程的逐帧动画（替代现在的代码挤压回弹）、或瓶盖飞散/爆开的序列帧。

**缺口 C —— 多语言字体**：只有做日/韩语才需要，中文简体现在用 `NotoSansSC-Bold` 已够。

**顺带发现的死资源**：`assets/resources/Text/zh.json`、`en.json` 各只有 14 个键（Unity Localization 原始 dump），`Core/Res.ts` 的加载表里**没有登记**，代码用的是 `Core/Locale.ts` 的 233 条内联文案 —— 这两个 json 目前是纯占位，建议删掉或改造成真正的语言包（中文名 `Logo_Screen_zh-Hans`、`Shop_zh-Hans` 等键名还留着原版痕迹）。

---

## 6. 建议推进顺序

**P0（做完整度，收益最大）**
1. 用 v1.1 §4 / §5 的真实数值整体替换 `GameConfig.ts`（TIERS / SKILLS / BOTTLE_STATS / HAND / MACHINE / ABILITY）+ `State` 里对应的派生公式；
2. 补 4 个缺失词条（瓶盖收益 / 全局乘数 / 随机连锁 / 悬停解锁）；
3. 补成就奖励发放；
4. 判定改为"角度反推 outcome"（手感对齐原版）。

**P1（补整块系统）**
5. 里程碑 24 阶（含 HUD + 奖励）；
6. 商店 Modal（瓶子 / 助手 / 设施三标签）；
7. 助手 6 张阶数许可 + 完成度检查器 + 百分百通关。

**P2（表现打磨）**
8. 导入缺口 A/B 的皮肤与序列帧，按 v1.1 §8 重做蓄力条与成就面板底图；
9. 新手引导 + 转场遮罩；
10. 日韩字体（如要出海）。

---

## 7. 本次已同步完成的改动：UI 出场方式

用户要求「**UI 不要从下方出现，最好 Q 弹中间出现，隐藏是缩放回去**」——已全部改完（源码 0 类型错误，构建产物已含新代码）：

| 文件 | 改动 |
| :--- | :--- |
| `UI/UIKit.ts` | 新增 Q 弹 `popIn()`（0.72 → 过冲 1.07 → 回落 1，`backOut`+`sineInOut`）、`popOut()`（1 → 0.78 + 淡出后回调）、`maskIn/maskOut()`、`clearPopTween()`（连点打断时清旧 tween，避免"弹一半消失"）；`MASK_SIZE` 改为按可见设计区动态取值 |
| `UI/Drawer.ts` | **升级面板从"底部上滑抽屉"彻底改为"屏幕正中模态卡"**：全屏遮罩（只淡入淡出）+ 居中卡片（Q 弹缩放），卡片挂 `BlockInputEvents` 防误触穿透；收起 = 缩放回 0.78 + 淡出后 `active=false`；高度 600 → **820**（滚动区 496 → 716） |
| `UI/Panel.ts` | 技能树/成就/统计/设置四类面板：关闭由"淡出销毁"改为**缩放回去**；出场统一走新版 Q 弹 |
| `UI/Hud.ts` | 离线结算弹窗：遮罩淡入 + Q 弹出场 + 缩放收起 |
| `UI/SettingsPanel.ts` | 删档二次确认弹窗：同上 |
| `UI/Toast.ts` | 提示条/成就横幅：从"从上方位移滑入"改为**原地 Q 弹**（0.70 → 1.06 → 1） |
| `Core/GameConfig.ts` | `LAYOUT.drawerH: 820`，移除 `drawerOpenY / drawerClosedY`（不再需要滑入滑出坐标） |
| `GameRoot.ts` | 面板层不再跟随底栏位移（模态居中）；打开升级面板时**保留底栏可见**（只同步高亮），不再整块隐藏；按可见区动态更新 `MASK_SIZE` |

# 任务配方 · TapBottle

每条配方都按「改哪些文件 → 抄哪段既有代码 → 怎么验」写。**动手前先读一遍 `SKILL.md` 的 12 条铁律。**

---

## 0. 通用收尾（每个配方都要做）

```bash
<py> .workbuddy/tools/typecheck.py        # 类型检查：项目源码必须 0 错误
<py> .workbuddy/tools/verify_assets.py    # 资源路径检查：动了资源路径才需要
```
`<py>` = `C:\Users\A\.workbuddy\binaries\python\versions\3.13.12\python.exe`

改完代码后让编辑器那边生效（**替代手工点刷新**）：
```bash
<py> .workbuddy/tools/restart_cocos.py --soft     # 刷资源 + 等编译 + 软重载场景 + 打印控制台错误
```
要跑起来看效果 → `references/editor-ops.md`。

---

## 1. 调整数值 / 平衡

**唯一去处：`Core/GameConfig.ts`。** 不要改逻辑文件里的数字。

| 想改什么 | 改哪里 |
|---|---|
| 瓶子价格/收入/成长 | `TIERS` 的 `cost` / `income` / `growth` |
| 技能上限/成本/成长/每级增量 | `SKILLS` 的 `max` / `baseCost` / `growth` / `base` / `step` / `unit` |
| 能力参数 | `ABILITY.coke / berserk / samurai` |
| 助手价格与节奏 | `HAND.price / priceGrowth / interval / visibleMax` |
| 瓶盖机器 | `MACHINE.*` |
| 版面位置 | `LAYOUT.*`（`rowBaseline` 是 4 行瓶子的 Y，`tableY` 是桌面，`navY` 底栏） |
| 设计分辨率 | `DESIGN_W / DESIGN_H`（**改动会影响所有绝对坐标，别轻易动**） |

改完必须跑 `typecheck.py`（数值改了类型不会错，但顺手确认）；数值类改动要靠预览看节奏，用 `debug_preview` + `debug_screenshot`。

> `State.ts` 里所有 `get xxx()` 都是从 `SKILLS` 派生出来的（如 `maxBottles = floor(sk('b_limit'))`）。**要加一个新的派生数值，就在 `State.ts` 加 getter，不要在外面临时算。** 离线收益引擎 `incomePerSec` 也要同步——它是挂机收益的唯一口径。

---

## 2. 新增一个面板（商店/技能那种）

抄 `UI/Panels/SettingsPanel.ts` 的结构（它就是最标准的一个）。骨架：

```ts
// assets/Scripts/UI/Panels/MyPanel.ts
import { Node } from 'cc';
import { G } from '../../Core/State';
import { t } from '../../Core/Locale';
import { openPanel, rowCard } from './Panel';
import { label, button, img, nd } from '../Base/UIKit';
import { Toast } from '../Base/Toast';

export function openMyPanel(parent: Node) {
    const p = openPanel(parent, 'my_title');        // 遮罩+木框+标题+关闭按钮+滚动区 全有了
    p.host.onRefresh = () => {
        // ★ 这里重建 body 内容。G.notify() 变化时 PanelHost 会节流 0.15s 调一次
        // destroyChildren(p.body) 后重新铺内容
    };
    p.host.onRefresh();
}
```
要点：
- **`openPanel()` 已经处理了**：遮罩、淡入、圆角木框、标题、关闭按钮、`Modal.push()`、`popIn` 弹入、滚动区（`p.body` 是 `scrollView` 的 content）。
- 内容重绘用「清空 + 重建」：`import { destroyChildren } from '../Base/UIKit'; destroyChildren(p.body);` 然后 `nd/rowCard/label/button` 铺一遍。
- 一行的样式统一用 `rowCard(p.body, w, h, x, y, tint)`（圆角卡 + 描边）。
- 资源不足提示用 `Panel.ts` 导出的 `denyToast(needCaps?)`。
- 挂到导航：改 `GameRoot.buildUI()` 里 `BottomPanel` 的分支。
- **放哪**：内嵌面板 → `UI/Panels/`；可复用控件 → `UI/Widgets/`；基础设施 → `UI/Base/`。

---

## 3. 新增一个技能节点（技能树）

三步，缺一不可：

1. **`GameConfig.ts` → `SKILLS` 加一条**：
```ts
{ id: 'b_newthing', tree: 'bottle', name: 'sk_newthing', desc: 'sk_newthing_d',
  icon: 'stat/income', max: 20, baseCost: 1000, growth: 1.45, currency: 'money',
  base: 0, step: 2, unit: 'percent' },
```
`tree` ∈ `'bottle' | 'helper' | 'player' | 'ability'`；`unit` ∈ `'flat' | 'percent' | 'count' | 'seconds' | 'unlock' | 'raw'`；`currency` ∈ `'money' | 'caps'`。
解锁型节点（0/1 级开关）用 `unit: 'unlock'` + `unlockId`。

2. **`Locale.ts` 加两条文案**：`sk_newthing` 和 `sk_newthing_d`（`{ zh, en }`）。技能面板直接用 key 查表，漏了会显示 key 本身。

3. **`State.ts` 加派生 getter**（可选，但推荐）：
```ts
get newThingBonus() { return this.sk('b_newthing') / 100; }
```
`sk(id)` 自动按 `base + lv * step` 算，不用手写等级查表。技能面板（`SkillPanel.ts`）会自动把这个节点渲染出来，因为它遍历 `SKILLS`。

**`icon` 必须是 `resources/Textures/` 下真实存在的路径**，且已在 `Res.TEXTURE_PATHS` 里（见配方 6）。

---

## 4. 新增一个成就

`GameConfig.ts` 的 `ACHIEVEMENTS` 里 id 是 1~24 且必须连续，再在 `State.checkAch()` 里加条件：

```ts
g(25, this.data.stats.earned >= 1e10);
```
`g(id, cond)` 只在条件为真且未获得时发奖 → `onAch` → `Toast.I.achievement(id)`。
标题文案 key 是 `AchTitle25` / `AchDesc25`（**拼写要与 `ACHIEVEMENTS` 里的字符串完全一致**），加到 `Locale.ts`。
注意 `checkAch()` 末尾那段 `if (this.data.ach.length >= 23) { this.grant(24); }` 是「全成就」特殊判定，改总数时记得同步。

---

## 5. 新增一个能力（可乐/狂暴/武士那种）

1. `GameConfig.ts`：`ABILITY` 加参数段；`SKILLS` 加对应的 `a_xxx` 解锁节点与升级节点（`tree: 'ability'`，`currency: 'caps'`）。
2. `State.ts`：加 `hasXxx` / `xxxUnlocked` 等 getter 与触发方法（参考 `fireSamurai()` / `consumeSamurai()` 的状态机写法：`armed` → `consume` → `timer 倒数`）。
3. `Game/Abilities.ts`：加底栏按钮（`buildBar`），并把倒计时/量表接到 `Hud` 显示。
4. 表现：`Fx.ts` 加对应特效方法；触发点用 `G.onXxx` 回调挂到 `GameRoot.onLoad`（参考 `G.onBerserk`）。

---

## 6. 新增贴图 / 音效资源（最容易漏步骤）

1. 把文件拷进 `assets/resources/Textures/<分类>/xxx.png`（或 `assets/resources/Audio/xxx.wav`）。
2. **`Core/Res.ts` 里登记**：
   - 贴图 → `TEXTURE_PATHS` 加 `'Textures/xxx/spriteFrame'`（**必须带 `/spriteFrame` 后缀**）
   - 音频 → `AUDIO_PATHS` 加 `'Audio/xxx'`
3. 使用：`Res.I.sf('xxx')`（不带 `Textures/` 和 `/spriteFrame`）；`Res.I.play('xxx')`。
4. **让编辑器生成 `.meta`**：`project_refresh_assets`，或在资源管理器里点一下。没 `.meta` 代码取不到。
5. 图片导入设置（选中 png → 属性检查器）：
   - 「类型」默认 `sprite-frame` 即可
   - 想省显存/防模糊：设 `packable`（打图集）、关 `mipmap`
   - **九宫格**：把图片设成 `sprite-frame`，填好「九宫格边框」（或代码里用 `Res.I.slice(path, l, r, t, b)` 设 inset，本项目就是这么做的）

> **漏第 2 步的症状：图是空白/默认白块，控制台不报错**（`Res.sf()` 返回 null，`setFrame` 里 `if (sf)` 跳过）。这是本项目第一高频 bug。
> 音效漏登记的症状：点了没声音，也不报错。
> **加完跑一次 `.workbuddy/tools/verify_assets.py`**，它会三向比对「代码引用的路径 ↔ `TEXTURE_PATHS` 登记 ↔ 磁盘文件」，一次查干净。（当前它报出 `GameConfig.ts:80` 的 `env/cursorwhite` 是坏的——见 `pitfalls.md` D 节。）

---

## 7. 新增一个特效

在 `Game/Fx.ts` 加方法，模式全都一样：**建节点 → 加 Sprite → setFrame 复用已有贴图 → 加 UIOpacity → tween 推一段 → 结束时 `n.destroy()`**。

可复用的贴图：`env/star`、`env/shockwave`、`env/disc`、`ui/px_white2`（纯白拉伸，配 `color` 做任意色块）、`ui/px_circle`、`ui/px_dot`、`bottle/capchip_N`。

```ts
/** 示例：向上冒的箭头 */
arrowUp(x: number, y: number, color = '#7FE1FF') {
    const n = nd(this.node, 'arrow', 48, 48, x, y);
    const sp = n.addComponent(Sprite);
    setFrame(sp, 'ui/arrow_r', 48, 48, color);
    n.angle = -90;
    const op = n.addComponent(UIOpacity);
    tween(n).by(0.5, { position: new Vec3(0, 120, 0) }, { easing: 'quadOut' }).start();
    tween(op).delay(0.25).to(0.25, { opacity: 0 }).call(() => n.destroy()).start();
}
```
加进 `FxLayer` 而不是 `GameRoot` —— `FxLayer` 在 `fxLayer` 上，**震屏会带着它抖**，且层级在 UI 之下、面板之上。

---

## 8. 排查「改了什么都没反应」

**先跑这一条**（3~10 秒，能覆盖绝大多数情况）：
```bash
<py> .workbuddy/tools/restart_cocos.py --soft
```
它会：刷新资源库（生成缺失 `.meta`）→ 等编译 → 软重载场景 → 把控制台的 error/warn 打出来。

还不行再按顺序查：

1. `typecheck.py` / `verify_assets.py` 有没有报错 → 有就修。
2. **是不是漏了 import**（本项目已踩过 3 次：`setFrame` 在 `GameRoot.ts` / `HelperHands.ts` 没 import）。Cocos 的编译有时会让这类错误变成运行期静默失效。
3. 资源没生效 → 是不是漏了 `Res.TEXTURE_PATHS`/`AUDIO_PATHS` 登记（见配方 6），跑 `verify_assets.py` 确认。
4. 编译结果明显是旧的 → `restart_cocos.py --soft --hard-cache`（删 `temp/programming` 强制全量重编译）。
   ⚠️ 别用 `debug_clear_code_cache`——**实测在 3.8.8 上报错**（菜单项不存在）。
5. `library/` 缓存坏了、编辑器整体发懵 → `restart_cocos.py --full --dry-run` 看计划 → `restart_cocos.py --full`。
6. 逻辑没跑 → 在里面 `console.log` 打一行，浏览器预览开 F12 看。
   （`read_console(sources:["game"])` 目前拿不到东西，因为游戏侧没挂日志采集钩子——见 `editor-ops.md` §6。）
7. **改了颜色但画面纹丝不动、又不报错** → 极可能是 `Color.fromHEX(sp.color, '#xxx')` 就地改色失效（坑 34）：
   `sp.color` 返回内部 `_color` 本体，就地改写引用不变 → setter 早退 → 顶点色不刷新。
   读回来还是新色，所以日志/自检看不出问题。改色一律走 `UIKit.tint()`。

## 9. 排查「点了没反应」

见 `input-physics-api.md` 末尾的 6 步清单。本项目最常见的两个原因：
- 热区节点没有尺寸（`nd()` 传了 `w/h` 才有）→ 用透明色块做热区：`rect(card, 150, 76, x, y, '#00000000', 'hit')`。
- 上层节点没设 `e.propagationStopped = true`，事件被别处消费。参考 `Bottle.enableTouch()` 的写法。

## 10. 加双语文案

`Locale.ts` 的 `L` 表加 `{ zh, en }`，用 `t('key', G.lang)` 取。
**不要**在代码里写死中文字符串——切语言时不会变。`G.lang` 来自存档 `settings.lang`，设置面板改完调 `G.notify()` 会整面板重绘。

## 11. 改存档结构（危险操作）

1. `Save.ts` 的 `SaveData` 加字段 + `defaultSave()` 补默认值（**必须**，否则老档 `undefined` 会一路传到逻辑里）。
2. `loadSave()` 里的合并逻辑会自动兜底 `settings` / `stats`（`Object.assign(defaultSave().xxx, o.xxx)`）；顶层新字段靠 `Object.assign(d, o)` 带上，但**数组/嵌套对象要自己加校验**（参考 `bottles` 长度校验那段）。
3. `GameConfig.ts` 的 `SAVE_VERSION` +1。
4. 测试：先在浏览器删 `localStorage` 的 `tapbottle.save.v1` 跑一遍新档，再把旧 JSON 塞回去跑一遍。

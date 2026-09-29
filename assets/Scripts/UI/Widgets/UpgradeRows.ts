import { Color, Graphics, Label, Node, Sprite } from 'cc';
import { BottleStatDef, SkillDef, TIER_SHORT_EN, TIER_SHORT_ZH } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { hex } from '../../Core/Util';
import { Res } from '../../Core/Res';
import { Prefabs } from '../../Core/Prefabs';
import { t } from '../../Core/Locale';
import { TEXT_SS, label, nd, newBadgePlate, setFrame, sliced, tint } from '../Base/UIKit';
import { wobble } from '../Base/Theme';

/**
 * 内嵌面板里的**一格**选项卡（左侧图标 + 名称/数值，右侧一枚价格按钮）。
 *
 * ★ 用户口径（第十九轮）：「下面选项部分的文字太长且太小看不清」→ **缩短 + 放大文字**。
 *   · 只改字号，**不动格子尺寸**（用户明确要求「格子不要放大」）：
 *     名称 18 → 26、说明 12 → 19、按钮 16 → 20、图标 40 → 46；格子仍是 322×78。
 *   · 名称一律改成「短阶名（普通/铜瓶/…）+ 2~4 字词条名」（Locale 的 bs_* / sk_* 同步压短）。
 *   · 说明不再用长句，改由 `statSub()` / `skillSub()` 生成「当前 → 下一级」的紧凑数值。
 *
 *   ⚠️ 根因说明：Cocos Label 的 `Overflow.SHRINK` 会把**放不下的文字自动缩小**，
 *      所以「格子窄 + 文案长」表现出来就是「文字忽然变得极小又看不清」——
 *      光调大 fontSize 是没用的（SHRINK 会再把它压回去），必须同时把文案压短。
 *
 * ★ 用户口径（第二十轮）：「不要隐藏消耗的货币，货币前面加上对应的货币图标，
 *   广告标识放到选项的右上角」：
 *   · 价格按钮 = `[货币图标] 纯数字`，货币类型由 `RowSpec.cur`（'coin' 金币 / 'cap' 瓶盖）决定，
 *     图标分别是 `ui/coin` 与 `bottle/capchip_6`（和顶栏两个筹码用的是同一对贴图）；
 *   · **ad 态不再清空价格文字** —— 以前 ad 时把 label 抹成空、只剩一枚摄像机图标，
 *     玩家看不出这格要花多少钱；现在价格照显，`ksp` 广告角标改挂**格子右上角**
 *     （与「新」角标互斥让位，见 applyRow）。
 *
 * ★★ 用户口径（第三十九轮）：「列表选项的按钮应该是整个选项，不是单个按钮…
 *    点击整个选项就是选择这个选项，按钮不需要底框了」：
 *   · **整格即按钮**：TOUCH 事件从 `ui.btn`（92×52 那枚价格按钮）上移到 `ui.root`（322×78），
 *     点图标/点名字/点空白/点价格，四个位置行为完全一致；
 *   · 价格区的底板（`btn` 上的 Sprite）**停用**，价格退化为纯标签
 *     —— 货币图标 + 数字直接浮在行底框上，四态改用**文字颜色**表达（见 TONE）；
 *   · 热区变大后必须挡「滚动误触」：按下后位移超过 DRAG_SLOP 就判定为滑动列表，
 *     抬手不再触发购买（见 makeCell）。
 */

/** 网格参数（BottomPanel 按这个排 content）—— 尺寸保持不变 */
export const COLS = 2;
export const CELL_W = 322;
export const CELL_H = 78;
export const GAP_X = 14;
export const GAP_Y = 10;

/* ---- 格子内部排版常量 ----
 * ★★ 第八十轮起：这些常量**只用于两处兜底**，不再决定运行时布局 ——
 *   ① `constructCell()`（prefab 加载失败时的运行时搭建）；
 *   ② `snap()` 在节点缺失时的默认尺寸。
 *   实际排版以 `Prefabs/UI/UpgradeRow.prefab` 为准（改这里不会影响游戏里已加载的 prefab）。
 *   要调商店页 / 升级页 / 技能树的行内位置，改 prefab；改完跑 drift_check.py 确认没被代码顶掉。
 */
const ICON_H = 46;          // 图标高度（瓶身贴图按 0.4 瘦高比缩宽，见 iconW）
const ICON_X = -128;        // 图标/底板中心（★ 第四十一轮右移 8px：底框左缘 -154，距格子左缘 7px，不再贴边）
/** 图标中心 y：下移 6px，给左上角的「新」角标让出顶部空间（瓶口只被盖 ~4px） */
const ICON_Y = -6;
const TEXT_X = -112;        // 名称/说明的左缘（左对齐锚点）
const TEXT_W = 172;         // 文字栏宽度（18 → 26 号字之后，能容纳 ~6 个汉字）
const NAME_Y = 17, NAME_H = 30, NAME_SIZE = 26;
/** ★ 第一〇九轮：说明行改**两行盒**（48 = 19 号字 × 1.15 行距 × 2）——
 *  长说明（解锁型一句话、占位提示）放得下两行；单行文案垂直居中视觉不变。
 *  ⚠️ 这种 Label 的 SHRINK 实测不生效（超宽只会原样溢出），行高必须靠盒子本身兜住。 */
const SUB_Y = -18, SUB_H = 48, SUB_SIZE = 19;
const BTN_W = 92, BTN_H = 52, BTN_X = 111, BTN_SIZE = 20;

/* ---- 名称栏的「瓶阶图标 + 词条名」（★ 用户口径 · 第二十一轮）----
 * 「普通·收益」里的「普通」两个字改成**对应瓶子的贴图**（同比例缩放：瓶身 canvas 是
 * 159×397 ≈ 0.4 的瘦高比，见 iconW），文字整体右移、宽度相应收窄。
 * 高度取 28（= NAME_H 30 内缩 1），实宽约 11px —— 瓶身本来就细，这正是原图的形状。 */
const NAME_ICON_H = 28;
/** 名字美术字（wzi 图）显示高度（NAME_H 30 内缩）—— 宽度按图比例 contain */
const NAME_IMG_H = 24;
/** 瓶阶图标中心 x（贴名称栏左缘，图标宽的一半约 6px）★ 第四十一轮随底框右移 8px */
const NAME_IC_X = -98;
/** 有瓶阶图标 / 稀有度底板时：名字与说明整体右移、文字栏收窄（给左侧图形让位） */
const NAME_TEXT_X = -98, NAME_TEXT_W = 158;

/* ---- 瓶阶词条行的「稀有度底板 + 瓶身 + 词条角标」（★ 用户口径 · 第二十一轮）----
 * 左侧大图标不再是词条图标（收益 $ 等），改成**对应瓶子 + 稀有度色圆角底板**，
 * 词条图标缩小成角标**跨在底板右下角**（对照用户给的参考图）。
 * 节点顺序即渲染序：底板（先建）→ 瓶身 → 角标（后建、画在最上）。 */
const TIER_BG = 46;         // 底板边长（格子左缘 -161，左留 2px）
const TIER_BOTTLE_H = 40;   // 底板里瓶身的显示高度（≈87%，留边）
const BADGE_ICON = 18;      // 词条角标边长
/** 角标中心：贴底板右下角内侧（★ 第四十一轮随底框右移 8px；右缘 -102，与文字左缘 -98 留 4px） */
const BADGE_X = -112, BADGE_Y = -24;

/* ---- 价格按钮内部的「货币图标 + 数字」排布（★ 第二十轮） ----
 * 用户口径（第二十轮复盘）：图标和数字要**拉开** —— 原来间隙只有 4px，
 * 长数字（1.00K / 10.0K）会被 SHRINK 压到贴着图标，看起来就像图标压住数字。 */
/** 货币图标高度（金币 `ui/coin` 1:1 / 瓶盖 `bottle/capchip_6` 1.14:1，按比例 contain） */
const CUR_ICON_H = 22;
/** 图标中心（按钮本地坐标：贴左缘内缩 13 → 右缘落在 -22，与数字栏留 ~10px 间隙） */
const CUR_ICON_X = -BTN_W / 2 + 13;
/** 有货币图标时数字栏：右移给图标让位，间隙 ≥10px。
 *  第八十轮：无货币图标的行不再需要「另一个常量」—— 数字直接居中于按钮（x=0），
 *  宽度取按钮宽 -10，见 applyRow 里的 btnLb 段。 */
const CUR_TEXT_X = 13, CUR_TEXT_W = 50;

/* ---- 右上角两枚角标 ----
 * ⚠️⚠️ 这里的坐标是**相对价格按钮**的，不是相对格子 —— 角标必须挂在按钮节点之下。
 *   原因（2026-09-24 定位）：Cocos 的触摸命中按「渲染顺序倒序」找第一个命中节点，
 *   同层里**后建的节点在上层**。角标原来挂在 cell 上、建在按钮之后，恰好盖住按钮
 *   右上角约 1/4 面积 → 点在那里时事件被角标吃掉，冒泡到 cell 就停了，
 *   按钮的 TOUCH_END 根本不触发 —— 表现就是「点了有晃动反馈、但什么都没发生」。
 *   挂成按钮的子节点后，事件从角标冒泡**经过按钮**，按钮照常收到。
 */
/** 「看广告」图标尺寸（ksp 摄像机贴图）—— 缩到 30 贴角，别压住价格数字 */
const AD_ICON = 30;
/** 广告角标中心：贴**格子**右上角 → 换算成按钮本地坐标（按钮中心在 cell x = BTN_X 处） */
const AD_X = CELL_W / 2 - AD_ICON / 2 - 2 - BTN_X, AD_Y = CELL_H / 2 - AD_ICON / 2 - 2;
/** 「新」角标中心：贴**格子左上角**（用户口径：右上角压价格按钮，挪左上）—— 按钮本地坐标。
 *   左上只剩瓶身图标（窄 18px），角标改小到 46×24 并把图标下移 6px 让位，不再与广告角标抢位。 */
const NEW_X = -CELL_W / 2 + 25 - BTN_X, NEW_Y = CELL_H / 2 - 14;

/**
 * 四态肤色：可买 / 买不起 / 满级 / 前置未解锁。
 *
 * ★★ 第三十九轮（用户口径：「列表选项的按钮应该是整个选项…按钮不需要底框了」）：
 *    右侧价格区**不再是独立按钮** —— 整个格子（322×78）就是点击热区，
 *    价格只剩「货币图标 + 数字」直接浮在行底框（bd12 奶油底）上，
 *    原先那层金底/红底的按钮底板已停用（见 applyRow 里的 btnSp.enabled = false）。
 *
 *    ⚠️ 因此这里从「底色 + 前景色」精简为**只有前景色**，而且必须挑在奶油底上够深的色：
 *       原来 `bg:'#F2C34E' + fg:'#7A4210'` 是「金底深棕字」，底色一撤，
 *       金色字（#F2C34E）在 #F6E3C5 上几乎看不见 —— 这套配色不能照搬。
 */
export type Tone = 'on' | 'off' | 'max' | 'lock';
const TONE: Record<Tone, { fg: string }> = {
    // ★ 第五十六轮（用户口径）：「货币足够消耗则显示绿色，不足显示红色，不管瓶盖还是金币」
    on:   { fg: '#3F7A2E' },   // 可买：绿（与满级绿同款，奶油底上读得清）
    off:  { fg: '#C0392B' },   // 买不起：红（金币/瓶盖不足统一红）
    max:  { fg: '#3F7A2E' },   // 满级：绿
    lock: { fg: '#96866F' },   // 前置未解锁：灰
};

/** 一行的全部显示数据 —— 由 BottomPanel 按当前进度现算，`apply` 只改字符串/颜色，绝不重建节点 */
export interface RowSpec {
    /**
     * 「新」标签用的稳定 id（见 Save.seenModules 注释）。
     * 有 id 且**玩家还没点过** → 格子右上角挂一枚红色「新」角标；点一次按钮即视为已读。
     * 占位行 / 说明行不给 id。
     */
    id?: string;
    icon: string;
    name: string;
    /**
     * ★ 名称栏最左边的小图标（第二十一轮）：**瓶阶词条**行放对应瓶子的贴图
     *   （`bottle/body_N`，同比例缩放到 NAME_ICON_H）——
     *   以前这里写的是「普通·」「铜瓶·」前缀文字，白占 3 个 26 号汉字的宽度，
     *   换成图标后文字栏立刻宽松，也不会再被 SHRINK 压小。
     *   不填则名字照旧从名称栏左缘开始。
     */
    nameIcon?: string;
    /**
     * ★ 瓶阶词条角标（第二十一轮）：左侧大图标改成「稀有度底板 + 对应瓶身」后，
     *   原来的词条图标（收益 $ / 悬停手势 …）缩成 `BADGE_ICON` 小角标**跨在底板右下角**。
     *   有 badge 才画底板；`badgeBg` 是底板填充色（用该阶稀有度色）。
     */
    badge?: string;
    badgeBg?: string;
    /**
     * ★ 名字美术字（第三十五轮）：瓶子行用 `bottle/name_N`（wzi 系列，自带阶色底），
     *   有值时隐藏 name 文本、显示这张图；不填走文本。
     */
    nameImg?: string;
    /**
     * ★ 底框进度（第三十五轮，ztk 双层）：瓶子行传当前等级与上限——
     *   底框 ztk_1（奶油），上面叠 ztk_2（金）按 `lv/lvMax` 做 FILLED 横向填充，
     *   每升一级填充涨一截，点满时 fillRange=1 完全盖住（= 满级金底框）。
     */
    lv?: number;
    lvMax?: number;
    sub: string;
    /**
     * ★ 这一行**消耗什么货币**（第二十轮）：
     *   'coin' 金币 / 'cap' 瓶盖 → 价格按钮左侧画对应货币图标（金币 / 瓶盖贴图）；
     *   undefined → 不是价格行（MAX / 解锁 / 占位说明）。
     *   ★ 用户口径：「选项不要隐藏消耗的货币」—— 以前 ad 态会把整句价格抹掉、
     *     只留一枚摄像机图标，玩家根本不知道这一格要花多少钱。
     */
    cur?: 'coin' | 'cap';
    /**
     * 按钮文案。
     * · 有 `cur`（价格行）→ 这里只放**纯数字**（`120` / `1.6K`），货币符号由左侧图标表示；
     * · 无 `cur`（状态行）→ `解锁` / `MAX` / `—`，整格居中。
     */
    label: string;
    tone: Tone;
    /**
     * ★ 金币/瓶盖不足但有广告出路 → 格子**右上角**亮 ksp 广告视频图标。
     *   价格本身照常显示（不再被隐藏）；点击走原 onBuy → moneyShortAd 看广告补足流程。
     */
    ad?: boolean;
    /**
     * ★ 用户口径（第二十轮）：这行买成时是否补一声 `buy` 音效。
     *   **只有商店页的物品**打开它（买瓶 / 瓶盖机器 / 抓取光圈 / 助手之手）；
     *   升级页的词条与技能树的科技节点属于「升级解锁」，不播 `buy`。
     */
    buySfx?: boolean;
    /**
     * 点这一格：`after()` 由调用方用来刷整块列表。
     * ★ 第三十九轮起整格即按钮，`from` 是**被点的那个格子节点**（`RowUI.root`，322×78）——
     *   买瓶飞入拿它的世界坐标当起飞点（原来是那枚 92×52 的价格按钮，改后飞入起点
     *   从「行的右侧」变成「行中心」，视觉上就是从被点的选项里飞出来）。
     */
    onBuy: (after: () => void, from?: Node) => void;
}

/**
 * 行内各节点的**初始布局** —— 实例化时从 prefab 读一次，之后不再变。
 *
 * ★★ 第八十轮（用户口径）：「列表选项的预制体和技能模块预制体我也没法手动调整…
 *    我改动预制体能直接调整对应的游戏位置」。此前 applyRow 把 8 处坐标写成常量
 *    （ICON_X/BADGE_X/NAME_TEXT_X…），编辑器里拖 prefab 一律被顶回去。
 *    现在位置与尺寸**只认这份快照**，也就是：
 *      · 改 `UpgradeRow.prefab` 里任一节点的位置/大小 → 商店页 / 升级页 / 技能树**全部**生效；
 *      · 代码只负责「填文字 / 换图 / 切 active / 按贴图比例算图标宽」这些数据活。
 *    （prefab 缺节点时走 constructCell 兜底，快照取下面的常量，两条路径同构。）
 */
export interface RowRect { x: number; y: number; w: number; h: number; }
export interface RowLayout {
    /** 左侧大图标（h = 显示高度，宽度按贴图比例算） */
    icon: RowRect;
    /** 图标背后的稀有度底板（w = 边长） */
    tier: RowRect;
    /** 底板右下角的词条小角标（h = 边长） */
    badge: RowRect;
    /** 名称栏最左的瓶阶小图标（h = 高度） */
    nameIc: RowRect;
    /** 名称文字栏（x = 左缘 —— label 锚点在左；w 是**栅格化**宽度） */
    name: RowRect;
    /** 说明文字栏（宽度跟着 name） */
    sub: RowRect;
    /** 价格区容器（无货币图标的行，数字铺满它） */
    btn: RowRect;
    /** 价格数字（有货币图标时的态：x = 数字栏中心，w = 栏宽） */
    btnLb: RowRect;
    /** 左上角「新」角标（按钮本地坐标） */
    newTag: RowRect;
}

/** 读节点实例化后的初始布局（节点缺失时用兜底尺寸） */
function snap(n: Node | null, dw: number, dh: number): { x: number; y: number; w: number; h: number } {
    const ok = !!n && n.isValid;
    const ut = ok ? (n!.getComponent('cc.UITransform') as any) : null;
    return {
        x: ok ? n!.position.x : 0,
        y: ok ? n!.position.y : 0,
        w: ut ? ut.contentSize.width : dw,
        h: ut ? ut.contentSize.height : dh,
    };
}

export interface RowUI {
    root: Node;
    /** 初始布局快照（见 RowLayout 注释；applyRow 的位置一律取这里） */
    L: RowLayout;
    /** 瓶阶词条行的稀有度色圆角底板（`spec.badge` 为空时隐藏；画在瓶身**下面**） */
    tierBg: Node;
    icon: Sprite;
    /** 底板右下角的词条小角标（收益 $ 等，画在瓶身**上面**） */
    badgeSp: Sprite;
    /** 名称栏左侧的瓶阶小图标（`spec.nameIcon` 为空时隐藏） */
    nameIc: Sprite;
    name: Label;
    sub: Label;
    /** 名字美术字（wzi 图，瓶子行用；applyRow 懒建，prefab 无此节点） */
    nameImg: Sprite;
    /** 等级数字「0/10」（底框左下角，applyRow 懒建） */
    lvLb: Label;
    btn: Node;
    btnSp: Sprite;
    btnLb: Label;
    /** 价格按钮左侧的货币图标（金币 `ui/coin` / 瓶盖 `bottle/capchip_6`） */
    curSp: Sprite;
    /** 金币/瓶盖不足时的 ksp 广告图标（挂在**格子右上角**，applyRow 按 spec.ad 切换） */
    adSp: Sprite;
    /** 右上角「新」角标 */
    newTag: Node;
    spec: RowSpec;
}

/**
 * ★ 预制体优先（2026-09-28）：行单元 = `Prefabs/UI/UpgradeRow.prefab` 实例化后按节点名
 *   绑定引用，图片/颜色/文字全部走 applyRow 赋值（prefab 里已带 card_white/占位图引用）。
 *   预制体缺失（加载失败）→ constructCell() 运行时兜底，节点树逐一同构。
 */
export function makeCell(parent: Node, x: number, y: number, spec: RowSpec, onRefresh?: () => void): RowUI {
    const made = Prefabs.boot().make('UI/UpgradeRow');
    const ui = made ? bindRow(made) : constructCell(parent);
    ui.root.setPosition(x, y, 0);
    if (made) { parent.addChild(ui.root); }

    /* ---- ★ 第三十九轮（用户口径）：整格即按钮 ----
     * 原来只有右侧那枚 92×52 的价格按钮能点（TOUCH 挂在 `ui.btn` 上），
     * 玩家以为「只有这个小按钮能买」。现在改成**整格（322×78）都是热区**，
     * 点名字、点图标、点空白处都一样触发 —— 价格区退化成纯展示的「价格标签」。
     *
     * ⚠️ 热区一变大，「只是想滚列表」的手指也会落在格子上：
     *    ScrollView 的滚动和格子的 TOUCH_END 是两条独立链路（滚动**不会**取消 TOUCH_END），
     *    所以拖动过程中抬手会**误买**。这里用位移阈值挡掉 —— 按下后累计位移超过
     *    DRAG_SLOP 就认定是「滑动列表」，抬手不再触发购买（顺带也不再播 click 音/晃动）。
     */
    const DRAG_SLOP = 18;
    let downX = 0, downY = 0, moved = false;
    ui.root.on(Node.EventType.TOUCH_START, (e) => {
        downX = e.getUILocation().x; downY = e.getUILocation().y; moved = false;
        ui.root.setScale(0.97, 0.97, 1);
    });
    ui.root.on(Node.EventType.TOUCH_MOVE, (e) => {
        if (moved) { return; }
        const p = e.getUILocation();
        if (Math.abs(p.x - downX) + Math.abs(p.y - downY) > DRAG_SLOP) { moved = true; }
    });
    ui.root.on(Node.EventType.TOUCH_CANCEL, () => {
        moved = true;                  // 触摸被系统/父级打断 → 不当成点击
        ui.root.setScale(1, 1, 1);
    });
    ui.root.on(Node.EventType.TOUCH_END, () => {
        ui.root.setScale(1, 1, 1);
        if (moved) { return; }         // 刚刚在滚列表，不算点击
        // ★ 用户口径（第二十轮）：列表里的**选项**统一点击音效（与底栏/弹窗按钮同款 click）
        if (Res.I) { Res.I.play('click', 0.7); }
        // ★ 用户口径（第十七轮）：点列表里的选项，整张卡片也左右晃一下（和底栏页签同款反馈）
        wobble(ui.root);
        // 点过就算「已读」：哪怕这次买不起，玩家也已经注意到它了（红点别一直挂着）
        if (ui.spec.id) { G.markItemSeen(ui.spec.id); }

        // ★★ 用户口径（第二十轮）：**商店页**的物品买成时补一声 `buy`
        //   —— 付金币、付瓶盖、看广告补足后成交，三种情况都只响一次；
        //   升级页 / 技能树属于「升级解锁」，不开这个开关，只留上面的 click。
        //   判定依据：`after()` 是调用方在「确实购买成功」时唯一会走的回调
        //   （满级 / 已拥有 / 满仓 / 只是弹提示，全是提前 return，不会调它），
        //   所以把 buy 挂在 after 包装里，同步付款与异步广告补足两条路径都能覆盖。
        const buySfx = !!ui.spec.buySfx;
        let bought = false;
        ui.spec.onBuy(() => {
            if (buySfx && !bought) {   // 防同一行重复回调把 buy 播两遍
                bought = true;
                if (Res.I) { Res.I.play('buy', 0.85); }
            }
            if (onRefresh) { onRefresh(); }
        }, ui.root);
    });
    applyRow(ui, spec);
    return ui;
}

/** 预制体实例 → 按节点名接手引用（名字与 UpgradeRow.prefab 一一对应，改 prefab 必须同步） */
function bindRow(root: Node): RowUI {
    const spriteOf = (p: Node | null, n: string): Sprite =>
        p?.getChildByName(n)?.getComponent(Sprite) || null!;
    const labelOf = (p: Node | null, n: string): Label =>
        p?.getChildByName(n)?.getComponent(Label) || null!;
    const btn = root.getChildByName('btn') || null!;
    // 第三十八轮：自定义字体资产已删除，prefab 里的 Label 保持系统默认字体，不再做替换
    const tag = btn.getChildByName('newTag');
    // ★ 第四十四轮：newTag 换 buco06/new_badge 圆徽章 + 白字
    //   ★ 第一〇四轮：prefab 已烘好 tagLb → 按名复用，找不到才现建（兜底旧场景）
    if (tag && tag.isValid) {
        newBadgePlate(tag);
        let nlb = tag.getChildByName('tagLb')?.getComponent(Label) || null;
        if (!nlb || !nlb.isValid) {
            nlb = label(tag, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
            nlb.node.name = 'tagLb';
        } else if (nlb.string !== t('tag_new', G.lang)) {
            nlb.string = t('tag_new', G.lang);
        }
    }
    const tierBg = root.getChildByName('tierBg') || null!;
    // ★ 第八十轮：实例化后**立刻快照 prefab 的布局** —— 之后 applyRow 再也不会写死坐标，
    //   编辑器里拖 prefab 里任一节点即可改商店页/升级页/技能树的排版。
    const L: RowLayout = {
        icon: snap(root.getChildByName('ic'), ICON_H, TIER_BOTTLE_H),
        tier: snap(tierBg, TIER_BG, TIER_BG),
        badge: snap(root.getChildByName('badgeIc'), BADGE_ICON, BADGE_ICON),
        nameIc: snap(root.getChildByName('nameIc'), 11, NAME_ICON_H),
        name: snap(root.getChildByName('name'), TEXT_W * TEXT_SS, NAME_H * TEXT_SS),
        sub: snap(root.getChildByName('sub'), TEXT_W * TEXT_SS, SUB_H * TEXT_SS),
        btn: snap(btn, BTN_W, BTN_H),
        btnLb: snap(btn ? btn.getChildByName('btnLb') : null, CUR_TEXT_W * TEXT_SS, (BTN_H - 12) * TEXT_SS),
        newTag: snap(tag, NEW_X, NEW_Y),
    };
    return {
        root, L,
        tierBg,
        icon: spriteOf(root, 'ic'),
        badgeSp: spriteOf(root, 'badgeIc'),
        nameIc: spriteOf(root, 'nameIc'),
        name: labelOf(root, 'name'),
        sub: labelOf(root, 'sub'),
        btn,
        btnSp: btn.getComponent(Sprite)!,
        btnLb: labelOf(btn, 'btnLb'),
        curSp: spriteOf(btn, 'curIc'),
        adSp: spriteOf(btn, 'adIcon'),
        // ★ 第一〇四轮：prefab 已烘好这两个节点 → 按名绑定，applyRow 的惰性建不会再建第二份
        //   （绑定为空时才走现建兜底；位置/宽高由 applyRow 按 spec 刷新）
        nameImg: (root.getChildByName('nameImg')?.getComponent(Sprite) || null)!,
        lvLb: (root.getChildByName('lvLb')?.getComponent(Label) || null)!,
        newTag: tag || null!,
        spec: null!,
    };
}

/** 运行时兜底搭建（与 UpgradeRow.prefab 逐节点同构；prefab 加载失败时才走） */
function constructCell(parent: Node): RowUI {
    const root = nd(parent, 'cell', CELL_W, CELL_H, 0, 0);

    // 卡片底（★ bd12 换皮：奶油圆角底板自带描边，外圈 stroke 保留同构但隐藏）
    //   描边先建（兄弟序=渲染序，底板盖在上面）
    const st = sliced(root, 'ui/panel/card_white', CELL_W + 6, CELL_H + 6, 0, 0, [24, 24, 24, 24], '#3A1C08', 'stroke');
    const bg = sliced(root, 'skin/main/row_bg', CELL_W, CELL_H, 0, 0, [24, 24, 24, 24], '#FFFFFF', 'bg');
    st.node.active = false;
    void bg;

    // ★ 瓶阶词条行的稀有度底板（★ 画在瓶身**下面** —— 兄弟序=渲染序，必须先建；非词条行隐藏）
    const tierBg = nd(root, 'tierBg', TIER_BG, TIER_BG, ICON_X, ICON_Y);
    tierBg.active = false;
    tierBg.addComponent(Graphics);

    // ★ 用户口径（第十五轮）：瓶阶图标直接用 body_N 同比例缩小（瘦高比 0.4），icon_* 切图已删除
    const iw0 = iconW('stat/income', ICON_H);
    const icNode = nd(root, 'ic', iw0, ICON_H, ICON_X, ICON_Y);
    const icon = setFrame(icNode.addComponent(Sprite), 'stat/income', iw0, ICON_H);

    // ★ 词条小角标（跨在底板右下角、画在瓶身**上面**；非词条行隐藏）
    const bdNode = nd(root, 'badgeIc', BADGE_ICON, BADGE_ICON, BADGE_X, BADGE_Y);
    bdNode.active = false;
    const badgeSp = setFrame(bdNode.addComponent(Sprite), 'stat/income', BADGE_ICON, BADGE_ICON);

    // ★ 名称栏最左的瓶阶小图标（第二十一轮）：瓶阶词条行用它替代「普通·」这类前缀文字
    const niW = iconW('bottle/body_0', NAME_ICON_H);
    const niNode = nd(root, 'nameIc', niW, NAME_ICON_H, NAME_IC_X, NAME_Y);
    niNode.active = false;
    const nameIc = setFrame(niNode.addComponent(Sprite), 'bottle/body_0', niW, NAME_ICON_H);

    const name = label2(root, TEXT_X, NAME_Y, TEXT_W, NAME_H, NAME_SIZE, '#7A4210');
    const sub = label2(root, TEXT_X, SUB_Y, TEXT_W, SUB_H, SUB_SIZE, '#8A5A28');

    // 价格区（宽 92，右沿 157；格子右半 161 → 留 4px）
    // ★ 第三十九轮：整格即按钮后它**只剩定位作用** —— 装着「货币图标 + 数字（+ 角标）」，
    //   自身那层金底/红底底板已停用（保留 Sprite 组件仅为与 prefab 逐节点同构）。
    const btn = nd(root, 'btn', BTN_W, BTN_H, BTN_X, 0);
    const btnPlate = btn.addComponent(Sprite);
    btnPlate.enabled = false;
    // 价格按钮的文字**居中**于「图标右侧的剩余空间」：不能用左对齐的 label2
    // （锚点在左会让字整体偏右）。默认按「有货币图标」布局建，applyRow 按 spec.cur 再切。
    const btnLb = label(btn, '', CUR_TEXT_X, 1, CUR_TEXT_W, BTN_H - 12, {
        size: BTN_SIZE, color: TONE.on.fg, overflow: 'shrink',
    });

    // ★ 货币图标（第二十轮）：金币 `ui/coin` / 瓶盖 `bottle/capchip_6`，摆在数字左边；默认隐藏
    const curNode = nd(btn, 'curIc', CUR_ICON_H, CUR_ICON_H, CUR_ICON_X, 1);
    curNode.active = false;
    const curSp = setFrame(curNode.addComponent(Sprite), 'ui/icon/coin', CUR_ICON_H, CUR_ICON_H);

    // ★ 广告出路图标（ksp 摄像机贴图）贴在**格子右上角**，不再盖住价格文字。
    //   ⚠️ 挂 btn 下而不是 root 下：见文件上方 AD_X 注释（否则会挡住按钮的触摸）
    const adNode = nd(btn, 'adIcon', AD_ICON, AD_ICON, AD_X, AD_Y);
    adNode.active = false;
    const adSp = setFrame(adNode.addComponent(Sprite), 'ui/icon/ksp', AD_ICON, AD_ICON);

    // 兜底路径的布局快照 = 上面的常量（与 UpgradeRow.prefab 逐节点同值，改 prefab 时别忘了这里）
    const L: RowLayout = {
        icon: { x: ICON_X, y: ICON_Y, w: ICON_H, h: TIER_BOTTLE_H },
        tier: { x: ICON_X, y: ICON_Y, w: TIER_BG, h: TIER_BG },
        badge: { x: BADGE_X, y: BADGE_Y, w: BADGE_ICON, h: BADGE_ICON },
        nameIc: { x: NAME_IC_X, y: NAME_Y, w: niW, h: NAME_ICON_H },
        name: { x: NAME_TEXT_X, y: NAME_Y, w: NAME_TEXT_W * TEXT_SS, h: NAME_H * TEXT_SS },
        sub: { x: NAME_TEXT_X, y: SUB_Y, w: NAME_TEXT_W * TEXT_SS, h: SUB_H * TEXT_SS },
        btn: { x: 0, y: 0, w: BTN_W, h: BTN_H },
        btnLb: { x: CUR_TEXT_X, y: 1, w: CUR_TEXT_W * TEXT_SS, h: (BTN_H - 12) * TEXT_SS },
        newTag: { x: NEW_X, y: NEW_Y, w: 0, h: 0 },
    };
    const ui: RowUI = { root, L, tierBg, icon, badgeSp, nameIc, name, sub, nameImg: null!, lvLb: null!, btn, btnSp: btn.getComponent(Sprite)!, btnLb, curSp, adSp, newTag: null!, spec: null! };

    // ★ 右上角「新」角标（用户口径：新出现的可买/可研发项要标出来，点过即消）
    //   底板 = buco06 红圆徽章整图（33×33 原尺寸），中间「新」字原生字体白字
    //   有广告角标时会被挤到左边（见 applyRow）；同样挂 btn 下（见 AD_X 注释）
    const tag = nd(btn, 'newTag', 33, 33, NEW_X, NEW_Y);
    setFrame(tag.addComponent(Sprite), 'skin/main/new_badge', 33, 33);
    label(tag, t('tag_new', G.lang), 0, 1, 24, 20, { size: 13, color: '#FFFFFF', overflow: 'shrink' });
    ui.newTag = tag;

    return ui;
}

/** 换贴图并按原始宽高比 contain 到指定高度（币图标/名字美术字用） */
export function setFrameH(sp: Sprite, path: string, h: number) {
    setFrame(sp, path, h, h);
    const sf = sp.spriteFrame;
    if (sf && sf.width > 0 && sf.height > 0) {
        const k = Math.min(h / sf.width, h / sf.height);
        (sp.node.getComponent('cc.UITransform') as any)
            .setContentSize(Math.round(sf.width * k), Math.round(sf.height * k));
    }
}

/** 只改文本与颜色（不换节点） */
export function applyRow(r: RowUI, spec: RowSpec) {
    r.spec = spec;
    // ★ 瓶阶词条行（第二十一轮）：瓶身缩进稀有度底板里（42 高）——
    //   ★ 第三十八轮起**所有行**都进底框（用户口径：底框不止瓶子，功能板块一样有），
    //   图标统一 contain 到 TIER_BOTTLE_H，视觉完全一致。
    const L = r.L;
    const bd = spec.badge;
    // ★ 第八十轮：图标**显示高度**取 prefab 里 ic 的高度（编辑器里拖 ic 即可放大缩小），
    //   宽度仍按贴图比例算（瓶身 0.4 瘦高比 / 方形图标 1:1）——这部分是「数据活」，不该写死。
    const ih = L.icon.h;
    const iw = iconW(spec.icon, ih);
    // 位置不再写死：以 prefab 快照为准（第八十轮，见 RowLayout 注释）
    (r.icon.node.getComponent('cc.UITransform') as any).setContentSize(iw, ih);
    setFrame(r.icon, spec.icon, iw, ih);
    // 底框（★ 第三十五轮换皮 ztk 双层；★ 第三十八轮起**所有行都显示**）：
    //   ztk_1 奶油底框 + ztk_2 金色 FILLED 进度层（fillRange = lv/lvMax，
    //   每升一级涨一截，点满 = 1 完全盖住 → 视觉即满级金底框）。
    //   没有等级概念的行（机器/光圈等一次性购买）不传 lv/lvMax → 只显示奶油底框。
    //   prefab 里的 tierBg 节点只当容器用（Graphics 组件禁用，不删节点不动数组）。
    const tierBgN = L.tier.w + 6;   // 进度层比底板外扩 6px
    if (r.tierBg && r.tierBg.isValid) {
        r.tierBg.active = true;
        const g = r.tierBg.getComponent(Graphics);
        if (g && g.enabled) { g.enabled = false; }
        // 懒建两层（prefab / constructCell 都没有这两层，运行时补齐；中心随底板）
        let z1 = r.tierBg.getChildByName('ztk1');
        let z2 = r.tierBg.getChildByName('ztk2');
        if (!z1) {
            z1 = nd(r.tierBg, 'ztk1', tierBgN, tierBgN, 0, 0);
            setFrame(z1.addComponent(Sprite), 'skin/tier/ztk_1', tierBgN, tierBgN);
            z2 = nd(r.tierBg, 'ztk2', tierBgN, tierBgN, 0, 0);
            const sp2 = setFrame(z2!.addComponent(Sprite), 'skin/tier/ztk_2', tierBgN, tierBgN);
            sp2.type = Sprite.Type.FILLED;
            sp2.fillType = Sprite.FillType.HORIZONTAL;   // 横向：从左往右按等级填充
            sp2.fillStart = 0;
            sp2.fillRange = 0;
        }
        const lv = spec.lv ?? 0, lvMax = spec.lvMax ?? 0;
        (z2!.getComponent(Sprite) as Sprite).fillRange = lvMax > 0 ? Math.min(1, lv / lvMax) : 0;
        // ★ 等级数字「0/10」（效果图口径）：贴底框左下角**框内**，随 lv/lvMax 刷新
        //   （y = 下沿 -32 + 半盒 8 → 底边正好压住框内沿；之前 +2 时出框 6px）
        if (!r.lvLb || !r.lvLb.isValid) {
            r.lvLb = label(r.root, '', L.tier.x - tierBgN / 2 + 3, L.tier.y - tierBgN / 2 + 8, 44, 16, {
                size: 14, color: '#7A4210', hAlign: 'left', anchorX: 0, overflow: 'shrink',
            });
            r.lvLb.node.name = 'lvLb';
        }
        r.lvLb.node.active = lvMax > 0;
        const lvTxt = lv + '/' + lvMax;
        if (r.lvLb.string !== lvTxt) { r.lvLb.string = lvTxt; }   // ★ 第四十三轮：同上，先比对
    }
    // 词条角标（跨在底板右下角）
    if (r.badgeSp && r.badgeSp.isValid) {
        r.badgeSp.node.active = !!bd;
        if (bd) { setFrameH(r.badgeSp, bd, L.badge.h); }
    }
    // ★ 名称栏的瓶阶小图标（第二十一轮）：有 nameIcon 就亮图标，并把名字右移、收窄
    //   ⚠️ label 节点存的是**栅格化尺寸**（UIKit.label：盒子 ×TEXT_SS 再缩回 TEXT_SCALE），
    //      所以这里 contentSize 必须乘 TEXT_SS，否则文字盒只剩一半 → SHRINK 压成蚂蚁字。
    const ni = spec.nameIcon;
    if (r.nameIc && r.nameIc.isValid) {
        r.nameIc.node.active = !!ni;
        if (ni) { setFrameH(r.nameIc, ni, L.nameIc.h); }
    }
    // 名称 / 说明两行的左缘与宽度**一起**切（★ 第八十轮：值全部来自 prefab 快照）。
    //   ⚠️ 快照里存的是**栅格化尺寸**（UIKit.label：盒子 ×TEXT_SS 再缩回 TEXT_SCALE），
    //      所以直接赋给 contentSize 即可，**不要**再乘一次 TEXT_SS（会缩成蚂蚁字）。
    const tx2 = L.name.x;
    const tw2 = L.name.w;
    const nUT = r.name.node.getComponent('cc.UITransform') as any;
    nUT.setContentSize(tw2, L.name.h);
    const sUT = r.sub.node.getComponent('cc.UITransform') as any;
    sUT.setContentSize(tw2, L.sub.h);
    // ★ 第四十三轮：文本**先比对再写** —— 底栏面板每 0.25s 会对整块列表 applyRow 一次，
    //   无条件写 string 会让系统字体 Label 每次都重排 + 重绘 canvas + 上传纹理
    //   （实测 3 秒内 name/sub/lvLb/btnLb 各被写 100+ 次，是「生成瓶盖时掉帧」的主源之一）。
    if (r.name.string !== spec.name) { r.name.string = spec.name; }
    if (r.sub.string !== spec.sub) { r.sub.string = spec.sub; }
    if (r.btnLb.string !== spec.label) { r.btnLb.string = spec.label; }
    // ★ 名字美术字（wzi，第三十五轮）：有 nameImg 就显示图、隐藏文本；
    //   宽度按图片比例 contain 到 24 高，左缘与文本栏对齐（锚点 0.5 → x = 左缘 + 宽/2）。
    if (!r.nameImg || !r.nameImg.isValid) {
        const n = nd(r.root, 'nameImg', 60, NAME_IMG_H, 0, L.name.y);
        n.active = false;
        r.nameImg = setFrame(n.addComponent(Sprite), 'bottle/name_0', 60, NAME_IMG_H);
    }
    r.nameImg.node.active = !!spec.nameImg;
    if (spec.nameImg) {
        setFrame(r.nameImg, spec.nameImg, 60, NAME_IMG_H);
        // ★ 扁长美术字按**高度**定标（setFrameH 是方形 contain，会把 105×31 的字压成竖条）；
        //   ⚠️ 尺寸必须读 sf.originalSize —— 开了 packable 的小图会进动态图集，
        //   sf.width/height 返回图集尺寸 2048×2048（实测踩过），originalSize 才是原图尺寸。
        const osz = r.nameImg.spriteFrame ? r.nameImg.spriteFrame.originalSize : null;
        const ow = osz ? osz.width : 60, oh = osz ? osz.height : NAME_IMG_H;
        const k = oh > 0 ? NAME_IMG_H / oh : 1;
        const w = Math.round(ow * k);
        (r.nameImg.node.getComponent('cc.UITransform') as any).setContentSize(w, NAME_IMG_H);
        r.nameImg.node.setPosition(tx2 + w / 2 + 2, L.name.y, 0);
    }
    r.name.node.active = !spec.nameImg;
    // ★ 第三十九轮：价格区的**底框停用**（整格即按钮，价格只是浮在行底框上的标签）。
    //   组件与节点原样保留（手写 prefab 最忌删组件/重排数组下标），只把它 disabled。
    if (r.btnSp && r.btnSp.isValid) { r.btnSp.enabled = false; }
    tint(r.btnLb, TONE[spec.tone].fg);

    // ★ 货币图标（第二十轮）：有 cur 才亮，数字栏随之在「图右」/「铺满」两种布局间切。
    //   ⚠️ label 节点的基准缩放是 TEXT_SCALE(1/TEXT_SS)、节点尺寸存的是**栅格化尺寸**
    //      （见 UIKit.label：盒子和 fontSize 都 ×SS 再缩回），所以这里 contentSize 必须
    //      乘 TEXT_SS，否则文字盒会缩一半 → SHRINK 把数字压成蚂蚁字。
    const cur = spec.cur;
    const lbNode = r.btnLb.node;
    const lbUT = lbNode.getComponent('cc.UITransform') as any;
    const lbH = L.btnLb.h;
    // 右上角挂了摄像机角标 → 数字整体往左让 12px，两者不打架
    // （基准 x/y 来自 prefab：有货币图标时用 btnLb 的位置；没有图标时居中于按钮 = x 0）
    const tx = (cur ? L.btnLb.x : 0) - (spec.ad ? 12 : 0);
    const tw = cur ? L.btnLb.w : (L.btn.w - 10) * TEXT_SS;
    lbNode.setPosition(tx, L.btnLb.y, 0);
    lbUT.setContentSize(tw, lbH);
    if (r.curSp && r.curSp.isValid) {
        r.curSp.node.active = !!cur;
        if (cur) { setFrameH(r.curSp, cur === 'cap' ? 'bottle/capchip_6' : 'ui/icon/coin', CUR_ICON_H); }
    }

    // ★ 广告出路：亮右上角 ksp 图标（价格照常显示，不再被清空）。
    //   尺寸按贴图原始宽高比 contain 进 AD_ICON 盒（ksp 原图 46×36，别拉成正方形）
    const ad = !!spec.ad;
    if (r.adSp && r.adSp.isValid) {
        r.adSp.node.active = ad;
        if (ad) {
            r.adSp.color = new Color().fromHEX(TONE[spec.tone].fg);
            setFrameH(r.adSp, 'ui/icon/ksp', AD_ICON);
        }
    }
    if (r.newTag && r.newTag.isValid) {
        // 位置由 prefab 决定（第八十轮）；这里只管亮灭：新出现且没点过才挂角标
        r.newTag.active = !!spec.id && !G.itemSeen(spec.id);
    }
}

/** 格子图标统一高度；瓶身贴图（bottle/body_*）按 150×375 的瘦高比等比缩宽（icon_* 切图已删） */
export function iconW(path: string, h: number): number {
    return path.indexOf('bottle/body_') === 0 ? Math.round(h * 0.4) : h;
}

/** 左对齐小字（名字/说明共用，省得每处都写一堆参数） */
function label2(parent: Node, x: number, y: number, w: number, h: number, size: number, color: string): Label {
    return label(parent, '', x, y, w, h, {
        size, color, hAlign: 'left', anchorX: 0, overflow: 'shrink',
    });
}

/* ------------------------------------------------------------------ *
 *  短文案（★ 第十九轮：列表行的名字与说明）
 * ------------------------------------------------------------------ */

/**
 * 列表行里的**短阶名**（底栏格子名称栏只有 176px 宽，全名「红宝石烈酒瓶」6 字 × 26px = 156，
 * 再挂上词条名就必然被 SHRINK 压小 —— 所以行内一律用 2 字短名）。
 *
 * ★ 第二十一轮起，行内的阶名前缀改用**瓶身图标**（见 `RowSpec.nameIcon`），
 *   这个函数目前没有调用点，保留备用（需要文字阶名的场合直接用它，别写死字符串）。
 */
export function tierShortName(tier: number): string {
    const arr = G.lang === 'zh' ? TIER_SHORT_ZH : TIER_SHORT_EN;
    return arr[tier] ?? ('T' + (tier + 1));
}

/** 数字：小值保留两位，≥1000 取整（列表里不做 K/M 缩写，方便直接比较大小） */
function num(v: number): string {
    if (!isFinite(v)) { return '∞'; }
    if (Math.abs(v) >= 1000) { return String(Math.round(v)); }
    return String(Math.round(v * 100) / 100);
}
/** 带符号（0 不带符号，负数自然带 −） */
function sgn(v: number): string { return (v > 0 ? '+' : '') + num(v); }
function money(v: number): string { return (v < 0 ? '-$' : '+$') + num(Math.abs(v)); }

/**
 * 单瓶词条的**紧凑说明**（`当前 → 下一级`）。
 *
 * ★ 用户口径（第十九轮）：「解析文字进行缩减」—— 原来一句「单次成功翻转基础收益 $+0 → $+1（每级 +1）」
 *   26 个字塞进 176px 的格子，会被 Label 的 SHRINK 压到 7px 以下（根本看不清）。
 *   现在只留两个数，语义交给上一行的名字 + 左侧图标。
 */
export function statSub(d: BottleStatDef, tier: number): string {
    if (d.once) { return t(d.desc, G.lang); }          // 悬停翻转是一次性解锁：说明就是全部信息
    const p = d.tiers[Math.min(tier, d.tiers.length - 1)];
    const lv = G.statLv(tier, d.id);
    // ★ 第十七轮：精通显示的是**总成功率**（50% → 55% … 满级 100%），不是「+5%」的增量
    if (d.id === 'mastery') {
        const pct = (v: number) => Math.round(v * 100) + '%';
        if (G.masteryMaxed(tier)) { return pct(G.successChance(tier, lv)); }
        return pct(G.successChance(tier, lv)) + ' → ' + pct(G.successChance(tier, lv + 1));
    }
    const cur = lv * p.step;
    const next = (lv + 1) * p.step;
    const f = (v: number): string => {
        if (d.id === 'income' || d.id === 'capincome') { return money(v); }
        if (d.unit === 'percent') { return sgn(v * 100) + '%'; }
        if (d.unit === 'mult') { return '×' + num(1 + v); }
        return sgn(v);
    };
    return f(cur) + ' → ' + f(next);
}

/**
 * 科技节点的**紧凑说明**。
 * 解锁型（unlock）保留一句极短的文案（见 Locale 里各 *_d 的注释）；
 * 数值型一律 `当前 → 下一级`。
 *
 * ⚠️ `p_sizelimit` / `h_limit` 的效果是按**等级**算的（`skLv × 5`），
 *    而 `sk()` 返回的是 `base + lv × step` —— 直接用 sk() 显示会多报一级，
 *    所以这两个走 `lv × step`。
 */
export function skillSub(d: SkillDef): string {
    if (d.unit === 'unlock') { return skillDesc(d); }
    const lvScaled = d.id === 'p_sizelimit' || d.id === 'h_limit';
    const lv = G.skLv(d.id);
    const cur = lvScaled ? lv * d.step : d.base + lv * d.step;
    const next = lvScaled ? (lv + 1) * d.step : d.base + (lv + 1) * d.step;
    const f = (v: number): string => {
        if (d.unit === 'percent') { return sgn(v * 100) + '%'; }
        if (d.unit === 'mult' || d.unit === 'size') { return '×' + num(v); }
        if (d.unit === 'seconds') { return num(v) + 's'; }
        if (d.unit === 'px') { return num(v) + 'px'; }
        return sgn(v);
    };
    return f(cur) + ' → ' + f(next);
}

/* ------------------------------------------------------------------ *
 *  长文案（技能树节点卡的详细说明 / 统计页等仍然在用）
 * ------------------------------------------------------------------ */

/**
 * 科技树节点描述（GDD §5.1）
 * 一级数值 = base + L×step；展示按 unit 分档：
 *   percent → ×100 的百分数   count → 取整   mult → 乘数（{v} 另给「下一级的加成百分比」）
 *   px / seconds / flat → 原值
 */
export function skillDesc(d: { id: string; desc: string; unit: string; base: number; step: number }): string {
    const lv = G.skLv(d.id);
    const cur = d.base + lv * d.step;
    const next = d.base + (lv + 1) * d.step;
    const S = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString());
    const F = (v: number) => (d.unit === 'percent' ? S(v * 100) : d.unit === 'count' ? S(Math.floor(v)) : S(v));
    return t(d.desc, G.lang)
        .replace('{cur}', F(cur))
        .replace('{next}', F(next))
        .replace('{v}', d.unit === 'mult' ? S((next - 1) * 100) : F(cur))
        .replace('{d}', F(Math.abs(d.step)))
        .replace('{cd}', G.cokeCooldown.toFixed(0))
        .replace('{n}', String(G.berserkNeed));
}

/**
 * 单瓶词条描述（§4.2 真实矩阵）
 * 效果值 = 等级 × 每级增量；unit 决定展示方式：
 *   percent → +{cur}%   mult → ×{cur}   count/flat → +{cur}   unlock → 纯文案
 */
export function statDesc(d: BottleStatDef, tier: number): string {
    if (d.once) { return t(d.desc, G.lang); }
    const p = d.tiers[Math.min(tier, d.tiers.length - 1)];
    const lv = G.statLv(tier, d.id);
    // ★ 第十七轮：精通的模板用 {tot}/{nexttot} 输出**总成功率**（50 → 55 … 100），不是增量
    if (d.id === 'mastery') {
        return t(d.desc, G.lang)
            .replace('{tot}', String(Math.round(G.successChance(tier, lv) * 100)))
            .replace('{nexttot}', String(Math.round(G.successChance(tier, lv + 1) * 100)));
    }
    const cur = lv * p.step;
    const next = (lv + 1) * p.step;
    const S = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString());
    let body = t(d.desc, G.lang);
    if (d.unit === 'percent') {
        body = body.replace('{cur}', S(cur * 100)).replace('{next}', S(next * 100)).replace('{d}', S(p.step * 100));
    } else if (d.unit === 'mult') {
        body = body.replace('{cur}', S(1 + cur)).replace('{next}', S(1 + next)).replace('{d}', S(p.step));
    } else {
        body = body.replace('{cur}', S(cur)).replace('{next}', S(next)).replace('{d}', S(p.step));
    }
    return body;
}

/* ★ 第九十轮：`successText()`（「成功 50%」）已删 —— 商店瓶子行的说明改为一句「增加一个瓶子」，
 *   成功率不再挂在行内（要恢复的话从 git 历史取回，接回 BottomPanel.shopBottleRows 即可）。 */

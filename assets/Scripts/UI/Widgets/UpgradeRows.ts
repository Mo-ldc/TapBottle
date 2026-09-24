import { Color, Graphics, Label, Node, Sprite } from 'cc';
import { BottleStatDef, SkillDef, TIER_SHORT_EN, TIER_SHORT_ZH } from '../../Core/GameConfig';
import { G } from '../../Core/State';
import { hex } from '../../Core/Util';
import { Res } from '../../Core/Res';
import { t } from '../../Core/Locale';
import { TEXT_SS, label, nd, roundedPanel, setFrame, sliced, tint } from '../Base/UIKit';
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
 */

/** 网格参数（BottomPanel 按这个排 content）—— 尺寸保持不变 */
export const COLS = 2;
export const CELL_W = 322;
export const CELL_H = 78;
export const GAP_X = 14;
export const GAP_Y = 10;

/* ---- 格子内部排版（一次算好，别再散落魔数） ---- */
const ICON_H = 46;          // 图标高度（瓶身贴图按 0.4 瘦高比缩宽，见 iconW）
const ICON_X = -136;        // 图标/底板中心（底板左缘 -159，距格子左缘 2px）
/** 图标中心 y：下移 6px，给左上角的「新」角标让出顶部空间（瓶口只被盖 ~4px） */
const ICON_Y = -6;
const TEXT_X = -112;        // 名称/说明的左缘（左对齐锚点）
const TEXT_W = 172;         // 文字栏宽度（18 → 26 号字之后，能容纳 ~6 个汉字）
const NAME_Y = 17, NAME_H = 30, NAME_SIZE = 26;
const SUB_Y = -18, SUB_H = 24, SUB_SIZE = 19;
const BTN_W = 92, BTN_H = 52, BTN_X = 111, BTN_SIZE = 20;

/* ---- 名称栏的「瓶阶图标 + 词条名」（★ 用户口径 · 第二十一轮）----
 * 「普通·收益」里的「普通」两个字改成**对应瓶子的贴图**（同比例缩放：瓶身 canvas 是
 * 159×397 ≈ 0.4 的瘦高比，见 iconW），文字整体右移、宽度相应收窄。
 * 高度取 28（= NAME_H 30 内缩 1），实宽约 11px —— 瓶身本来就细，这正是原图的形状。 */
const NAME_ICON_H = 28;
/** 瓶阶图标中心 x（贴名称栏左缘，图标宽的一半约 6px） */
const NAME_IC_X = -106;
/** 有瓶阶图标 / 稀有度底板时：名字与说明整体右移、文字栏收窄（给左侧图形让位） */
const NAME_TEXT_X = -106, NAME_TEXT_W = 166;

/* ---- 瓶阶词条行的「稀有度底板 + 瓶身 + 词条角标」（★ 用户口径 · 第二十一轮）----
 * 左侧大图标不再是词条图标（收益 $ 等），改成**对应瓶子 + 稀有度色圆角底板**，
 * 词条图标缩小成角标**跨在底板右下角**（对照用户给的参考图）。
 * 节点顺序即渲染序：底板（先建）→ 瓶身 → 角标（后建、画在最上）。 */
const TIER_BG = 46;         // 底板边长（格子左缘 -161，左留 2px）
const TIER_BG_R = 11;       // 底板圆角
const TIER_BOTTLE_H = 40;   // 底板里瓶身的显示高度（≈87%，留边）
const BADGE_ICON = 18;      // 词条角标边长
/** 角标中心：贴底板右下角内侧（右缘 -111，与文字左缘 -106 留 5px） */
const BADGE_X = -120, BADGE_Y = -24;
/** 有底板/阶图标时名字与说明的左缘右移（底板右缘 -113，留 7px 起字） */
const NAME_SHIFT_X = -106, NAME_SHIFT_W = 166;

/* ---- 价格按钮内部的「货币图标 + 数字」排布（★ 第二十轮） ----
 * 用户口径（第二十轮复盘）：图标和数字要**拉开** —— 原来间隙只有 4px，
 * 长数字（1.00K / 10.0K）会被 SHRINK 压到贴着图标，看起来就像图标压住数字。 */
/** 货币图标高度（金币 `ui/coin` 1:1 / 瓶盖 `bottle/capchip_6` 1.14:1，按比例 contain） */
const CUR_ICON_H = 22;
/** 图标中心（按钮本地坐标：贴左缘内缩 13 → 右缘落在 -22，与数字栏留 ~10px 间隙） */
const CUR_ICON_X = -BTN_W / 2 + 13;
/** 有图标时数字栏：右移给图标让位，间隙 ≥10px */
const CUR_TEXT_X = 13, CUR_TEXT_W = 50;
/** 没有货币的行（MAX / 解锁 / —）：数字栏铺满按钮 */
const PLAIN_TEXT_X = 0, PLAIN_TEXT_W = BTN_W - 10;

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

/** 按钮四态皮肤：可买 / 买不起 / 满级 / 前置未解锁 */
export type Tone = 'on' | 'off' | 'max' | 'lock';
const TONE: Record<Tone, { bg: string; fg: string }> = {
    on:   { bg: '#F2C34E', fg: '#7A4210' },
    off:  { bg: '#8A4A2A', fg: '#E8BDB4' },
    max:  { bg: '#4E7A3C', fg: '#CFF0C0' },
    lock: { bg: '#4A3420', fg: '#A89880' },
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
     * 点按钮：`after()` 由调用方用来刷整块列表。
     * `btn` 是**被点的那枚价格按钮节点**（买瓶飞入要拿它的世界坐标当起飞点）。
     */
    onBuy: (after: () => void, btn?: Node) => void;
}

export interface RowUI {
    root: Node;
    /** 瓶阶词条行的稀有度色圆角底板（`spec.badge` 为空时隐藏；画在瓶身**下面**） */
    tierBg: Node;
    icon: Sprite;
    /** 底板右下角的词条小角标（收益 $ 等，画在瓶身**上面**） */
    badgeSp: Sprite;
    /** 名称栏左侧的瓶阶小图标（`spec.nameIcon` 为空时隐藏） */
    nameIc: Sprite;
    name: Label;
    sub: Label;
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

export function makeCell(parent: Node, x: number, y: number, spec: RowSpec, onRefresh?: () => void): RowUI {
    const root = nd(parent, 'cell', CELL_W, CELL_H, x, y);

    // 卡片底（暗巧克力 + 深色描边）：先描边再底，描边露出一圈
    const st = sliced(root, 'ui/panel/card_white', CELL_W + 6, CELL_H + 6, 0, 0, [24, 24, 24, 24], '#3A1C08', 'stroke');
    const bg = sliced(root, 'ui/panel/card_white', CELL_W, CELL_H, 0, 0, [24, 24, 24, 24], '#5C2E12', 'bg');
    void st; void bg;

    // ★ 瓶阶词条行的稀有度底板（★ 画在瓶身**下面** —— 兄弟序=渲染序，必须先建；非词条行隐藏）
    const tierBg = nd(root, 'tierBg', TIER_BG, TIER_BG, ICON_X, ICON_Y);
    tierBg.active = false;
    tierBg.addComponent(Graphics);

    // ★ 用户口径（第十五轮）：瓶阶图标直接用 body_N 同比例缩小（瘦高比 0.4），icon_* 切图已删除
    const iw0 = iconW(spec.icon, ICON_H);
    const icNode = nd(root, 'ic', iw0, ICON_H, ICON_X, ICON_Y);
    const icon = setFrame(icNode.addComponent(Sprite), spec.icon, iw0, ICON_H);

    // ★ 词条小角标（跨在底板右下角、画在瓶身**上面**；非词条行隐藏）
    const bdNode = nd(root, 'badgeIc', BADGE_ICON, BADGE_ICON, BADGE_X, BADGE_Y);
    bdNode.active = false;
    const badgeSp = setFrame(bdNode.addComponent(Sprite), 'stat/income', BADGE_ICON, BADGE_ICON);

    // ★ 名称栏最左的瓶阶小图标（第二十一轮）：瓶阶词条行用它替代「普通·」这类前缀文字
    const niW = iconW('bottle/body_0', NAME_ICON_H);
    const niNode = nd(root, 'nameIc', niW, NAME_ICON_H, NAME_IC_X, NAME_Y);
    niNode.active = false;
    const nameIc = setFrame(niNode.addComponent(Sprite), 'bottle/body_0', niW, NAME_ICON_H);

    const name = label2(root, TEXT_X, NAME_Y, TEXT_W, NAME_H, NAME_SIZE, '#FFF3D0');
    const sub = label2(root, TEXT_X, SUB_Y, TEXT_W, SUB_H, SUB_SIZE, '#D9C4A6');

    // 价格按钮：宽 92，右沿 157（格子右半 161 → 留 4px）
    const btn = sliced(root, 'ui/panel/card_white', BTN_W, BTN_H, BTN_X, 0, [24, 24, 24, 24], TONE[spec.tone].bg, 'btn').node;
    // 价格按钮的文字**居中**于「图标右侧的剩余空间」：不能用左对齐的 label2
    // （锚点在左会让字整体偏右）。默认按「有货币图标」布局建，applyRow 按 spec.cur 再切。
    const btnLb = label(btn, '', CUR_TEXT_X, 1, CUR_TEXT_W, BTN_H - 12, {
        size: BTN_SIZE, color: TONE[spec.tone].fg, overflow: 'shrink',
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

    const ui: RowUI = { root, tierBg, icon, badgeSp, nameIc, name, sub, btn, btnSp: btn.getComponent(Sprite)!, btnLb, curSp, adSp, newTag: null!, spec };

    // ★ 右上角「新」角标（用户口径：新出现的可买/可研发项要标出来，点过即消）
    //   有广告角标时会被挤到左边（见 applyRow）；同样挂 btn 下（见 AD_X 注释）
    const tag = nd(btn, 'newTag', 46, 24, NEW_X, NEW_Y);
    roundedPanel(tag, 46, 24, 0, 0, '#E8556D', 9, '#7A1E33', 2, 'bg');
    label(tag, t('tag_new', G.lang), 0, 1, 42, 20, { size: 16, color: '#FFF3D0', overflow: 'shrink' });
    ui.newTag = tag;

    btn.on(Node.EventType.TOUCH_START, () => { btn.setScale(0.94, 0.94, 1); });
    btn.on(Node.EventType.TOUCH_CANCEL, () => { btn.setScale(1, 1, 1); });
    btn.on(Node.EventType.TOUCH_END, () => {
        btn.setScale(1, 1, 1);
        // ★ 用户口径（第二十轮）：列表里的**选项**统一点击音效（与底栏/弹窗按钮同款 click）
        if (Res.I) { Res.I.play('click', 0.7); }
        // ★ 用户口径（第十七轮）：点列表里的选项，整张卡片也左右晃一下（和底栏页签同款反馈）
        wobble(root);
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
        }, btn);
    });
    applyRow(ui, spec);
    return ui;
}

/** 换贴图并按原始宽高比 contain 到指定高度（币图标用：金币是方图、瓶盖是扁图） */
function setFrameH(sp: Sprite, path: string, h: number) {
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
    // ★ 瓶阶词条行（第二十一轮）：瓶身缩进稀有度底板里（42 高），普通行维持 46
    const bd = spec.badge;
    const ih = bd ? TIER_BOTTLE_H : ICON_H;
    const iw = iconW(spec.icon, ih);
    (r.icon.node.getComponent('cc.UITransform') as any).setContentSize(iw, ih);
    setFrame(r.icon, spec.icon, iw, ih);
    // 底板：Graphics **改色必须 clear + 重描**（就地改引用不触发重绘，见 MEMORY 口径）
    if (r.tierBg && r.tierBg.isValid) {
        r.tierBg.active = !!bd;
        if (bd) {
            const g = r.tierBg.getComponent(Graphics)!;
            g.clear();
            g.fillColor = hex(spec.badgeBg || '#FFFFFF');
            g.roundRect(-TIER_BG / 2, -TIER_BG / 2, TIER_BG, TIER_BG, TIER_BG_R);
            g.fill();
            g.lineWidth = 2;
            g.strokeColor = hex('#3A1C08');
            g.roundRect(-TIER_BG / 2, -TIER_BG / 2, TIER_BG, TIER_BG, TIER_BG_R);
            g.stroke();
        }
    }
    // 词条角标（跨在底板右下角）
    if (r.badgeSp && r.badgeSp.isValid) {
        r.badgeSp.node.active = !!bd;
        if (bd) { setFrameH(r.badgeSp, bd, BADGE_ICON); }
    }
    // ★ 名称栏的瓶阶小图标（第二十一轮）：有 nameIcon 就亮图标，并把名字右移、收窄
    //   ⚠️ label 节点存的是**栅格化尺寸**（UIKit.label：盒子 ×TEXT_SS 再缩回 TEXT_SCALE），
    //      所以这里 contentSize 必须乘 TEXT_SS，否则文字盒只剩一半 → SHRINK 压成蚂蚁字。
    const ni = spec.nameIcon;
    if (r.nameIc && r.nameIc.isValid) {
        r.nameIc.node.active = !!ni;
        if (ni) { setFrameH(r.nameIc, ni, NAME_ICON_H); }
    }
    // 名称 / 说明两行的左缘与宽度**一起**切：有瓶阶底板/小图标时整体右移收窄，两行始终对齐。
    // 右缘保持不动（60 = 价格按钮左缘 65 内缩 5），只是文字不能伸到底板/角标底下。
    const shift = !!bd || !!ni;
    const tx2 = shift ? NAME_TEXT_X : TEXT_X;
    const tw2 = (shift ? NAME_TEXT_W : TEXT_W) * TEXT_SS;
    const nUT = r.name.node.getComponent('cc.UITransform') as any;
    r.name.node.setPosition(tx2, NAME_Y, 0);
    nUT.setContentSize(tw2, NAME_H * TEXT_SS);
    const sUT = r.sub.node.getComponent('cc.UITransform') as any;
    r.sub.node.setPosition(tx2, SUB_Y, 0);
    sUT.setContentSize(tw2, SUB_H * TEXT_SS);
    r.name.string = spec.name;
    r.sub.string = spec.sub;
    r.btnLb.string = spec.label;
    tint(r.btnSp, TONE[spec.tone].bg);
    tint(r.btnLb, TONE[spec.tone].fg);

    // ★ 货币图标（第二十轮）：有 cur 才亮，数字栏随之在「图右」/「铺满」两种布局间切。
    //   ⚠️ label 节点的基准缩放是 TEXT_SCALE(1/TEXT_SS)、节点尺寸存的是**栅格化尺寸**
    //      （见 UIKit.label：盒子和 fontSize 都 ×SS 再缩回），所以这里 contentSize 必须
    //      乘 TEXT_SS，否则文字盒会缩一半 → SHRINK 把数字压成蚂蚁字。
    const cur = spec.cur;
    const lbNode = r.btnLb.node;
    const lbUT = lbNode.getComponent('cc.UITransform') as any;
    const lbH = (BTN_H - 12) * TEXT_SS;
    // 右上角挂了摄像机角标 → 数字整体往左让 12px，两者不打架
    const tx = (cur ? CUR_TEXT_X : PLAIN_TEXT_X) - (spec.ad ? 12 : 0);
    const tw = cur ? CUR_TEXT_W : PLAIN_TEXT_W;
    lbNode.setPosition(tx, 1, 0);
    lbUT.setContentSize(tw * TEXT_SS, lbH);
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
        // 广告角标占了右上角 → 「新」角标往左让位，两枚不叠在一起
        r.newTag.setPosition(NEW_X, NEW_Y, 0);
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

/**
 * 该阶当前「成功树立概率」文案（纯概率判定，第十七轮口径）。
 * 商店里每阶瓶子挂一行，玩家一眼能看到买它 / 升精通值不值。
 */
export function successText(tier: number): string {
    const pct = Math.round(G.successChance(tier) * 100);
    return (G.lang === 'zh' ? '成功 ' : 'OK ') + pct + '%';
}

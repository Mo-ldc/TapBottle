import { Color, Label, Node, Sprite } from 'cc';
import { BottleStatDef } from '../Core/GameConfig';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { label, nd, roundedPanel, setFrame, sliced, tint } from './UIKit';
import { wobble } from './Theme';

/**
 * 内嵌面板里的**一格**选项卡（参考图：左边图标 + 名称/说明，右边一枚价格按钮）。
 *
 * ★ 用户要求「一行 2 个」→ 面板列表改成两列网格：
 *   面板内容宽 664 → 一格 322、列距 14、行距 10；一屏正好两行，滚动翻页。
 *   格子比原来的整行窄一半，所以图标/字号整体缩一档，说明文字用 SHRINK 自动压缩。
 */

/** 网格参数（BottomPanel 按这个排 content） */
export const COLS = 2;
export const CELL_W = 322;
export const CELL_H = 78;
export const GAP_X = 14;
export const GAP_Y = 10;

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
    sub: string;
    /** 按钮文案（`$120` / `C 1.6K` / `解锁` / `MAX` / `未解锁`） */
    label: string;
    tone: Tone;
    /**
     * ★ 金币不足但有广告出路 → 价格按钮不显示金币文案，改亮 ksp 广告视频图标
     *   （点击仍走原 onBuy → moneyShortAd 看广告补足流程）
     */
    ad?: boolean;
    /**
     * 点按钮：`after()` 由调用方用来刷整块列表。
     * `btn` 是**被点的那枚价格按钮节点**（买瓶飞入要拿它的世界坐标当起飞点）。
     */
    onBuy: (after: () => void, btn?: Node) => void;
}

export interface RowUI {
    root: Node;
    icon: Sprite;
    name: Label;
    sub: Label;
    btn: Node;
    btnSp: Sprite;
    btnLb: Label;
    /** 金币不足时的 ksp 广告图标（默认隐藏，applyRow 按 spec.ad 切换） */
    adSp: Sprite;
    /** 右上角「新」角标 */
    newTag: Node;
    spec: RowSpec;
}

export function makeCell(parent: Node, x: number, y: number, spec: RowSpec, onRefresh?: () => void): RowUI {
    const root = nd(parent, 'cell', CELL_W, CELL_H, x, y);

    // 卡片底（暗巧克力 + 深色描边）：先描边再底，描边露出一圈
    const st = sliced(root, 'ui/card_white', CELL_W + 6, CELL_H + 6, 0, 0, [24, 24, 24, 24], '#3A1C08', 'stroke');
    const bg = sliced(root, 'ui/card_white', CELL_W, CELL_H, 0, 0, [24, 24, 24, 24], '#5C2E12', 'bg');
    void st; void bg;

    // ★ 用户口径（第十五轮）：瓶阶图标直接用 body_N 同比例缩小（瘦高比 0.4），icon_* 切图已删除
    const iw0 = iconW(spec.icon, ICON_H);
    const icNode = nd(root, 'ic', iw0, ICON_H, -132, 0);
    const icon = setFrame(icNode.addComponent(Sprite), spec.icon, iw0, ICON_H);

    const name = label2(root, -104, 16, 150, 24, 18, '#FFF3D0');
    const sub = label2(root, -104, -17, 154, 20, 12, '#D9C4A6');

    // 价格按钮：宽 96，右沿 153（格子右半 161 → 留 8px）
    const btn = sliced(root, 'ui/card_white', 96, 48, 105, 0, [24, 24, 24, 24], TONE[spec.tone].bg, 'btn').node;
    // 价格按钮的文字**居中**：不能用左对齐的 label2（锚点在左会让字整体偏右）
    const btnLb = label(btn, '', 0, 1, 86, 30, {
        size: 16, color: TONE[spec.tone].fg, overflow: 'shrink',
    });

    // ★ 金币不足 → 广告图标（ksp 摄像机贴图）盖住价格文字；默认隐藏
    const adNode = nd(btn, 'adIcon', 40, 40, 0, 1);
    adNode.active = false;
    const adSp = setFrame(adNode.addComponent(Sprite), 'ui/ksp', 40, 40);

    const ui: RowUI = { root, icon, name, sub, btn, btnSp: btn.getComponent(Sprite)!, btnLb, adSp, newTag: null!, spec };

    // ★ 右上角「新」角标（用户口径：新出现的可买/可研发项要标出来，点过即消）
    //   尺寸压到 44×24 贴在卡片右上角内侧，不与价格按钮的文字打架
    const tag = nd(root, 'newTag', 44, 24, 136, 26);
    roundedPanel(tag, 44, 24, 0, 0, '#E8556D', 10, '#7A1E33', 2, 'bg');
    label(tag, t('tag_new', G.lang), 0, 1, 40, 20, { size: 14, color: '#FFF3D0', overflow: 'shrink' });
    ui.newTag = tag;

    btn.on(Node.EventType.TOUCH_START, () => { btn.setScale(0.94, 0.94, 1); });
    btn.on(Node.EventType.TOUCH_CANCEL, () => { btn.setScale(1, 1, 1); });
    btn.on(Node.EventType.TOUCH_END, () => {
        btn.setScale(1, 1, 1);
        // ★ 用户口径（第十七轮）：点列表里的选项，整张卡片也左右晃一下（和底栏页签同款反馈）
        wobble(root);
        // 点过就算「已读」：哪怕这次买不起，玩家也已经注意到它了（红点别一直挂着）
        if (ui.spec.id) { G.markItemSeen(ui.spec.id); }
        ui.spec.onBuy(() => { if (onRefresh) { onRefresh(); } }, btn);
    });
    applyRow(ui, spec);
    return ui;
}

/** 只改文本与颜色（不换节点） */
export function applyRow(r: RowUI, spec: RowSpec) {
    r.spec = spec;
    const iw = iconW(spec.icon, ICON_H);
    (r.icon.node.getComponent('cc.UITransform') as any).setContentSize(iw, ICON_H);
    setFrame(r.icon, spec.icon, iw, ICON_H);
    r.name.string = spec.name;
    r.sub.string = spec.sub;
    r.btnLb.string = spec.label;
    tint(r.btnSp, TONE[spec.tone].bg);
    tint(r.btnLb, TONE[spec.tone].fg);
    // ★ 广告出路：藏价格文字、亮 ksp 图标（颜色跟着按钮态走，买不起=压暗）
    //   尺寸按贴图原始宽高比 contain 进 40×40 盒（ksp 原图 46×36，别拉成正方形）
    const ad = !!spec.ad;
    if (r.adSp && r.adSp.isValid) {
        r.adSp.node.active = ad;
        if (ad) {
            r.btnLb.string = '';
            r.adSp.color = new Color().fromHEX(TONE[spec.tone].fg);
            const sf = r.adSp.spriteFrame;
            if (sf && sf.width > 0 && sf.height > 0) {
                const k = Math.min(40 / sf.width, 40 / sf.height);
                (r.adSp.node.getComponent('cc.UITransform') as any).setContentSize(Math.round(sf.width * k), Math.round(sf.height * k));
            }
        }
    }
    if (r.newTag && r.newTag.isValid) { r.newTag.active = !!spec.id && !G.itemSeen(spec.id); }
}

/** 格子图标统一高度；瓶身贴图（bottle/body_*）按 150×375 的瘦高比等比缩宽（icon_* 切图已删） */
const ICON_H = 40;
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
 *  文案（原 DrawerContent 里的两个口径，随「抽屉」一起搬到这里）
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

/** 落地容差角文案（角度制判定，GDD §3.1-3） */
export function toleranceText(tier: number): string {
    return '±' + G.tierTolerance(tier).toFixed(0) + '°';
}

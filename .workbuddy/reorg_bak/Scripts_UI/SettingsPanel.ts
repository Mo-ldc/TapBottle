import { Node, tween, UIOpacity } from 'cc';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { Res } from '../Core/Res';
import { label, MASK_SIZE, nd, popIn, popOut, rect, roundedPanel, setSize } from './UIKit';
import { openPanel, rowCard } from './Panel';
import { WOOD, woodButton, woodPlateRefill } from './Theme';
import { clearSave } from '../Core/Save';

/** 危险操作按钮（删除存档）——木皮肤内的砖红，别再用旧皮肤的红玻璃贴图 */
const DANGER = '#C05B3C';

/** 设置面板 */
export function openSettings(parent: Node) {
    const p = openPanel(parent, 'settings', 860);
    const C = p.body;
    const RW = 620;
    let y = -12;

    const refreshers: Array<() => void> = [];

    // ---------------- 显示 ----------------
    y = section(C, y, 'display');
    y = toggle(C, y, 'hide_income', () => G.data.settings.hideIncome, v => { G.data.settings.hideIncome = v; }, refreshers, () => refreshAll());
    y = toggle(C, y, 'hide_caps', () => G.data.settings.hideCaps, v => { G.data.settings.hideCaps = v; }, refreshers, () => refreshAll());
    y = toggle(C, y, 'hide_hand', () => G.data.settings.hideHand, v => { G.data.settings.hideHand = v; }, refreshers, () => refreshAll());

    // ---------------- 音频 ----------------
    y -= 16;
    y = section(C, y, 'audio');
    y = stepper(C, y, 'master_volume', () => G.data.settings.master, v => { G.data.settings.master = v; applyVol(); }, refreshers, () => refreshAll());
    y = stepper(C, y, 'music_volume', () => G.data.settings.music, v => { G.data.settings.music = v; Res.I?.musicVolume(v); applyVol(); }, refreshers, () => refreshAll());
    y = stepper(C, y, 'sfx_volume', () => G.data.settings.sfx, v => { G.data.settings.sfx = v; applyVol(); Res.I?.play('click'); }, refreshers, () => refreshAll());

    // ---------------- 语言 ----------------
    y -= 16;
    y = section(C, y, 'language');
    {
        const langs: Array<{ id: 'zh' | 'en', name: string }> = [{ id: 'zh', name: '简体中文' }, { id: 'en', name: 'English' }];
        const card = rowCard(C, RW, 92, 0, y, '#5C4420');
        label(card, t('language', G.lang), -280, 0, 190, 50, { size: 26, color: '#F1E0C0', hAlign: 'left', anchorX: 0 });
        // 木质按钮：选中 = 金牌，未选 = 奶油牌（原来是旧皮肤白卡贴图，和木纹完全不搭）
        const btns: Array<{ id: 'zh' | 'en', node: Node }> = [];
        for (let i = 0; i < langs.length; i++) {
            const L = langs[i];
            const b = woodButton(card, {
                w: 150, h: 64, x: 66 + i * 162, y: 0,
                text: L.name, fontSize: 24, name: 'lang_' + L.id,
                onClick: () => { G.data.settings.lang = L.id; refreshAll(); },
            });
            btns.push({ id: L.id, node: b });
        }
        refreshers.push(() => {
            for (const b of btns) { woodPlateRefill(b.node, G.data.settings.lang === b.id ? WOOD.gold : WOOD.cream); }
        });
        y -= 104;
    }

    // ---------------- 数据 ----------------
    y -= 16;
    y = section(C, y, 'data');
    {
        const card = rowCard(C, RW, 108, 0, y, '#5C4420');
        const d = label(card, t('delete_game', G.lang), -280, 0, 380, 96, { size: 20, color: '#F1E0C0', hAlign: 'left', anchorX: 0, overflow: 'clamp' });
        d.lineHeight = 26;
        woodButton(card, {
            w: 168, h: 72, x: 196, y: 0, fill: DANGER,
            text: t('delete', G.lang), fontSize: 26, textColor: '#FFF6E0', name: 'del',
            onClick: () => confirmNewGame(p.frame),
        });
        y -= 120;
    }

    const ut = C.getComponent('cc.UITransform') as any;
    ut.setContentSize(RW, Math.abs(y) + 60);

    function refreshAll() { for (const r of refreshers) { r(); } }
    p.host.onRefresh = refreshAll;
    refreshAll();
    return p;
}

/* ---------------- 小控件 ---------------- */
/**
 * 分区标题。
 *
 * ⚠️ 颜色原来是 '#D8CDB8'（浅灰米色）——那是给深蓝底面板配的，
 * 换到奶油底（#F6E3C5）之后几乎是「白字白底」，实测对比度只有 1.3:1。
 * 这里用深棕 + 左侧一枚小木牌（与统计面板一致）。
 *
 * ⚠️ 返回值决定了下一行卡片的中心：卡片顶沿 = 返回值 + 行高/2。
 *   以前返回 y-56，88 高的卡片顶沿只到 y-12，正好把标题字形下半截盖住
 *   （标题渲染在卡片之前 → 被压在下面）。实测字形最低点接近 label 中心，
 *   所以标题和首行卡片之间至少要留 30px：返回 y-78（卡片顶沿 y-34）。
 */
function section(C: Node, y: number, key: string): number {
    roundedPanel(C, 12, 30, -300, y, '#8A5A20', 6, undefined, 0, 'secTick');
    label(C, t(key, G.lang), -284, y, 300, 40, { size: 28, color: '#7A4210', hAlign: 'left', anchorX: 0 });
    return y - 78;
}

function toggle(C: Node, y: number, key: string, get: () => boolean, set: (v: boolean) => void,
    refs: Array<() => void>, refresh: () => void): number {
    const card = rowCard(C, 620, 88, 0, y, '#5C4420');
    label(card, t(key, G.lang), -280, 0, 380, 50, { size: 26, color: '#F1E0C0', hAlign: 'left', anchorX: 0 });
    const track = roundedPanel(card, 110, 54, 240, 0, '#33240F', 27, '#1E1408', 3, 'track');
    // 圆角面板做钮，奶油色 + 金描边（纯白圆在深木上太跳）
    const knob = roundedPanel(track, 42, 42, 0, 0, WOOD.creamHi, 21, WOOD.goldDark, 3, 'knob');
    const setKnob = (on: boolean) => {
        knob.setPosition(on ? 27 : -27, 0, 0);
        // 开 = 亮金轨道 / 关 = 深木凹槽，一眼看出状态（原来开关同色，只能靠钮的位置猜）
        woodPlateRefill(track, on ? WOOD.gold : '#33240F');
    };
    const hit = rect(card, 150, 76, 240, 0, '#00000000', 'hit');
    hit.on(Node.EventType.TOUCH_END, () => { set(!get()); refresh(); });
    setKnob(get());
    refs.push(() => setKnob(get()));
    return y - 100;
}

/**
 * 音量步进行。
 *
 * ⚠️ 布局曾有三处重叠：①「+」按钮（240±34）压住百分比 label（200±60），
 *    「90%」只剩「90」；②进度条左端（-50 起）伸进名称文字区。
 *   现在从左到右一条线：名称(-280..-90) → 「-」(-74..-10) → 条(5..155) →
 *   值(右对齐至 212) → 「+」(222..286)，互不相交。
 */
function stepper(C: Node, y: number, key: string, get: () => number, set: (v: number) => void,
    refs: Array<() => void>, refresh: () => void): number {
    const card = rowCard(C, 620, 88, 0, y, '#5C4420');
    label(card, t(key, G.lang), -280, 0, 190, 50, { size: 26, color: '#F1E0C0', hAlign: 'left', anchorX: 0 });

    const step = (d: number) => { set(Math.max(0, Math.min(1, Math.round((get() + d) * 10) / 10))); refresh(); };
    woodButton(card, { w: 64, h: 64, x: -42, y: 0, text: '-', fontSize: 36, name: 'dec', onClick: () => step(-0.1) });

    const track = roundedPanel(card, 150, 16, 80, 0, '#33240F', 8, undefined, 0, 'track');
    void track;
    const fill = rect(card, 150, 10, 5, 0, WOOD.gold, 'fill');
    (fill.getComponent('cc.UITransform') as any).setAnchorPoint(0, 0.5);
    fill.setPosition(5, 0, 0);

    const val = label(card, '', 212, 0, 88, 50, { size: 26, color: '#FFD75E', hAlign: 'right', anchorX: 1 });

    woodButton(card, { w: 64, h: 64, x: 254, y: 0, text: '+', fontSize: 36, name: 'inc', onClick: () => step(0.1) });

    refs.push(() => {
        const v = get();
        val.string = Math.round(v * 100) + '%';
        setSize(fill, Math.max(4, 150 * v), 10);
    });
    return y - 100;
}

function applyVol() { refreshVol(); }
function refreshVol() {
    try { (globalThis as any).__tb_vol = G.data.settings.master; } catch (e) { /* ignore */ }
}

/** 删除确认小弹窗（木质皮肤：奶油取消键 + 砖红确认键） */
function confirmNewGame(parent: Node) {
    const root = nd(parent, 'confirm', MASK_SIZE.w, MASK_SIZE.h, 0, 0);
    const rootOp = root.addComponent(UIOpacity);
    rootOp.opacity = 0;
    rect(root, MASK_SIZE.w, MASK_SIZE.h, 0, 0, '#3A1E0CCC', 'm');
    const p = roundedPanel(root, 600, 380, 0, 0, '#4A3420', 26, WOOD.goldDark, 5);
    label(p, t('delete_confirm', G.lang), 0, 60, 520, 190, { size: 30, color: '#FFF6E0', overflow: 'clamp' });
    woodButton(p, {
        w: 220, h: 78, x: -140, y: -120,
        text: t('cancel', G.lang), fontSize: 28,
        onClick: () => {
            tween(rootOp).to(0.14, { opacity: 0 }).start();
            popOut(p, 0.14, () => root.destroy());
        },
    });
    woodButton(p, {
        w: 220, h: 78, x: 140, y: -120, fill: DANGER, textColor: '#FFF6E0',
        text: t('confirm', G.lang), fontSize: 28, name: 'confirmDel',
        onClick: () => {
            root.destroy();
            clearSave();
            G.reset();
            G.save();
            (globalThis as any).__tb_reload?.();
        },
    });
    tween(rootOp).to(0.15, { opacity: 255 }).start();
    popIn(p);
}

import { Node, Label, Sprite, tween, UIOpacity } from 'cc';
import { G } from '../Core/State';
import { t } from '../Core/Locale';
import { Res } from '../Core/Res';
import { button, img, label, MASK_SIZE, nd, popIn, popOut, rect, roundedPanel, setSize, tint } from './UIKit';
import { openPanel, rowCard } from './Panel';
import { clearSave } from '../Core/Save';

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
        const card = rowCard(C, RW, 92, 0, y, '#1D2636');
        label(card, t('language', G.lang), -280, 0, 300, 50, { size: 26, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
        const btns: Array<{ id: 'zh' | 'en', bg: Sprite }> = [];
        for (let i = 0; i < langs.length; i++) {
            const L = langs[i];
            const b = button(card, {
                w: 168, h: 68, x: 40 + i * 180, y: 0,
                tex: 'ui/card_white', inset: [24, 24, 24, 24], texColor: '#26324A',
                text: L.name, fontSize: 26, sound: 'click', name: 'lang_' + L.id,
                onClick: () => { G.data.settings.lang = L.id; refreshAll(); },
            });
            btns.push({ id: L.id, bg: b.getChildByName('bg')!.getComponent(Sprite)! });
        }
        refreshers.push(() => {
            for (const b of btns) { tint(b.bg, G.data.settings.lang === b.id ? '#C8A44A' : '#4C5A73'); }
        });
        y -= 104;
    }

    // ---------------- 数据 ----------------
    y -= 16;
    y = section(C, y, 'data');
    {
        const card = rowCard(C, RW, 108, 0, y, '#2A1F22');
        const d = label(card, t('delete_game', G.lang), -280, 0, 380, 96, { size: 20, color: '#E8A9A0', hAlign: 'left', anchorX: 0, overflow: 'clamp' });
        d.lineHeight = 26;
        button(card, {
            w: 168, h: 76, x: 196, y: 0,
            tex: 'ui/btn2_red_inactive', inset: [40, 40, 26, 26],
            text: t('delete', G.lang), fontSize: 26, sound: 'click', name: 'del',
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
function section(C: Node, y: number, key: string): number {
    label(C, t(key, G.lang), -296, y, 300, 40, { size: 28, color: '#9FB3CC', hAlign: 'left', anchorX: 0 });
    return y - 56;
}

function toggle(C: Node, y: number, key: string, get: () => boolean, set: (v: boolean) => void,
    refs: Array<() => void>, refresh: () => void): number {
    const card = rowCard(C, 620, 88, 0, y, '#1D2636');
    label(card, t(key, G.lang), -280, 0, 380, 50, { size: 26, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
    const track = roundedPanel(card, 108, 52, 240, 0, '#39445C', 26, '#4C5A73', 3, 'track');
    // 用圆角面板做钮，直角白方块太生硬
    const knob = roundedPanel(track, 42, 42, 0, 0, '#EDF3FF', 21, undefined, 0, 'knob');
    const setKnob = (on: boolean) => {
        knob.setPosition(on ? 27 : -27, 0, 0);
    };
    const hit = rect(card, 150, 76, 240, 0, '#00000000', 'hit');
    hit.on(Node.EventType.TOUCH_END, () => { set(!get()); refresh(); });
    setKnob(get());
    refs.push(() => setKnob(get()));
    return y - 100;
}

function stepper(C: Node, y: number, key: string, get: () => number, set: (v: number) => void,
    refs: Array<() => void>, refresh: () => void): number {
    const card = rowCard(C, 620, 88, 0, y, '#1D2636');
    label(card, t(key, G.lang), -280, 0, 340, 50, { size: 26, color: '#C9D6E6', hAlign: 'left', anchorX: 0 });
    const val = label(card, '', 200, 0, 120, 50, { size: 26, color: '#FFD75E' });
    const fill = rect(card, 180, 16, 40 - 90, 0, '#7FE1FF', 'fill');
    (fill.getComponent('cc.UITransform') as any).setAnchorPoint(0, 0.5);
    fill.setPosition(40 - 90, 0, 0);

    const step = (d: number) => { set(Math.max(0, Math.min(1, Math.round((get() + d) * 10) / 10))); refresh(); };
    button(card, {
        w: 68, h: 68, x: 240, y: 0, tex: 'ui/card_white', inset: [24, 24, 24, 24],
        texColor: '#26324A', text: '+', fontSize: 40, sound: 'click', onClick: () => step(0.1),
    });
    button(card, {
        w: 68, h: 68, x: -100, y: 0, tex: 'ui/card_white', inset: [24, 24, 24, 24],
        texColor: '#26324A', text: '-', fontSize: 40, sound: 'click', onClick: () => step(-0.1),
    });
    refs.push(() => {
        const v = get();
        val.string = Math.round(v * 100) + '%';
        setSize(fill, Math.max(2, 180 * v), 16);
    });
    return y - 100;
}

function applyVol() { refreshVol(); }
function refreshVol() {
    try { (globalThis as any).__tb_vol = G.data.settings.master; } catch (e) { /* ignore */ }
}

function confirmNewGame(parent: Node) {
    const root = nd(parent, 'confirm', MASK_SIZE.w, MASK_SIZE.h, 0, 0);
    const rootOp = root.addComponent(UIOpacity);
    rootOp.opacity = 0;
    rect(root, MASK_SIZE.w, MASK_SIZE.h, 0, 0, '#000000CC', 'm');
    const p = roundedPanel(root, 600, 380, 0, 0, '#1B2230', 26, '#C8A44A', 5);
    label(p, t('delete_confirm', G.lang), 0, 60, 520, 190, { size: 30, color: '#FFFFFF', overflow: 'clamp' });
    button(p, {
        w: 220, h: 82, x: -140, y: -120, tex: 'ui/btn_long_inactive', inset: [46, 46, 24, 24],
        text: t('cancel', G.lang), fontSize: 28, sound: 'click',
        onClick: () => {
            tween(rootOp).to(0.14, { opacity: 0 }).start();
            popOut(p, 0.14, () => root.destroy());
        },
    });
    button(p, {
        w: 220, h: 82, x: 140, y: -120, tex: 'ui/btn2_red_inactive', inset: [40, 40, 26, 26],
        text: t('confirm', G.lang), fontSize: 28, sound: 'click', name: 'confirmDel',
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
    void img;
}

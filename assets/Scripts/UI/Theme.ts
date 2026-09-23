import { Color, Graphics, Node, Sprite, Tween, tween, UITransform, Vec3 } from 'cc';
import { hex } from '../Core/Util';
import { label, nd, setFrame } from './UIKit';
import { Res } from '../Core/Res';

/**
 * 木纹卡通皮肤（对照参考图取色）。
 *
 * 全部面板/按钮/筹码都用 Graphics 画（圆角矩形 + 深棕描边 + 顶部奶油高光），
 * 不依赖切图 —— 矢量在任何尺寸下都锐利、改尺寸不用重出图，也不会和生成贴图的
 * 风格打架。只有「木纹/木牌/木轨」这类需要纹理感的才用贴图。
 */
export const WOOD = {
    /** 木桌/木牌主色 */
    table: '#E8A85C',
    plank: '#E9A85C',
    /** 深棕描边（所有控件的统一描边色） */
    line: '#4A2C14',
    line2: '#6B3A1A',
    /** 奶油底（次级按钮/药丸/卡片） */
    cream: '#F6E3C5',
    creamDark: '#E3C79C',
    creamHi: '#FFF7E6',
    /** 金色（主按钮/高亮） */
    gold: '#F2C34E',
    goldDark: '#C9902C',
    goldHi: '#FFE79A',
    /** 筹码底板（深巧克力） */
    plate: '#5C2E12',
    plateHi: '#7A421E',
    /** 未选中的灰药丸 */
    grey: '#B9B2A6',
    greyDark: '#948C7E',
    /** 履带 */
    belt: '#43434C',
    beltDark: '#2C2C33',
    beltSlat: '#35353D',
    /** 文字 */
    text: '#5A3210',
    textOn: '#FFF6E0',
    /** 机器盒面板绿 */
    green: '#96D07E',
};

/** 给文字加统一描边（木纹皮肤下深底浅字都靠它） */
export const OUTLINE = WOOD.line;

export interface PlateOpts {
    w: number; h: number; x: number; y: number;
    fill?: string;
    line?: string;
    lineW?: number;
    radius?: number;
    /** 顶部奶油高光（按钮的「亮面」） */
    gloss?: boolean;
    /** 内层浅色描边，做出「厚边」的层叠感 */
    inner?: string;
    name?: string;
}

/**
 * 木质圆角面板：底色 + 顶部高光 + 深棕描边。
 * 直接返回节点，调用方可以继续往上面挂图标/文字。
 *
 * ⚠️ Cocos 一个节点只允许挂**一个**渲染组件（node-ui-properties 的 uiComp 守卫，
 *    warnID 12002）—— 原来把高光/描边也 addComponent(Graphics) 到同一个节点上，
 *    从第二个起全部静默失败，按钮从来没有过描边和高光（就是「和效果图不像」的原因）。
 *    现在底色留在本节点（woodPlateRefill 找的就是它），其余各层各开一个子节点。
 */
export function woodPlate(parent: Node, o: PlateOpts): Node {
    const r = Math.max(4, o.radius ?? Math.min(o.h / 2, 22));
    const n = nd(parent, o.name || 'plate', o.w, o.h, o.x, o.y);
    // 记下圆角半径：选中态重绘底色时要和描边严丝合缝
    (n as any).__wr = r;
    const w = o.w, h = o.h;

    const g = n.addComponent(Graphics);
    g.fillColor = hex(o.fill || WOOD.cream);
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();

    if (o.gloss !== false) {
        // 顶部亮面：上半部一条圆角带，透明度低一点，纯装饰（独立子节点，见顶部注释）
        const gl = nd(n, 'gloss', w, h, 0, 0).addComponent(Graphics);
        gl.fillColor = new Color(255, 255, 255, 46);
        gl.roundRect(-w / 2 + 5, -h / 2 + h * 0.36, w - 10, h * 0.52, Math.max(3, r - 5));
        gl.fill();
    }
    if (o.inner) {
        const gi = nd(n, 'inner', w, h, 0, 0).addComponent(Graphics);
        gi.lineWidth = 3;
        gi.strokeColor = hex(o.inner);
        gi.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(3, r - 4));
        gi.stroke();
    }
    if (o.line !== '') {
        const gs = nd(n, 'stroke', w, h, 0, 0).addComponent(Graphics);
        gs.lineWidth = o.lineW ?? 5;
        gs.strokeColor = hex(o.line || WOOD.line);
        gs.roundRect(-w / 2, -h / 2, w, h, r);
        gs.stroke();
    }
    return n;
}

export interface WoodBtnOpts {
    w: number; h: number; x: number; y: number;
    text?: string;
    fontSize?: number;
    /** 文本颜色（默认深棕） */
    textColor?: string;
    /** 文本 y 偏移 */
    textY?: number;
    /** 文本左内边距（有图标时把文字挤到右边） */
    textPadX?: number;
    /** 文本 x 偏移（有图标时用来把「图标+文字」整组摆正） */
    textX?: number;
    icon?: string;
    iconW?: number;
    iconH?: number;
    iconX?: number;
    iconColor?: string;
    fill?: string;
    radius?: number;
    onClick?: () => void;
    sound?: string | null;
    name?: string;
    /** 禁用态：整体压暗 + 不响应 */
    disabled?: boolean;
}

/**
 * 重绘 woodPlate 的**底色**（选中/高亮态用）。
 * Graphics 没有"改色"接口，只能 clear + 重描；只动第一个 Graphics（底色），
 * 高光与描边是后面追加的两个 Graphics，不受影响。半径取 woodPlate 记下的值，
 * 重绘后边缘与描边严格重合。
 */
export function woodPlateRefill(n: Node, color: string) {
    if (!n || !n.isValid) { return; }
    const g = n.getComponent(Graphics);
    const ut = n.getComponent(UITransform);
    if (!g || !ut) { return; }
    const w = ut.width, h = ut.height;
    const r = (n as any).__wr ?? Math.max(4, Math.min(h / 2, 22));
    g.clear();
    g.fillColor = hex(color);
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
}

/**
 * 木质按钮：woodPlate + 可选图标 + 文字 + 按下缩放反馈。
 * 与 UIKit.button 的区别是**皮肤是木纹卡通**，且支持左侧图标。
 */
export function woodButton(parent: Node, o: WoodBtnOpts): Node {
    const n = woodPlate(parent, {
        w: o.w, h: o.h, x: o.x, y: o.y,
        fill: o.fill || WOOD.cream,
        radius: o.radius ?? Math.min(o.h / 2, 20),
        name: o.name || 'btn',
    });
    if (o.icon) {
        const iw = o.iconW ?? Math.min(o.h * 0.56, 52);
        const ih = o.iconH ?? iw;
        const ix = o.iconX ?? (-o.w / 2 + iw / 2 + o.h * 0.16);
        const s = nd(n, 'icon', iw, ih, ix, 0);
        const sp = s.addComponent(Sprite);
        setFrame(sp, o.icon, iw, ih, o.iconColor);
    }
    if (o.text) {
        const lb = label(n, o.text, o.textX ?? 0, o.textY ?? 2, o.w - (o.textPadX ?? 10), o.h, {
            size: o.fontSize ?? Math.min(40, o.h * 0.46),
            color: o.textColor ?? WOOD.text,
            bold: true,
            outline: '#FFF3D6', outlineWidth: 3,
        });
        void lb;
    }
    const base = 0.94;
    n.on(Node.EventType.TOUCH_START, () => { if (!o.disabled) { n.setScale(base, base, 1); } });
    n.on(Node.EventType.TOUCH_CANCEL, () => { n.setScale(1, 1, 1); });
    n.on(Node.EventType.TOUCH_END, () => {
        n.setScale(1, 1, 1);
        if (o.disabled) { return; }
        if (o.sound !== null && Res.I) { Res.I.play(o.sound || 'click', 0.7); }
        if (o.onClick) { o.onClick(); }
    });
    return n;
}

/**
 * 点击反馈：左右晃动（用户口径第十七轮：点「选项」按钮时，选项左右摇摆一下）。
 * 只动 angle（绕自身中心摆），不碰 scale —— scale 由按压反馈自己管。
 * 先 stop 同节点旧 tween：连点时上次没摆完的 angle 会被新动画顶掉，不会叠加抽搐。
 */
export function wobble(n: Node, deg = 6) {
    Tween.stopAllByTarget(n);
    tween(n)
        .to(0.07, { angle: deg })
        .to(0.12, { angle: -deg })
        .to(0.09, { angle: deg * 0.5 })
        .to(0.07, { angle: 0 })
        .start();
}

/**
 * 木牌横幅：左端盖 + 可横向拉伸的中段 + 右端盖。
 * 直接用整张木牌硬拉会把木纹和铆钉一起拽变形，所以拆三件拼。
 */
export function woodBanner(parent: Node, w: number, h: number, x: number, y: number, capW = 120, name = 'banner'): Node {
    const n = nd(parent, name, w, h, x, y);
    const capL = Math.min(capW, w * 0.32);
    const capR = capL;
    const midW = Math.max(2, w - capL - capR);

    const mk = (tex: string, sw: number, px: number, pname: string) => {
        const c = nd(n, pname, sw, h, px, 0);
        const sp = c.addComponent(Sprite);
        setFrame(sp, tex, sw, h);
        sp.type = Sprite.Type.SIMPLE;
        return sp;
    };
    mk('ui/wood_banner_l', capL, -w / 2 + capL / 2, 'capL');
    mk('ui/wood_banner_m', midW, -w / 2 + capL + midW / 2, 'mid');
    mk('ui/wood_banner_r', capR, w / 2 - capR / 2, 'capR');
    return n;
}

/** 深棕筹码底板（顶栏的金币/瓶盖数）—— 三层各自占一个渲染组件（见 woodPlate 注释） */
export function chipPlate(parent: Node, w: number, h: number, x: number, y: number, name = 'chip'): Node {
    const n = nd(parent, name, w, h, x, y);
    const g = n.addComponent(Graphics);
    g.fillColor = hex(WOOD.plate);
    g.roundRect(-w / 2, -h / 2, w, h, h / 2);
    g.fill();
    const gl = nd(n, 'gloss', w, h, 0, 0).addComponent(Graphics);
    gl.fillColor = new Color(255, 255, 255, 26);
    gl.roundRect(-w / 2 + 4, h * 0.02, w - 8, h * 0.42, Math.max(4, h / 2 - 4));
    gl.fill();
    const gs = nd(n, 'stroke', w, h, 0, 0).addComponent(Graphics);
    gs.lineWidth = 4;
    gs.strokeColor = hex(WOOD.line);
    gs.roundRect(-w / 2, -h / 2, w, h, h / 2);
    gs.stroke();
    return n;
}

/**
 * 木轨（履带框架用的横木条）。
 * 默认染深一档（#D8914A）——不染的话，木色木轨压在木色桌面上几乎看不见，
 * 履带就只剩中间那条黑带了。
 */
export function woodRail(parent: Node, w: number, h: number, x: number, y: number, name = 'rail', color = '#D8914A'): Node {
    const n = nd(parent, name, w, h, x, y);
    const sp = n.addComponent(Sprite);
    setFrame(sp, 'ui/wood_rail', w, h, color);
    sp.type = Sprite.Type.SIMPLE;
    // 描边只能挂在子节点上（一个节点一个渲染组件，见 woodPlate 注释）
    const gs = nd(n, 'stroke', w, h, 0, 0).addComponent(Graphics);
    gs.lineWidth = 5;
    gs.strokeColor = hex(WOOD.line);
    gs.roundRect(-w / 2, -h / 2, w, h, 7);
    gs.stroke();
    return n;
}

/** 深色履带面 + 分段竖条（填色在根节点，描边/辊条各占一个子节点） */
export function beltFace(parent: Node, w: number, h: number, x: number, y: number, name = 'belt'): Node {
    const n = nd(parent, name, w, h, x, y);
    const g = n.addComponent(Graphics);
    g.fillColor = hex(WOOD.belt);
    g.roundRect(-w / 2, -h / 2, w, h, 8);
    g.fill();
    const gs = nd(n, 'stroke', w, h, 0, 0).addComponent(Graphics);
    gs.lineWidth = 4;
    gs.strokeColor = hex(WOOD.line);
    gs.roundRect(-w / 2, -h / 2, w, h, 8);
    gs.stroke();
    // 分段竖条（履带节）：每 42px 一条
    const gl = nd(n, 'slats', w, h, 0, 0).addComponent(Graphics);
    gl.lineWidth = 3;
    gl.strokeColor = hex(WOOD.beltSlat);
    for (let px = -w / 2 + 24; px < w / 2 - 8; px += 42) {
        gl.moveTo(px, -h / 2 + 7);
        gl.lineTo(px, h / 2 - 7);
    }
    gl.stroke();
    return n;
}

/** 数量增减时的轻微「弹一下」，统一手感 */
export function bump(n: Node, s = 1.12) {
    Tween.stopAllByTarget(n);
    n.setScale(s, s, 1);
    tween(n).to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
}

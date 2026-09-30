import { BlockInputEvents, Color, EventTouch, Graphics, ImageAsset, Input, Label, Node, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, Widget, director, input, tween, view } from 'cc';
import { WM_CC, WM_CHUNKS, WM_KEY } from './WmData';

/**
 * Wm —— 权益水印（第122轮）。
 *
 * 用途：公司 logo 图片 + 「掌上方舟开发四组」文案以**隐藏触发点**形式散布在界面各处，
 *      供维权取证（截图/录屏证据），不影响正常游玩。
 *
 * 资源隐藏：logo PNG 经 rolling-XOR 混淆后 base64 分片内嵌于 WmData.ts（明文 PNG
 * 不入库、包内 grep 不到 PNG 魔数，`WM_CC` 亦避免文案明文出现在数据段），
 * 运行时 Blob→Image→ImageAsset→Texture2D→SpriteFrame 动态还原。
 *
 * ★ 触发一律走**全局输入轮询**，不挂节点 TOUCH 事件：
 *   滚动区里的行卡片会被 ScrollView 吞掉触摸（拿到的是滚动而非稳定配对），
 *   全局 input 不受 ScrollView / BlockInputEvents 约束。
 *   判定口径统一：把节点/矩形换算成**世界坐标系**，再和输入事件的世界坐标比较。
 *
 * 触发点（6 处，避开新手引导、避开「点设置标题」老套路）：
 *   图片：开始页 logo 长按 ／ 顶栏金币筹码 1.2s 连点 7 次 ／ 成就面板底部铭牌长按
 *   文本：开始页副标题 1.2s 连点 5 次 ／ 顶栏瓶盖筹码 1.2s 连点 5 次 ／ 统计面板底部铭牌长按
 */

/** 文案（charCode 表还原，不在源码/数据段留明文） */
const WM_TEXT = String.fromCharCode.apply(null, WM_CC as unknown as number[]);
/** logo 显示尺寸（源图 1:1 方图） */
const WM_LOGO_SIZE = 460;

/** 世界坐标矩形 */
interface WRect { x: number, y: number, w: number, h: number }
/** 触发目标：每帧现算矩形（节点可能被移动/销毁/移出可视），null = 当前不可触发 */
type RectFn = () => WRect | null;

function inRect(r: WRect | null, x: number, y: number): boolean {
    if (!r) { return false; }
    return Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2;
}

/** 节点世界包围盒 → 世界坐标矩形（含父链缩放/旋转），节点失效返回 null */
function nodeRect(n: Node | null | undefined): WRect | null {
    if (!n || !n.isValid || !n.activeInHierarchy) { return null; }
    const ut = n.getComponent('cc.UITransform') as unknown as { getBoundingBoxToWorld?: () => { x: number, y: number, width: number, height: number } } | null;
    const bb = ut?.getBoundingBoxToWorld?.();
    if (!bb) { return null; }
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, w: bb.width, h: bb.height };
}

/* ------------------------------------------------------------------ *
 * 全局输入轮询（hold + taps 共用一套监听，模块级只挂一次）
 * ------------------------------------------------------------------ */
interface HoldJob { ms: number, rect: RectFn, cb: () => void }
interface TapJob { n: number, winMs: number, rect: RectFn, cb: () => void, cnt: number, first: number }

const holdJobs: HoldJob[] = [];
const tapJobs: TapJob[] = [];
let holdActive: HoldJob | null = null;
let holdStartAt = 0;
let inputReady = false;

/**
 * 输入事件 → **世界坐标**。
 * ★ 必须走这层换算：getUILocation() 是 UI 坐标系（原点=视口左下角），与节点世界坐标
 *   恒差 view.getVisibleOrigin()（屏幕比例偏离 9:16 时就会整片错位）。
 *   项目里同一个换算入口见 `BottleField.uiToWorld`（用户口径：判定一律用世界坐标）。
 */
function evWorld(e: EventTouch): { x: number, y: number } {
    const p = e.getUILocation();
    const vo = view.getVisibleOrigin();
    return { x: p.x + vo.x, y: p.y + vo.y };
}

function ensureInput(): void {
    if (inputReady) { return; }
    inputReady = true;
    input.on(Input.EventType.TOUCH_START, (e: EventTouch) => {
        const p = evWorld(e);
        for (const j of tapJobs) {
            if (!inRect(j.rect(), p.x, p.y)) { continue; }
            const now = Date.now();
            if (j.cnt > 0 && now - j.first > j.winMs) { j.cnt = 0; }
            if (j.cnt === 0) { j.first = now; }
            if (++j.cnt >= j.n) { j.cnt = 0; try { j.cb(); } catch (err) { /* ignore */ } }
        }
        if (holdActive) { return; }
        for (const j of holdJobs) {
            if (inRect(j.rect(), p.x, p.y)) { holdActive = j; holdStartAt = Date.now(); return; }
        }
    });
    input.on(Input.EventType.TOUCH_MOVE, (e: EventTouch) => {
        if (!holdActive) { return; }
        const p = evWorld(e);
        if (!inRect(holdActive.rect(), p.x, p.y)) { holdActive = null; }
    });
    input.on(Input.EventType.TOUCH_END, () => { holdActive = null; });
    input.on(Input.EventType.TOUCH_CANCEL, () => { holdActive = null; });
}

/** 由 GameRoot / LoadScene 每帧调用（也可不调，Wm 自带 40ms 定时器兜底） */
export function wmTick(): void {
    if (holdActive && Date.now() - holdStartAt >= holdActive.ms) {
        const j = holdActive;
        holdActive = null;
        try { j.cb(); } catch (err) { /* ignore */ }
    }
}
let tickerOn = false;
function ensureTicker(): void {
    if (tickerOn) { return; }
    tickerOn = true;
    const loop = () => { wmTick(); setTimeout(loop, 40); };
    setTimeout(loop, 40);
}

/** 混淆 PNG → SpriteFrame（Blob URL → Image → ImageAsset → Texture2D），失败回调 null */
function decodeLogo(cb: (sf: SpriteFrame | null) => void): void {
    try {
        const b64 = WM_CHUNKS.join('');
        const raw = atob(b64);
        const u8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            u8[i] = raw.charCodeAt(i) ^ WM_KEY.charCodeAt(i % WM_KEY.length);
        }
        // PNG 魔数校验（137 'P' 'N' 'G'）—— 密钥不一致/数据损坏时走兜底文案
        if (u8[0] !== 0x89 || u8[1] !== 0x50 || u8[2] !== 0x4E || u8[3] !== 0x47) { cb(null); return; }
        const url = URL.createObjectURL(new Blob([u8], { type: 'image/png' }));
        const img = new Image();
        img.onload = () => {
            try {
                const ia = new ImageAsset(img as unknown as HTMLImageElement);
                const tex = new Texture2D();
                tex.image = ia;
                const sf = new SpriteFrame();
                sf.texture = tex;
                URL.revokeObjectURL(url);
                cb(sf);
            } catch (e) {
                URL.revokeObjectURL(url);
                cb(null);
            }
        };
        img.onerror = () => { URL.revokeObjectURL(url); cb(null); };
        img.src = url;
    } catch (e) {
        cb(null);
    }
}

export class Wm {
    private static showing = false;

    static showLogo(): void { Wm.show('logo'); }
    static showText(): void { Wm.show('text'); }

    /* ---------------- 触发点注册 ---------------- */

    /** 长按某节点 ms 毫秒触发（节点失效/隐藏时自动不可触发） */
    static holdNode(node: Node | null | undefined, ms: number, cb: () => void): void {
        ensureInput(); ensureTicker();
        holdJobs.push({ ms, rect: () => nodeRect(node), cb });
    }

    /** 长按某个现算的世界矩形 */
    static holdRect(rect: RectFn, ms: number, cb: () => void): void {
        ensureInput(); ensureTicker();
        holdJobs.push({ ms, rect, cb });
    }

    /** winMs 内连点某节点 n 次触发 */
    static taps(node: Node | null | undefined, n: number, winMs: number, cb: () => void): void {
        ensureInput(); ensureTicker();
        tapJobs.push({ n, winMs, rect: () => nodeRect(node), cb, cnt: 0, first: 0 });
    }

    /** winMs 内连点某个现算的世界矩形 n 次 */
    static tapsRect(rect: RectFn, n: number, winMs: number, cb: () => void): void {
        ensureInput(); ensureTicker();
        tapJobs.push({ n, winMs, rect, cb, cnt: 0, first: 0 });
    }

    /** 供外部拼自定义门控（如「引导期间不可触发」）时取节点世界矩形；节点失效返回 null */
    static nodeWorldRect(node: Node | null | undefined): WRect | null {
        return nodeRect(node);
    }

    /* ---------------- 展示浮层 ---------------- */

    private static show(kind: 'logo' | 'text'): void {
        if (Wm.showing) { return; }
        const scene = director.getScene();
        if (!scene || !scene.isValid) { return; }
        // 挂到当前场景 Canvas 顶层（Load 场景 / Game 场景通用）
        let canvas: Node | null = scene.getChildByName('Canvas');
        if (!canvas || !canvas.isValid) {
            for (const c of scene.children) {
                if (c.getComponent('cc.Canvas')) { canvas = c; break; }
            }
        }
        if (!canvas || !canvas.isValid) { return; }
        Wm.showing = true;

        const root = new Node('wm_root');
        canvas.addChild(root);
        root.setSiblingIndex(canvas.children.length - 1);
        root.addComponent(UITransform);
        const wd = root.addComponent(Widget);
        wd.isAlignLeft = wd.isAlignRight = wd.isAlignTop = wd.isAlignBottom = true;
        wd.left = wd.right = wd.top = wd.bottom = 0;
        root.addComponent(BlockInputEvents);

        let autoT: number | null = null;
        const close = () => {
            if (autoT !== null) { clearTimeout(autoT); autoT = null; }
            if (root.isValid) { root.destroy(); }
        };
        root.on(Node.EventType.NODE_DESTROYED, () => { Wm.showing = false; if (autoT !== null) { clearTimeout(autoT); autoT = null; } });
        root.on(Node.EventType.TOUCH_END, close);
        autoT = setTimeout(close, 5000) as unknown as number;

        // 黑幕：独立节点（一节点一渲染组件），尺寸取 Canvas 视口（Widget 下一帧才对齐）
        const cw = (canvas.getComponent('cc.UITransform') as UITransform).contentSize;
        const bg = new Node('wm_bg');
        root.addChild(bg);
        bg.addComponent(UITransform).setContentSize(cw.width, cw.height);
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 226);
        g.rect(-cw.width / 2, -cw.height / 2, cw.width, cw.height);
        g.fill();

        // 内容：文本兜底先显示；logo 模式解码成功后换图
        const ct = new Node('wm_ct');
        root.addChild(ct);
        ct.addComponent(UITransform).setContentSize(cw.width, 200);
        if (kind === 'text') {
            const lb = ct.addComponent(Label);
            lb.string = WM_TEXT;
            lb.fontSize = 62;
            lb.lineHeight = 76;
        } else {
            const lb = ct.addComponent(Label);
            lb.string = WM_TEXT;
            lb.fontSize = 46;
            lb.lineHeight = 58;
            const imgN = new Node('wm_img');
            root.addChild(imgN);
            imgN.addComponent(UITransform).setContentSize(WM_LOGO_SIZE, WM_LOGO_SIZE);
            imgN.active = false;
            decodeLogo((sf) => {
                if (!sf) { return; } // 保持兜底文案
                if (!root.isValid || !imgN.isValid) { return; }
                const sp = imgN.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.trim = false;
                sp.spriteFrame = sf;
                imgN.active = true;
                ct.active = false;
            });
        }

        const op = root.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.18, { opacity: 255 }).start();
    }

    /* ---------------- 隐藏触发器节点（烘焙进 prefab，此处仅兜底现建） ---------------- */

    /**
     * 开始页：补 logo / 副标题两个**透明占位节点**（prefab 里已烘好的走 findDeep）。
     * ⚠️ 本轮之前 prefab 无这两个节点、@property 为空 → 触发点挂不上，故代码兜底。
     */
    static ensureStartNodes(page: Node, onLogo: (n: Node) => void, onSub: (n: Node) => void): void {
        const root = page;
        let logo = Wm.findDeep(root, 'wmLogo');
        if (!logo) {
            logo = new Node('wmLogo');
            logo.addComponent(UITransform).setContentSize(560, 560);
            root.addChild(logo);
            logo.setPosition(0, 250, 0);
            logo.setSiblingIndex(root.children.length - 1);
        }
        onLogo(logo);
        let sub = Wm.findDeep(root, 'wmSub');
        if (!sub) {
            sub = new Node('wmSub');
            sub.addComponent(UITransform).setContentSize(420, 60);
            root.addChild(sub);
            sub.setPosition(0, -60, 0);
        }
        onSub(sub);
    }

    /**
     * 面板（成就/统计等）：在滚动区**下方**补一块铭牌触发区，
     * 不放进滚动内容 → 不会被 ScrollView 吞事件，也不会随内容滚走。
     */
    static ensurePanelPlate(frame: Node, name: string, y: number, onPlate: (n: Node) => void): Node {
        let p = frame.getChildByName(name);
        if (!p) {
            p = new Node(name);
            p.addComponent(UITransform).setContentSize(560, 72);
            frame.addChild(p);
            p.setPosition(0, y, 0);
            p.setSiblingIndex(frame.children.length - 1);
        }
        onPlate(p);
        return p;
    }

    private static findDeep(root: Node, name: string): Node | null {
        if (root.name === name) { return root; }
        for (const c of root.children) {
            const r = Wm.findDeep(c, name);
            if (r) { return r; }
        }
        return null;
    }
}

// 无头验收调试钩子（玩家不可见）：__wm.logo() / __wm.text() 直接拉浮层
(globalThis as any).__wm = { logo: () => Wm.showLogo(), text: () => Wm.showText() };

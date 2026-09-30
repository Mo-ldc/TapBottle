import { BlockInputEvents, Color, Graphics, ImageAsset, Label, Node, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, Widget, director, tween } from 'cc';
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
 * 触发点接线（6 处，全部挂在**无任何交互监听的纯装饰节点**上，零玩法冲突；
 * 刻意避开「点设置标题」这类已被发现的套路）：
 *   图片：开始页 logo 长按 2.5s ／ 顶栏金币筹码 1.2s 内连点 7 次 ／ 成就面板第一行长按 2.5s
 *   文本：开始页副标题 1.2s 内连点 5 次 ／ 顶栏瓶盖筹码 1.2s 内连点 5 次 ／ 统计面板第一行长按 2.5s
 *
 * 展示：全屏黑幕浮层（Canvas 顶层 + BlockInputEvents），点击任意处或 5s 自动关闭。
 */

/** 文案（charCode 表还原，不在源码/数据段留明文） */
const WM_TEXT = String.fromCharCode.apply(null, WM_CC as unknown as number[]);
/** logo 显示尺寸（源图 1:1 方图） */
const WM_LOGO_SIZE = 460;

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

    private static show(kind: 'logo' | 'text'): void {
        if (Wm.showing) { return; }
        const scene = director.getScene();
        if (!scene || !scene.isValid) { return; }
        // 挂到当前场景 Canvas 顶层（Load 场景 / Game 场景通用）
        let canvas: Node | null = scene.getChildByName('Canvas');
        if (!canvas) {
            for (const c of scene.children) {
                if (c.getComponent('cc.Canvas')) { canvas = c; break; }
            }
        }
        if (!canvas || !canvas.isValid) { return; }
        Wm.showing = true;

        const root = new Node('wm_root');
        canvas.addChild(root);
        root.setSiblingIndex(canvas.children.length - 1);
        const rut = root.addComponent(UITransform);
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

    /**
     * 长按触发：按住 ms 毫秒（中途抬起/取消即作废）。
     * 只挂纯装饰节点 —— 不碰 pressable/按钮，故不会与任何现有交互抢事件。
     * __wmHold 防重入：bindButtons 每次 show 重复调用安全。
     */
    static hold(node: Node | null, ms: number, cb: () => void): void {
        if (!node || !node.isValid || (node as any).__wmHold) { return; }
        (node as any).__wmHold = true;
        let timer: number | null = null;
        const clear = () => {
            if (timer !== null) { clearTimeout(timer); timer = null; }
        };
        node.on(Node.EventType.TOUCH_START, () => {
            clear();
            timer = setTimeout(() => {
                timer = null;
                if (node.isValid) { cb(); }
            }, ms);
        });
        node.on(Node.EventType.TOUCH_END, clear);
        node.on(Node.EventType.TOUCH_CANCEL, clear);
        node.on(Node.EventType.NODE_DESTROYED, clear);
    }

    /**
     * 连点触发：winMs 窗口内累计 n 次 TOUCH_START（超窗重新计数）。
     * 挂在无监听节点上，正常游玩不可能误触（谁会去连戳金币筹码 7 下）。
     */
    static taps(node: Node | null, n: number, winMs: number, cb: () => void): void {
        if (!node || !node.isValid || (node as any).__wmTaps) { return; }
        (node as any).__wmTaps = true;
        let cnt = 0;
        let first = 0;
        node.on(Node.EventType.TOUCH_START, () => {
            if (!node.isValid) { return; }
            const now = Date.now();
            if (cnt > 0 && now - first > winMs) { cnt = 0; }
            if (cnt === 0) { first = now; }
            cnt++;
            if (cnt >= n) {
                cnt = 0;
                cb();
            }
        });
    }
}

// 无头验收调试钩子（玩家不可见）：__wm.logo() / __wm.text() 直接拉浮层
(globalThis as any).__wm = { logo: () => Wm.showLogo(), text: () => Wm.showText() };

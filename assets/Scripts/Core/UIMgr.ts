import { Node, Prefab, instantiate, resources } from 'cc';
import { UIBase } from '../UI/Base/UIBase';

/** 界面名 —— 同时用作 prefab 文件名（`Prefabs/UI/<Name>.prefab`） */
export enum UIName {
    /** 标题页（点击开始游戏）—— 仅在开局出现一次 */
    StartPage = 'StartPage',
    /** 游戏主界面：顶栏 HUD + 能力条 + 底栏 + 履带 + 广告按钮 */
    GamePage = 'GamePage',

    /** 设置弹窗 */
    SettingDialog = 'SettingDialog',
    /** 统计弹窗 */
    StatsDialog = 'StatsDialog',
    /** 成就弹窗 */
    AchDialog = 'AchDialog',
    /** 离线收益弹窗 */
    OfflineDialog = 'OfflineDialog',
    /** 二次确认弹窗（删存档等） */
    ConfirmDialog = 'ConfirmDialog',
    /** 购买不足以内的通用提示弹窗 */
    HintDialog = 'HintDialog',
}

/** UI 预制体根目录：assets/resources/Prefabs/UI（resources.load 只认 resources 下） */
export const UI_ROOT = 'Prefabs/UI';

/** 清单里每一项的路径（缺文件会让整批 preload 失败，见 Prefabs.ts 的同类坑） */
export const UI_ENTRIES: UIName[] = [
    UIName.StartPage,
    UIName.GamePage,
    UIName.SettingDialog,
    UIName.StatsDialog,
    UIName.AchDialog,
    UIName.OfflineDialog,
    UIName.ConfirmDialog,
];

/**
 * 界面管理器 —— 参考 `E:\LDC_Cocos_PJ\Cocos2X\ZcVertical\assets\Scripts\Manager\UIMgr.ts`
 * 的三层 Root（Page / Dialog / Tip）架构，按 Cocos 3.x 重写。
 *
 * 与旧版的根本差别：**UI 不再由代码生成节点**，而是：
 *   1. 场景里只留三个空挂载点（PageRoot / DialogRoot / TipRoot）；
 *   2. 每个界面是一个 prefab（`assets/resources/Prefabs/UI/<Name>.prefab`），
 *      根挂一个继承 `UIBase` 的脚本，节点引用在 prefab 里 @property 绑好；
 *   3. `showPage / showDialog` 时**按需异步加载** → instantiate → 挂到对应 Root → 播入场动画。
 *      首次打开会走一次 `resources.load`，之后命中缓存直接同步实例化。
 *
 * ⚠️ 依赖要点：
 *   · `roots` 必须在 `show*` 之前 `bindRoots()`；
 *   · 界面名字就是 prefab 根节点名，`hidePage/hideDialog/hasDialog` 靠子节点名匹配；
 *   · 任何一条路径缺文件只会让**那个界面**失败（逐个 load，不是整批），失败会 console.error
 *     并静默返回，不会中断调用方。
 */
export class UIMgr {
    static I: UIMgr = null!;

    /** 页面层（全屏，通常同时只开一个） */
    static PageRoot: Node = null!;
    /** 弹窗层 */
    static DialogRoot: Node = null!;
    /** 最上层：Toast / 加载遮罩 */
    static TipRoot: Node = null!;

    private prefabs = new Map<string, Prefab>();
    private loading = new Map<string, Promise<Prefab | null>>();

    static boot(): UIMgr {
        if (!UIMgr.I) { UIMgr.I = new UIMgr(); }
        return UIMgr.I;
    }

    /** 由 GameRoot.onLoad 调用：把场景里的三个挂载点接进来 */
    bindRoots(page: Node, dialog: Node, tip: Node): void {
        UIMgr.PageRoot = page;
        UIMgr.DialogRoot = dialog;
        UIMgr.TipRoot = tip;
    }

    /* ---------------- 预加载 ---------------- */

    /** 预加载清单里的所有界面（可选）。`onProgress(0..1)` 用于引导进度条。 */
    preload(keys: UIName[] = UI_ENTRIES, done?: (ok: boolean) => void, onProgress?: (f: number) => void): void {
        let n = 0;
        let ok = true;
        const total = keys.length;
        if (total === 0) { if (done) { done(true); } return; }
        for (const k of keys) {
            this.load(k, (pf) => {
                if (!pf) { ok = false; }
                n++;
                if (onProgress) { onProgress(n / total); }
                if (n >= total && done) { done(ok); }
            });
        }
    }

    /** 取已缓存的预制体（没有则返回 null，不触发加载） */
    getPrefab(key: string): Prefab | null { return this.prefabs.get(key) || null; }

    /* ---------------- 显示 ---------------- */

    /** 打开页面（挂 PageRoot）。已有同名页面在 → 只 init，不重复创建。 */
    showPage(key: UIName, cb?: () => void, arg?: unknown): void {
        this.open(key, UIMgr.PageRoot, cb, arg);
    }

    /** 打开弹窗（挂 DialogRoot）。已有同名弹窗在 → 直接返回，不叠加。 */
    showDialog(key: UIName, cb?: () => void, arg?: unknown): void {
        if (this.has(UIMgr.DialogRoot, key)) { return; }
        this.open(key, UIMgr.DialogRoot, cb, arg);
    }

    /** 隐藏页面 */
    hidePage(key: UIName, cb?: () => void): void { this.closeBy(UIMgr.PageRoot, key, cb); }

    /** 隐藏弹窗 */
    hideDialog(key: UIName, cb?: () => void): void { this.closeBy(UIMgr.DialogRoot, key, cb); }

    /** 该弹窗当前是否打开 */
    hasDialog(key: UIName): boolean { return this.has(UIMgr.DialogRoot, key); }

    /** 该页面当前是否打开 */
    hasPage(key: UIName): boolean { return this.has(UIMgr.PageRoot, key); }

    /** 取正在显示的界面组件（没开则 null） */
    getUI<T extends UIBase>(key: UIName): T | null {
        for (const root of [UIMgr.PageRoot, UIMgr.DialogRoot]) {
            if (!root || !root.isValid) { continue; }
            const n = root.getChildByName(key);
            if (n && n.isValid) {
                const c = n.getComponent(UIBase);
                if (c) { return c as T; }
            }
        }
        return null;
    }

    /* ---------------- 内部 ---------------- */

    private has(root: Node, key: string): boolean {
        if (!root || !root.isValid) { return false; }
        const n = root.getChildByName(key);
        return !!n && n.isValid;
    }

    private closeBy(root: Node, key: string, cb?: () => void): void {
        if (!root || !root.isValid) { if (cb) { cb(); } return; }
        const n = root.getChildByName(key);
        if (!n || !n.isValid) { if (cb) { cb(); } return; }
        const c = n.getComponent(UIBase);
        if (!c) { n.destroy(); if (cb) { cb(); } return; }
        c.hide(cb);
    }

    private open(key: UIName, root: Node | null, cb?: () => void, arg?: unknown): void {
        const parent = root || UIMgr.PageRoot;
        if (!parent || !parent.isValid) {
            console.error('[UIMgr] 未绑定 Root，无法打开界面:', key);
            if (cb) { cb(); }
            return;
        }
        const cached = this.prefabs.get(key);
        if (cached) { this.spawn(key, cached, parent, cb, arg); return; }
        this.load(key, (pf) => {
            if (!pf) { console.error('[UIMgr] 加载界面失败:', key); if (cb) { cb(); } return; }
            // 异步期间可能已经被关掉/重复打开过
            if (this.has(parent, key)) { if (cb) { cb(); } return; }
            this.spawn(key, pf, parent, cb, arg);
        });
    }

    private spawn(key: UIName, pf: Prefab, parent: Node, cb?: () => void, arg?: unknown): void {
        const n = instantiate(pf);
        n.name = key;
        const ui = n.getComponent(UIBase);
        n.active = false;
        parent.addChild(n);
        if (!ui) {
            // 没有 UIBase 也要能显示（纯展示节点），只是没有入场动画
            n.active = true;
            if (cb) { cb(); }
            return;
        }
        ui.show(cb, arg);
    }

    /**
     * 加载一个界面预制体（带缓存 + 并发去重）。
     * ⚠️ 这里用**逐个** load 而不是一次传数组：数组版有一条路径失败整批都失败
     *    （和 Res.ts 贴图加载同一个坑），一个界面缺文件不该拖垮全部。
     */
    private load(key: string, cb: (pf: Prefab | null) => void): void {
        const hit = this.prefabs.get(key);
        if (hit) { cb(hit); return; }
        const pending = this.loading.get(key);
        if (pending) { pending.then(cb); return; }
        const path = UI_ROOT + '/' + key;
        const p = new Promise<Prefab | null>((resolve) => {
            resources.load(path, Prefab, (err, asset) => {
                if (err || !asset) {
                    console.error('[UIMgr] resources.load 失败:', path, err && err.message);
                    resolve(null);
                    return;
                }
                resolve(asset);
            });
        });
        this.loading.set(key, p);
        p.then((pf) => {
            this.loading.delete(key);
            if (pf) { this.prefabs.set(key, pf); }
            cb(pf);
        });
    }
}

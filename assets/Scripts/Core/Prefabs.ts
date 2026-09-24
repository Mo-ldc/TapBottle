import { instantiate, Node, Prefab, resources } from 'cc';

/**
 * Prefabs —— 预制体清单 + 预加载 + 同步实例化。
 *
 * 工程从「全代码建节点」迁移到「预制体驱动」后，所有 UI / 游戏对象都在编辑器里
 * 可视化编辑，代码只负责：
 *   ① 进游戏前把清单里的预制体一次性加载进来（和贴图/音频/字体一起，进度条统一上报）；
 *   ② 运行时用 `Prefabs.make('UI/Hud', parent)` 同步拿实例（已加载完，不再异步等待）。
 *
 * ⚠️ 预制体全部放在 `assets/resources/Prefabs/` 下 —— `resources.load` 只认这个目录。
 *    要把预制体挪到别的 bundle，改这里 + `loadAll` 的加载根即可，业务层不用动。
 *
 * ⚠️ 清单里的路径**任何一条加载失败，整批都会失败**（和贴图一个坑，见 Res.ts 注释），
 *    所以删/改预制体文件名必须同步改 `PREFAB_PATHS`，否则进游戏所有预制体都拿不到。
 */
export const PREFAB_ROOT = 'Prefabs';

/** 预制体清单（相对 `assets/resources/Prefabs/` 的路径，不带扩展名） */
export const PREFAB_PATHS: string[] = [
    // 游戏对象
    'Game/Bottle',
    'Game/BottleShadow',
    // UI（Chip / Hud 迁移完成后再加回来）
];

export class Prefabs {
    static I: Prefabs = null!;

    private map: Record<string, Prefab> = {};
    private ready = false;

    static boot(): Prefabs {
        if (!Prefabs.I) { Prefabs.I = new Prefabs(); }
        return Prefabs.I;
    }

    /** 预加载全部预制体；`onProgress(0..1)` 用于加载页进度条 */
    loadAll(done: (ok: boolean) => void, onProgress?: (f: number) => void) {
        if (this.ready) { done(true); return; }
        const paths = PREFAB_PATHS.map((p) => PREFAB_ROOT + '/' + p);
        resources.load(paths, Prefab,
            (fin: number, tot: number) => { if (onProgress) { onProgress(tot > 0 ? fin / tot : 0); } },
            (err, assets: Prefab[]) => {
                if (err) {
                    console.warn('[Prefabs] load error', err);
                    done(false);
                    return;
                }
                for (let i = 0; i < assets.length; i++) { this.map[PREFAB_PATHS[i]] = assets[i]; }
                this.ready = true;
                done(true);
            });
    }

    get(key: string): Prefab | null {
        return this.map[key] || null;
    }

    has(key: string): boolean { return !!this.map[key]; }

    /**
     * 同步实例化一个预制体并挂到 `parent`。
     * @param key   清单里的相对路径，如 'UI/Hud'
     * @param parent 父节点（不传则只创建、由调用方自己 addChild）
     */
    make(key: string, parent?: Node | null): Node | null {
        const pf = this.get(key);
        if (!pf) { console.warn('[Prefabs] missing prefab: ' + key); return null; }
        const n = instantiate(pf);
        if (parent) { parent.addChild(n); }
        return n;
    }

    /** 强制重新加载（切语言/重开时用不到，保留接口） */
    release() { this.map = {}; this.ready = false; }
}

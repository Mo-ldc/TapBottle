import { _decorator, Camera, Canvas, Component, director, Label, Node, ResolutionPolicy, tween, Tween, UIOpacity, UITransform, view, Widget } from 'cc';
import { DESIGN_H, DESIGN_W } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res, bootFlags } from '../Core/Res';
import { UIMgr, UIName } from '../Core/UIMgr';
import { installPreviewInputBridge } from '../Core/PreviewInputBridge';
import { installErrorGuard } from '../Core/ErrorGuard';
import { wmTick } from '../Core/Wm';

const { ccclass, property } = _decorator;

/**
 * LoadScene —— Load 场景主控（用户口径：采用**切换场景**的形式）。
 *
 * 场景结构（assets/Scenes/Load.scene，build_load_scene.py 生成）：
 *   Scene
 *   ├── Canvas
 *   │   ├── Camera
 *   │   └── LoadRoot（本组件）
 *   │       ├── Bg           —— 加载背景图，按可见区拉伸铺满
 *   │       └── uiRoot       —— 可见区大小（Widget 链贴可见区）
 *   │           ├── LoadingRoot —— 底部「正在加载中」+ 进度条（小瓶子骑填充前沿）
 *   │           └── PageRoot    —— StartPage 预制体的挂载点
 *   └── Res（场景级常驻节点，addPersistRootNode：切场景后 BGM 不断、资源不丢）
 *
 * 流程：Res.loadAll（进度 0~0.85）→ UIMgr 预载 UI 预制体（0.85~1）→
 *       进度条走完 → 拉起 StartPage → 玩家点击 → director.loadScene('Game')。
 *
 * ⚠️ 历史坑（Memory.md）：场景切换时 repeatForever 的 tween 不会自动停，
 *    StartPage 的 logo 浮动/呼吸动画都已在它自己的 onDisable 里停掉；
 *    本组件不持有任何循环 tween。
 */
@ccclass('LoadScene')
export class LoadScene extends Component {
    static I: LoadScene = null!;

    /**
     * ★ 回访判定用 `bootFlags.loaded`（Core/Res.ts 的模块级标记，跨场景存活）。
     *
     * 为什么需要回访快路径（第七十一轮）：
     *   从游戏内点「返回开始界面」走的是 `director.loadScene('Load')`（整场景重建）。
     *   回访时资源其实**早已就绪** —— assetManager 缓存全命中、UIMgr 的 prefabs Map
     *   是静态单例、构建包里 Prefabs 也是静态单例 —— 真正的耗时只有进度条动画本身：
     *   `update()` 里 `shown += dt * 0.55`，从 3% 爬到 99.5% 要 (0.995-0.03)/0.55 ≈ 1.75s，
     *   再加 `onReady()` 的 0.35s 加载区淡出 —— 玩家白等 2.1 秒。
     *
     * ⚠️ 曾用过「LoadScene 类静态 booted，在正常流程末尾置位」的判据，被无头验收当场
     *   抓包否决：构建包启动场景直接是 Game（builder.json startScene），Load 的 onLoad
     *   在首次返回前从没跑过 → 第一次返回仍走完整进度条（实测 2421ms vs 快路径 259ms）。
     *   「资源加载过没有」必须由资源模块自己（Res.loadAll 的 finish）说了算。
     */

    @property({ type: Node, tooltip: '加载背景（拉伸铺满可见区）' })
    bgNode: Node = null!;
    @property({ type: Node, tooltip: 'UI 根（尺寸=可见区）' })
    uiRoot: Node = null!;
    @property({ type: Node, tooltip: '加载区根（文案+进度条）' })
    loadingRoot: Node = null!;
    @property({ type: Node, tooltip: '进度条内槽（左锚点，填充/骑瓶的坐标系）' })
    inner: Node = null!;
    @property({ type: Node, tooltip: '进度条填充（九宫格 Sprite，代码改宽度）' })
    fillBar: Node = null!;
    @property({ type: Node, tooltip: '骑在填充前沿的小瓶子' })
    bottleRider: Node = null!;
    @property({ type: Label, tooltip: '加载文案' })
    loadTxt: Label = null!;
    @property({ type: Node, tooltip: '页面挂载点（StartPage）' })
    pageRoot: Node = null!;
    @property({ type: Node, tooltip: '资源节点（场景级，切场景常驻）' })
    resNode: Node = null!;

    /** 骑瓶定位：瓶**右缘**压住填充前沿 9px（瓶宽 169 → 中心 = 前沿 - 75.5），
     *  即瓶身横骑在进度条尖端上、瓶盖略探出前沿（旧值 -8 是瓶左缘贴前沿 → 整瓶悬在条右侧外）。 */
    private static readonly RIDER_LEAD = -160;
    private innerW = 1186;
    private riderW = 178;
    private target = 0.03;
    private shown = 0.03;
    private ready = false;
    private entered = false;
    private lastVw = 0;
    private lastVh = 0;

    onLoad() {
        LoadScene.I = this;
        // 预览页输入修复（必须最先做：构建产物零影响，详见 PreviewInputBridge.ts 顶部注释）
        installPreviewInputBridge();
        // 测试机现场回收三件套（异常浮层/看门狗/GL丢失自救），幂等 —— 见 Core/ErrorGuard.ts
        installErrorGuard();
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
        this.alignCanvas();

        // ★ 二次回切坑（2026-09-28 修复「点返回按钮报错 Cannot read properties of null (reading 'length')」）：
        //   Res 节点既是场景文件里的实体，又被 addPersistRootNode 设为常驻。返回按钮 loadScene('Load')
        //   时，引擎 runSceneImmediate 的 AttachPersist 分支发现新场景反序列化出 uuid 相同的 Res 副本，
        //   会把**新副本 _destroyImmediate()** 掉、换插首次启动时的常驻老节点 —— 而 @property resNode
        //   仍指向已销毁副本，getComponent(Res) 读到 null._components 就炸（只有第二次进 Load 才发生；
        //   构建包里 SceneAsset 复用同一 Scene 实例、走的是 else 重新挂载分支，所以不炸）。
        //   修复：属性引用失效时按 uuid 找回场景里真正的常驻节点；老节点已 persist 则不重复登记。
        if (this.resNode && !this.resNode.isValid) {
            const scene = this.node.scene || director.getScene();
            const persist = scene ? scene.getChildByUuid(this.resNode.uuid) : null;
            if (persist) { this.resNode = persist; }
        }
        // 资源/音频节点切场景常驻（BGM 不断、已加载的贴图不丢）
        if (this.resNode && this.resNode.isValid && !director.isPersistRootNode(this.resNode)) {
            director.addPersistRootNode(this.resNode);
        }

        // BGM 必须借「点击开始」那次用户手势重播，否则浏览器自动播放策略会挂起 AudioContext
        (globalThis as any).__tbOnStart = () => {
            if (!Res.I) { return; }
            Res.I.music(false);
            Res.I.music(true, G.data.settings.music);
        };

        // 本场景只有页面层：三个 Root 都指到 pageRoot（弹窗/提示在 Game 场景才有）
        UIMgr.boot().bindRoots(this.pageRoot, this.pageRoot, this.pageRoot);

        // 文案语言自适应（沿用旧口径：看浏览器语言）
        const zh = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh').toLowerCase().indexOf('zh') === 0;
        if (this.loadTxt) { this.loadTxt.string = zh ? '正在加载中' : 'Loading'; }

        const iut = this.inner ? this.inner.getComponent(UITransform) : null;
        if (iut) { this.innerW = iut.width; }
        const rut = this.bottleRider ? this.bottleRider.getComponent(UITransform) : null;
        if (rut) { this.riderW = rut.width; }
        this.setFill(0.03);
        this.fitToVisible();

        // ★ 回访快路径（资源已完整加载过一轮即触发，含构建包「首场景是 Game、
        //   Load 的 onLoad 从没跑过」的第一次返回）—— 见类头注释。
        //   插在这里是因为上面的 alignCanvas / fitToVisible / UIMgr.bindRoots 都必须照做
        //   （PageRoot 是本场景的新节点，不重绑就没地方挂 StartPage）。
        if (bootFlags.loaded) {
            this.skipLoading();
            return;
        }

        // 资源加载（85%）→ UI 预制体预载（15%）→ 就绪
        // （★ resNode 若在上面的 uuid 换回中变成了常驻老节点，getComponent 命中的就是
        //   首次启动那个已 loadAll 完成的 Res 实例 —— loadAll 幂等，ready 直接回调）
        const res = this.resNode && this.resNode.isValid
            ? (this.resNode.getComponent(Res) || this.resNode.addComponent(Res))
            : Res.I;
        res.loadAll(() => {
            UIMgr.boot().preload([
                UIName.StartPage, UIName.SettingDialog, UIName.StatsDialog,
                UIName.AchDialog, UIName.OfflineDialog, UIName.ConfirmDialog,
            ], () => { this.target = 1; },
                (f) => { this.setProgress(0.85 + f * 0.15); });
        }, (f) => { this.setProgress(f * 0.85); });
    }

    /** 填充宽度 + 骑瓶位置（同旧 Boot.setFill：内槽左锚点坐标系）。
     *  ★ 填充是九宫格（bd02 左右切边 21+21）：宽度下限 44，低于切边和圆头会破；
     *  ★ 骑瓶起步时进度≈0，若不夹会整体探出进度条左端（inner 距条框仅 ~33px），夹回条内。 */
    private setFill(p: number) {
        const w = Math.max(44, p * this.innerW);
        const ut = this.fillBar.getComponent(UITransform);
        if (ut) { ut.setContentSize(w, ut.height); }
        const cx = Math.max(this.riderW / 2 - 33, w + LoadScene.RIDER_LEAD + this.riderW / 2);
        this.bottleRider.setPosition(cx, this.bottleRider.position.y, 0);
    }

    private setProgress(f: number) {
        if (!isFinite(f)) { return; }
        if (f > this.target) { this.target = Math.min(1, f); }
    }

    update(dt: number) {
        // ErrorGuard 看门狗心跳（标题页也要报活，见 Core/ErrorGuard.ts）
        (globalThis as any).__tbHeart = Date.now();
        wmTick();   // 权益水印长按轮询（标题页也要跑，见 Core/Wm.ts）
        // 窗口尺寸变了（旋屏/拖拽）：背景与 uiRoot 跟着可见区重排（幂等，开销极小）
        const vs = view.getVisibleSize();
        if (Math.abs(vs.width - this.lastVw) > 0.5 || Math.abs(vs.height - this.lastVh) > 0.5) {
            this.alignCanvas();
            this.fitToVisible();
        }
        if (this.ready) { return; }
        // 平滑逼近目标进度（旧 DOM 层 CSS transition 的等价物）
        this.shown = Math.min(this.target, this.shown + dt * 0.55);
        this.setFill(this.shown);
        if (this.target >= 1 && this.shown >= 0.995) { this.onReady(); }
    }

    /** Canvas 对齐可见区中心（同 GameRoot.alignCanvas：渲染/点击坐标一致的前提） */
    private alignCanvas() {
        const cv = this.node.parent;
        if (!cv || !cv.isValid) { return; }
        const vs = view.getVisibleSize();
        const vo = view.getVisibleOrigin();
        const x = vo.x + vs.width / 2;
        const y = vo.y + vs.height / 2;
        if (Math.abs(cv.position.x - x) < 0.01 && Math.abs(cv.position.y - y) < 0.01) { return; }
        cv.setPosition(x, y, 0);
        const canvas = cv.getComponent(Canvas);
        const cam = canvas && canvas.cameraComponent;
        if (cam && cam.isValid) { cam.node.setWorldPosition(x, y, 1000); }
    }

    /** 背景拉伸铺满 + uiRoot = 可见区（Widget 链因此贴可见区边缘） */
    private fitToVisible() {
        const vs = view.getVisibleSize();
        this.lastVw = vs.width;
        this.lastVh = vs.height;
        if (this.bgNode) {
            const but = this.bgNode.getComponent(UITransform);
            if (but) { but.setContentSize(vs.width, vs.height); }
            this.bgNode.setPosition(0, 0, 0);
        }
        if (this.uiRoot) {
            const uut = this.uiRoot.getComponent(UITransform);
            if (uut) { uut.setContentSize(vs.width, vs.height); }
            this.uiRoot.setPosition(0, 0, 0);
            for (const child of this.uiRoot.children) {
                const w = child.getComponent(Widget);
                if (w) { w.updateAlignment(); }
            }
        }
    }

    /**
     * ★ 回访快路径：不演进度条，直接把加载区按掉、拉起 StartPage。
     *
     * `ready = true` 是必须的：`update()` 里靠它提前 return，否则下一帧 `shown` 会
     * 从 3% 重新往上爬、爬到 1 再走一遍 `onReady()`（等于白跳）。
     * 置 active=false 在 onLoad 内完成，早于本帧渲染 → 不会闪一下加载条。
     *
     * ⚠️ 别省掉下面的 loadAll/preload：首次返回时（构建包首场景 = Game）本场景的
     *   Res 是**全新副本**，frames/clips 字典（实例字段）是空的 —— StartPage 的贴图走
     *   prefab 序列化引用不受影响，但之后点「开始游戏」进 Game，瓶子/Fx 全走
     *   `Res.I.sf()`，字典不填就是满屏白块。loadAll 会命中 assetManager 缓存瞬时完成；
     *   UIMgr.preload 同理补 UI 预制体缓存（Game 首启没走过 preload）。
     */
    private skipLoading(): void {
        this.ready = true;
        if (this.loadingRoot && this.loadingRoot.isValid) { this.loadingRoot.active = false; }
        const res = this.resNode && this.resNode.isValid
            ? (this.resNode.getComponent(Res) || this.resNode.addComponent(Res))
            : Res.I;
        if (res) { res.loadAll(() => { /* 缓存命中，瞬时 */ }); }
        UIMgr.boot().preload([
            UIName.StartPage, UIName.SettingDialog, UIName.StatsDialog,
            UIName.AchDialog, UIName.OfflineDialog, UIName.ConfirmDialog,
        ]);
        UIMgr.boot().showPage(UIName.StartPage);
    }

    /** 资源就绪：加载区淡出 → 按需拉起 StartPage 预制体 */
    private onReady() {
        if (this.ready) { return; }
        this.ready = true;
        this.setFill(1);
        const lo = this.loadingRoot.getComponent(UIOpacity) || this.loadingRoot.addComponent(UIOpacity);
        tween(lo).to(0.35, { opacity: 0 }).call(() => { this.loadingRoot.active = false; }).start();
        this.scheduleOnce(() => {
            UIMgr.boot().showPage(UIName.StartPage);
        }, 0.35);
    }

    /** StartPage 点击后调用：整页淡出 → 切到 Game 场景 */
    enterGame() {
        if (this.entered) { return; }
        this.entered = true;
        const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        tween(op).to(0.25, { opacity: 0 }).call(() => {
            director.loadScene('Game');
        }).start();
    }

    onDestroy() {
        // ★ 同 GameRoot.onDestroy：本场景若注册过监听（当前没有，防御性兜底），
        //   离场时一并摘掉，绝不让死闭包跨场景存活。
        G.clearListeners();
        // 防御：本组件不持有循环 tween，但保险起见停掉作用在自身节点上的所有 tween
        try { Tween.stopAllByTarget(this.node); } catch (e) { /* ignore */ }
    }
}

import { _decorator, Camera, Canvas, Component, director, Label, Node, ResolutionPolicy, tween, Tween, UIOpacity, UITransform, view, Widget } from 'cc';
import { DESIGN_H, DESIGN_W } from '../Core/GameConfig';
import { G } from '../Core/State';
import { Res } from '../Core/Res';
import { UIMgr, UIName } from '../Core/UIMgr';

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

    /** 骑瓶左缘相对填充条前沿的偏移（参考图：前沿被瓶身压住一点） */
    private static readonly RIDER_LEAD = -8;
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
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
        this.alignCanvas();

        // 资源/音频节点切场景常驻（BGM 不断、已加载的贴图不丢）
        if (this.resNode) { director.addPersistRootNode(this.resNode); }

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

        // 资源加载（85%）→ UI 预制体预载（15%）→ 就绪
        const res = this.resNode ? (this.resNode.getComponent(Res) || this.resNode.addComponent(Res)) : Res.I;
        res.loadAll(() => {
            UIMgr.boot().preload([
                UIName.StartPage, UIName.SettingDialog, UIName.StatsDialog,
                UIName.AchDialog, UIName.OfflineDialog, UIName.ConfirmDialog,
            ], () => { this.target = 1; },
                (f) => { this.setProgress(0.85 + f * 0.15); });
        }, (f) => { this.setProgress(f * 0.85); });
    }

    /** 填充宽度 + 骑瓶位置（同旧 Boot.setFill：内槽左锚点坐标系） */
    private setFill(p: number) {
        const w = Math.max(6, p * this.innerW);
        const ut = this.fillBar.getComponent(UITransform);
        if (ut) { ut.setContentSize(w, ut.height); }
        this.bottleRider.setPosition(w + LoadScene.RIDER_LEAD + this.riderW / 2, this.bottleRider.position.y, 0);
    }

    private setProgress(f: number) {
        if (!isFinite(f)) { return; }
        if (f > this.target) { this.target = Math.min(1, f); }
    }

    update(dt: number) {
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
        // 防御：本组件不持有循环 tween，但保险起见停掉作用在自身节点上的所有 tween
        try { Tween.stopAllByTarget(this.node); } catch (e) { /* ignore */ }
    }
}

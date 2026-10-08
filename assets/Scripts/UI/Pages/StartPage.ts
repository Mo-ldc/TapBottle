import { _decorator, Label, Node, Sprite, Tween, tween, UITransform, Vec3, sys } from 'cc';
import { G } from '../../Core/State';
import { Res } from '../../Core/Res';
import { SAVE_KEY } from '../../Core/GameConfig';
import { clearSave, defaultSave } from '../../Core/Save';
import { t } from '../../Core/Locale';
import { UIBase } from '../Base/UIBase';
import { pressable, setFrame } from '../Base/UIKit';
import { UIMgr, UIName } from '../../Core/UIMgr';
import { LoadScene } from '../../Load/LoadScene';

const { ccclass, property } = _decorator;

/**
 * 标题页（美术底图 + 两个按钮）—— Load 场景里**按需加载**的预制体。
 *
 * 口径（用户拍板）：
 *   - 「开始游戏按钮」：无存档 → 新游戏；有存档 → 继续游戏（G.data 模块加载时已 loadSave）。
 *   - 「从新开始按钮」：删掉存档、回到全新状态再进游戏；**无存档时隐藏**。
 *   - 不再做「点屏幕任意处开始」——否则有存档的玩家永远点不到「从新开始」。
 *
 * 按钮 = 预制体里手摆的 Sprite 节点（开始游戏按钮 / 从新开始按钮），
 * 运行时按节点名接手（bindScene 同款约定，编辑器里随便改名要同步这里）。
 *
 * 流程：按钮 → startGame() →（从新开始则 clearSave + G.data=defaultSave）→
 *       `__tbOnStart`（BGM 借用户手势重播）→ LoadScene.enterGame() 切 Game 场景。
 *
 * ⚠️ 历史坑（Memory.md）：场景切换时 repeatForever 的 tween 不会自动停，
 *    StartPage 的 logo 浮动/呼吸动画都已在它自己的 onDisable 里停掉；
 *    本组件不持有任何循环 tween。
 */
@ccclass('StartPage')
export class StartPage extends UIBase {
    @property({ type: Node, tooltip: 'Logo（上下浮动）' })
    logo: Node = null!;

    @property({ type: Label, tooltip: '副标题：点瓶子 / IDLE FLIP GAME' })
    subTxt: Label = null!;

    @property({ type: Label, tooltip: '点击开始提示（呼吸缩放）' })
    tapTxt: Label = null!;

    private entered = false;

    init(_arg?: unknown): void {
        this.entered = false;
        const zh = G.lang === 'zh';
        if (this.subTxt && this.subTxt.isValid) {
            this.subTxt.string = zh ? '点 瓶 子' : 'IDLE FLIP GAME';
        }
        if (this.tapTxt && this.tapTxt.isValid) {
            this.tapTxt.string = zh ? '—— 点击屏幕开始 ——' : '—— Tap to Start ——';
        }
        this.bindButtons();
    }

    /** 按节点名接手预制体里的按钮（无存档 → 隐藏「从新开始」）。
     *  show 每次都会调它：显隐要按最新存档状态刷新；监听只挂一次（UIMgr 缓存实例，会叠加）。 */
    private bindButtons(): void {
        const startBtn = this.findDeep(this.node, '开始游戏按钮');
        const restartBtn = this.findDeep(this.node, '从新开始按钮');
        // ★ 用户口径（第三十三轮）：**设置入口在开始界面**（游戏里的左上按钮改成返回）。
        //   Load 场景的 UIMgr.bindRoots 把三个 root 都指到 pageRoot，所以弹窗直接开在这层。
        const setBtn = this.findDeep(this.node, '设置按钮');
        const hasSave = !!sys.localStorage.getItem(SAVE_KEY);
        if (restartBtn) { restartBtn.active = hasSave; }
        if (startBtn) { this.applyStartLabel(startBtn, hasSave); }
        if (startBtn && !(startBtn as any).__tbBound) {
            (startBtn as any).__tbBound = true;
            pressable(startBtn, () => this.startGame(false));
        }
        if (restartBtn && !(restartBtn as any).__tbBound) {
            (restartBtn as any).__tbBound = true;
            pressable(restartBtn, () => this.startGame(true));
        }
        if (setBtn && !(setBtn as any).__tbBound) {
            (setBtn as any).__tbBound = true;
            pressable(setBtn, () => {
                if (!this._shownOpen) { return; }
                UIMgr.I?.showDialog(UIName.SettingDialog);
            });
        }
        // ★ 权益水印：**开始界面不放触发点**（用户口径：开始界面的触发点不需要）。
        //   曾试过「订阅 / 分享」按钮长按，现全部移除；触发点只留在
        //   「游戏内顶栏筹码 ×2」+「成就/统计弹窗标题铭牌 ×2」共 4 处，见 Core/Wm.ts 顶部清单。
    }

    private findDeep(root: Node, name: string): Node | null {
        if (root.name === name) { return root; }
        for (const c of root.children) {
            const r = this.findDeep(c, name);
            if (r) { return r; }
        }
        return null;
    }

    /**
     * 第六十五轮：开始游戏按钮上的文字贴图（wzi01/02，按存档状态切换）。
     * - 无存档（第一次玩）→ wzi01「开始游戏」
     * - 有存档           → wzi02「继续游戏」
     * 按钮底板是预制体里烘好的 startUI/bd01；文字作为运行时子节点叠在板上，
     * 无监听子节点不参与事件分发，不影响 pressable 的点击。
     */
    private applyStartLabel(startBtn: Node, hasSave: boolean): void {
        let wzi = startBtn.getChildByName('wzi');
        if (!wzi) {
            // 只在**运行时现建**时给坐标；预制体里已存在的 wzi 一律以预制体坐标为准
            // （用户口径「以预制体为主」：编辑器里挪过的位置不能被代码顶回去）
            wzi = new Node('wzi');
            wzi.addComponent(UITransform);
            startBtn.addChild(wzi);
            wzi.addComponent(Sprite);
            wzi.setPosition(0, 0, 0);
        }
        const sp = wzi.getComponent(Sprite)!;
        // 先 CUSTOM 再赋 frame，防 sizeMode=TRIM 把节点尺寸改回原图（UIKit.setFrame 已内置）
        setFrame(sp, hasSave ? 'startUI/wzi02' : 'startUI/wzi01', hasSave ? 270 : 283, hasSave ? 81 : 99);
    }

    /** @param restart true = 删档重开；false = 有档继续 / 无档新游戏 */
    private startGame(restart: boolean): void {
        if (this.entered || !this._shownOpen) { return; }
        // ★ 第五十七轮：有存档的「从新开始」先弹二级确认，防误触（复用 ConfirmDialog，
        //   文案与设置弹窗的删档确认同款 delete_confirm）。取消则什么都不发生。
        if (restart) {
            UIMgr.I?.showDialog(UIName.ConfirmDialog, undefined, {
                text: t('delete_confirm', G.lang),
                question: t('delete_confirm_q', G.lang),
                danger: true,
                onOk: () => {
                    clearSave();
                    G.data = defaultSave();
                    this.enterGame();
                },
            });
            return;
        }
        this.enterGame();
    }

    /** 确认后真正的进入流程（BGM 借手势重播 + 切场景） */
    private enterGame(): void {
        if (this.entered || !this._shownOpen) { return; }
        this.entered = true;
        Res.I?.play('button');
        // BGM 必须借这次点击的手势重播，否则浏览器自动播放策略会挂起 AudioContext
        const hook = (globalThis as any).__tbOnStart;
        if (hook) { try { hook(); } catch (e) { /* ignore */ } }
        // 整页淡出后切到 Game 场景
        LoadScene.I?.enterGame();
    }

    protected onEnable(): void {
        this.playIdleAni();
    }

    protected onDisable(): void {
        this.stopIdleAni();
    }

    /** logo 上下浮动 + 点击提示呼吸（旧 DOM 层 tbBob / tbPulse 的等价物） */
    private playIdleAni(): void {
        if (this.logo && this.logo.isValid) {
            Tween.stopAllByTarget(this.logo);
            tween(this.logo).repeatForever(
                tween(this.logo)
                    .by(1.1, { position: new Vec3(0, 8, 0) })
                    .by(1.1, { position: new Vec3(0, -8, 0) })
            ).start();
        }
        if (this.tapTxt && this.tapTxt.isValid) {
            const n = this.tapTxt.node;
            Tween.stopAllByTarget(n);
            tween(n).repeatForever(
                tween(n).to(0.6, { scale: new Vec3(1.08, 1.08, 1) })
                    .to(0.55, { scale: new Vec3(1, 1, 1) })
            ).start();
        }
    }

    /**
     * ⚠️ repeatForever 的 tween 不会随节点销毁自动停 —— 后面 LoadScene 时它们会
     *    继续访问已失效节点，刷 `Cannot read properties of null (reading '_getUITransformComp')`
     *    甚至把场景切换拖崩。这里必须显式停。
     */
    private stopIdleAni(): void {
        try {
            if (this.logo) { Tween.stopAllByTarget(this.logo); }
            if (this.tapTxt) { Tween.stopAllByTarget(this.tapTxt.node); }
        } catch (e) { /* ignore */ }
    }

    /**
     * 是否已经真正显示出来（区别于 Component.enabled）。
     * 避免本项目常见的一个坑：prefab instantiate 后节点可能还没挂上父节点就被
     * 全局 input 事件命中 → 标题页刚加载就被「点掉」，玩家看不到标题。
     */
    private _shownOpen = false;

    show(cb?: () => void, arg?: unknown): void {
        super.show(cb, arg);
        this._shownOpen = true;
        this.bindButtons(); // show 时再绑一次：每次拉起都要按最新存档状态显隐
    }

    hide(cb?: () => void): void {
        this._shownOpen = false;
        super.hide(cb);
    }
}

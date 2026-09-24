import { _decorator, input, Input, Label, Node, Tween, tween, Vec3 } from 'cc';
import { G } from '../../../../Scripts/Core/State';
import { Res } from '../../../../Scripts/Core/Res';
import { UIBase } from '../../../../Scripts/UI/UIBase';
import { LoadScene } from '../../../../Scripts/Load/LoadScene';

const { ccclass, property } = _decorator;

/**
 * 标题页（logo + 游戏名 + 「点击开始」）—— Load 场景里**按需加载**的预制体。
 *
 * 流程：LoadScene 走完加载进度 → `UIMgr.showPage(UIName.StartPage)` 拉起本页；
 *      玩家点击 → 触发 `__tbOnStart`（BGM 必须借这次用户手势重播）→
 *      `LoadScene.enterGame()`：淡出并 director.loadScene('Game')。
 *
 * ⚠️ 全屏点击用全局 input 监听（不用遮罩点击）：
 *    Modal 计数只对游戏内的 BottleField 生效，全局 input 不受 BlockInputEvents 约束
 *    （见 Memory.md 的「全局 input 监听」坑），所以这里我们也不依赖 Modal。
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
    }

    protected onEnable(): void {
        this.playIdleAni();
        input.on(Input.EventType.TOUCH_START, this.onTap, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onTap, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onTap, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onTap, this);
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

    private onTap(): void {
        if (this.entered || !this._shownOpen) { return; }
        this.entered = true;
        Res.I?.play('button');
        // BGM 必须借这次点击的手势重播，否则浏览器自动播放策略会挂起 AudioContext
        const hook = (globalThis as any).__tbOnStart;
        if (hook) { try { hook(); } catch (e) { /* ignore */ } }
        // 不切「隐藏本页再揭加载层」了 —— Load 场景整页淡出后直接切到 Game 场景
        LoadScene.I?.enterGame();
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
    }

    hide(cb?: () => void): void {
        this._shownOpen = false;
        super.hide(cb);
    }
}

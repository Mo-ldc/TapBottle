import { input, sys } from 'cc';

/**
 * 编辑器「浏览器预览」输入修复垫片（只在预览页生效，构建产物零影响）。
 *
 * ★ 根因（2026-09-24 无头实测定位，详见 Memory 同日条目）：
 *   引擎 `pal/input/web/mouse-input.ts` 的构造函数在**模块求值时**执行
 *   `this._canvas = document.getElementById('GameCanvas')`；
 *   预览页的 canvas 插入 DOM 晚于引擎输入模块初始化 → `_canvas` 为 null →
 *   所有 `this._canvas?.addEventListener(...)` 被 `?.` **静默跳过** →
 *   预览里鼠标/触摸事件全灭（点什么都不响应，构建产物却一切正常）。
 *   证据：预览页 window 上有引擎无条件注册的 mousedown/mouseup 监听（构造确实跑过、
 *   EVENT_MOUSE=true），而 canvas 上 0 个监听器（CDP DOMDebugger 实测）。
 *
 *   修复：运行时把 canvas 补回 `mouseInput._canvas`，并手动挂上引擎本该挂的
 *   canvas 级监听（直接复用引擎构造时已创建的回调）。
 *   ⚠️ 不要重调 `_registerEvent()`：那会再注册一遍 window 级 mouseup，造成双发。
 *   ⚠️ 若未来编辑器修了时序，本垫片会造成 canvas 级双监听（与构建里
 *   window+canvas 双 mouseup 的引擎原生行为同级，风险可接受）；届时可删除本文件。
 */
export function installPreviewInputBridge(): void {
    const w = window as any;
    if (w.__tbPreviewInputBridge) { return; }
    w.__tbPreviewInputBridge = true;
    try {
        if (sys.platform !== sys.Platform.DESKTOP_BROWSER) { return; }
        const mi: any = (input as any)._mouseInput;
        if (!mi) { return; }
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement | null;
        if (!canvas) { return; }
        // 引擎构造时 canvas 为 null → 补上，_getLocation 的坐标换算才能正确
        mi._canvas = canvas;
        if (typeof mi._handleMouseDown !== 'function') { return; }
        canvas.addEventListener('mousedown', mi._handleMouseDown);
        canvas.addEventListener('mousemove', mi._handleMouseMove);
        canvas.addEventListener('mouseup', mi._handleMouseUp);
        canvas.addEventListener('wheel', (e: Event) => { mi._handleMouseWheel(e); });
        canvas.addEventListener('mouseleave', () => { mi._handleMouseLeave(); });
        canvas.addEventListener('mouseenter', () => { mi._handleMouseEnter(); });
    } catch (e) { /* 任何一步失败都保持静默，不影响正常构建 */ }
}

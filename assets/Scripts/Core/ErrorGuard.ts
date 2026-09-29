/**
 * ErrorGuard —— 无 adb 场景下的「测试机现场回收」三件套（2026-09-29，vivo 返回卡死排查）。
 *
 * 背景：vivo 测试机「瓶子较多时点返回按钮卡死」，本机没有 adb、抓不到 logcat；
 * 浏览器 console 也看不了。所以让游戏自己把现场带回屏幕：
 *
 * ① 全局异常浮层：window error / unhandledrejection → 屏幕顶部红字显示完整现场
 *    （异常文本 + 最近 30 条面包屑），同时存 localStorage.__tb_lasterr ——
 *    手机上截图就能拿到日志；即使页面被杀，下次启动还会先回放 12 秒「上次异常」。
 * ② 主循环看门狗：JS 心跳由引擎 update 每帧刷新（__tbHeart）；页面可见状态下
 *    心跳超时 6s = 真卡死（渲染死/异常打断主循环），浮层直接报「主循环停摆」。
 *    ⚠️ 纯 JS 死循环会把 setInterval 一起冻住，这种情况浮层无能为力 —— 但
 *    「引擎 update 链被异常打断、rAF 停止而定时器还活着」这类最常见卡死能抓到。
 * ③ WebGL context lost 自救：vivo/华为 webview 在内存压力下会杀 GL 上下文，
 *    引擎默认不恢复 → 表现就是永久黑屏/卡死。这里 preventDefault + 存档 + reload 整页。
 *
 * 接线：LoadScene.onLoad 与 GameRoot.onLoad 各调一次 installErrorGuard()（幂等）；
 * 心跳刷新在 GameRoot.update / LoadScene.update 里各置一行。
 * 面包屑：window.__tb_breadPush('...')（BottleField.sync 在瓶子总数变化时上报）。
 */

const GUARD_KEY = '__tbErrGuard';
const LS_KEY = '__tb_lasterr';

export function installErrorGuard(): void {
    const g = globalThis as any;
    if (g[GUARD_KEY]) { return; }
    g[GUARD_KEY] = true;

    const bread: string[] = [];
    const stamp = () => {
        const d = new Date();
        return d.getMinutes() + ':' + ('0' + d.getSeconds()).slice(-2);
    };
    const push = (msg: string) => {
        bread.push('[' + stamp() + '] ' + msg);
        if (bread.length > 30) { bread.shift(); }
    };
    g.__tb_breadPush = push;

    /** 只上屏（启动回放用，绝不落盘 —— 否则会覆盖还没看完的上次现场） */
    const paint = (text: string) => {
        try {
            let ov = document.getElementById('tb-err-ov');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'tb-err-ov';
                ov.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:2147483000;'
                    + 'background:rgba(122,0,0,.85);color:#fff;font:12px/1.5 monospace;'
                    + 'padding:8px 10px;white-space:pre-wrap;word-break:break-all;'
                    + 'max-height:42vh;overflow:hidden;pointer-events:none;';
                (document.body || document.documentElement).appendChild(ov);
            }
            ov.textContent = text.slice(-1600);
        } catch (e) { /* ignore */ }
    };
    /** 落盘 + 上屏 */
    const report = (head: string) => {
        const text = head + '\n' + bread.join('\n');
        try { localStorage.setItem(LS_KEY, new Date().toISOString() + '\n' + text); } catch (e) { /* ignore */ }
        paint(text);
    };
    g.__tb_report = (m: string) => report(m);

    window.addEventListener('error', (e) => {
        report('JS ERROR: ' + (e.message || 'unknown')
            + ' @' + (e.filename || '') + ':' + (e.lineno || 0));
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r: any = (e as PromiseRejectionEvent).reason;
        report('PROMISE REJECT: ' + ((r && (r.stack || r.message)) || String(r)));
    });

    // ③ WebGL 上下文丢失自救（不救 = vivo webview 上最常见的永久黑屏）
    try {
        const canvas: HTMLCanvasElement | undefined = (g.cc && g.cc.game && g.cc.game.canvas) || undefined;
        if (canvas && !(canvas as any).__tbCtxHook) {
            (canvas as any).__tbCtxHook = true;
            canvas.addEventListener('webglcontextlost', (ev: Event) => {
                ev.preventDefault();
                push('webglcontextlost');
                report('WebGL context LOST —— 3 秒后自动整页恢复（进度已定时存档）');
                setTimeout(() => { location.reload(); }, 3000);
            }, false);
        }
    } catch (e) { /* ignore */ }

    // ② 主循环看门狗
    if (g.__tbHeart === undefined) { g.__tbHeart = Date.now(); }
    setInterval(() => {
        try {
            if (document.visibilityState === 'visible' && Date.now() - g.__tbHeart > 6000) {
                report('主循环停摆 ' + ((Date.now() - g.__tbHeart) / 1000).toFixed(1) + 's（心跳超时）');
                g.__tbHeart = Date.now();   // 只报一次，别刷屏
            }
        } catch (e) { /* ignore */ }
    }, 3000);

    // 启动回放：上次有异常没看完 → 先显示 12 秒（只上屏，不覆盖存档）
    try {
        const last = localStorage.getItem(LS_KEY);
        if (last) {
            paint('上次异常回放：\n' + last);
            setTimeout(() => {
                const ov = document.getElementById('tb-err-ov');
                if (ov && ov.textContent && ov.textContent.indexOf('上次异常回放') === 0) { ov.remove(); }
            }, 12000);
        }
    } catch (e) { /* ignore */ }
}

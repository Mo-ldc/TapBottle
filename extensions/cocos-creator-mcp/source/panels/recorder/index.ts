const { createApp: createAppRec } = require("vue");

const panelDataMapRec = new WeakMap<any, any>();

module.exports = Editor.Panel.define({
    template: `
<div id="app">
    <h2>Preview Recorder</h2>

    <div class="controls">
        <button v-if="!recording" @click="start" class="btn btn-start">● 开始录制</button>
        <button v-else @click="stop" class="btn btn-stop" :disabled="stopping">■ 停止录制{{ stopping ? '中...' : '' }}</button>
        <button @click="screenshot" class="btn btn-shot" :disabled="shooting">📸 截图{{ shooting ? '中...' : '' }}</button>
    </div>

    <div v-if="recording" class="status-row">
        <span class="rec-dot">●</span> REC <strong>{{ elapsed }}s</strong>
        <span class="info">{{ recordingInfo }}</span>
    </div>

    <div class="section-title">录制设置</div>
    <div class="row">
        <label>FPS:</label>
        <input type="number" v-model.number="fps" :disabled="recording" min="10" max="60" />
        <label>格式:</label>
        <select v-model="format" :disabled="recording">
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
        </select>
    </div>
    <div class="row">
        <label>画质:</label>
        <select v-model="quality" @change="onQualityChange" :disabled="recording">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="ultra">最高</option>
            <option value="custom">自定义</option>
        </select>
        <label title="比特率 = 宽 × 高 × FPS × 质量系数">质量系数:</label>
        <input type="number" v-model.number="coefficient" @input="onCoefChange"
               :disabled="recording" min="0.01" max="2" step="0.01" class="custom-bitrate"
               title="比特率 = 宽 × 高 × FPS × 质量系数" />
        <button @click="resetQuality" class="btn btn-small" :disabled="recording" title="恢复录制设置为默认值">↺</button>
    </div>

    <div class="section-title">截图设置</div>
    <div class="row">
        <label>格式:</label>
        <select v-model="shotFormat" :disabled="shooting">
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
        </select>
    </div>

    <div class="section-title">保存位置</div>
    <div class="row">
        <input type="text" v-model="savePath" :disabled="recording" class="path-input" placeholder="temp/recordings" />
        <button @click="selectSaveFolder" class="btn btn-small" :disabled="recording">📁 选择</button>
        <button @click="resetSavePath" class="btn btn-small" :disabled="recording" title="恢复保存位置为默认值">↺</button>
    </div>
    <div class="row">
        <button @click="openSaveFolder" class="btn btn-small">📂 打开保存文件夹</button>
        <label class="checkbox-label" title="开启后，录制/截图保存时将 24 小时前的旧文件自动移动到 OLD_yyyyMM 文件夹"><input type="checkbox" v-model="autoArchive" @change="onAutoArchiveChange" /> 自动整理旧文件</label>
        <button class="btn btn-help" @click="showArchiveHelp = !showArchiveHelp" title="自动整理说明">?</button>
    </div>
    <div v-if="showArchiveHelp" class="help-box">
        <strong>关于自动整理</strong><br>
        开启后，每次录制或截图保存时，会将 24 小时以前的旧文件自动移动到<br>
        <code>OLD_yyyyMM/</code> 文件夹（例如: OLD_202604/）。<br>
        保存文件夹下只保留最近的文件，保持整洁有序。
    </div>

    <div v-if="lastResult" class="result" :class="lastError ? 'error' : 'success'">
        <div v-if="!lastError">
            <strong>✓ {{ lastResult.kind === 'shot' ? '截图已保存' : '录制完成' }}</strong><br>
            <code>{{ lastResult.path }}</code><br>
            {{ (lastResult.size / 1024).toFixed(1) }} KB
        </div>
        <div v-else>
            <strong>✗ 错误:</strong> {{ lastResult.error || lastResult.message || 'unknown' }}
        </div>
    </div>

    <div class="note">
        ※ 请在游戏预览运行时使用（需要 GameDebugClient）
    </div>
</div>
    `,
    style: `
#app { padding: 16px; font-family: sans-serif; color: #ccc; font-size: 12px; }
h2 { margin: 0 0 12px 0; font-size: 18px; }
.controls { margin: 12px 0; }
.btn {
    padding: 10px 20px;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
}
.btn:disabled { background: #555; color: #999; cursor: not-allowed; }
.btn-start { background: #d44; }
.btn-start:hover { background: #e55; }
.btn-stop { background: #888; }
.btn-stop:hover { background: #999; }
.btn-shot { background: #468; margin-left: 8px; }
.btn-shot:hover { background: #579; }
.section-title {
    margin-top: 14px;
    margin-bottom: 4px;
    padding: 4px 0 3px 0;
    font-size: 11px;
    font-weight: bold;
    color: #8af;
    border-bottom: 1px solid #333;
}
.btn-small {
    padding: 4px 10px;
    background: #4a8;
    font-size: 11px;
    margin-left: 8px;
    font-weight: normal;
}
.btn-small:hover { background: #5b9; }
.status-row { margin: 10px 0; font-size: 14px; }
.rec-dot { color: #f44; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.info { color: #888; font-size: 11px; margin-left: 8px; }
.row { margin: 10px 0; display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.row label { font-size: 12px; }
.row input { width: 60px; padding: 4px 8px; background: #222; color: #ccc; border: 1px solid #444; border-radius: 3px; }
.row select { padding: 4px 8px; background: #222; color: #ccc; border: 1px solid #444; border-radius: 3px; }
.path-input { flex: 1; min-width: 200px; width: auto !important; font-family: monospace; }
.custom-bitrate { width: 70px !important; }
.unit { font-size: 11px; color: #888; }
.result { margin: 12px 0; padding: 10px; border-radius: 4px; font-size: 12px; line-height: 1.5; }
.result.success { background: #1a3a1a; color: #afa; }
.result.error { background: #3a1a1a; color: #faa; }
.result code { font-size: 10px; word-break: break-all; background: #000; padding: 2px 4px; border-radius: 2px; }
.checkbox-label { font-size: 12px; display: flex; align-items: center; gap: 4px; margin-left: auto; cursor: pointer; }
.checkbox-label input[type="checkbox"] { cursor: pointer; }
.btn-help { padding: 2px 7px; background: #555; font-size: 11px; font-weight: bold; border-radius: 50%; min-width: 20px; margin-left: 4px; }
.btn-help:hover { background: #777; }
.help-box { margin: 8px 0; padding: 10px; background: #1a2a3a; border: 1px solid #345; border-radius: 4px; font-size: 11px; line-height: 1.6; color: #bcd; }
.help-box code { background: #000; padding: 1px 4px; border-radius: 2px; font-size: 10px; }
.note { margin-top: 16px; padding-top: 8px; border-top: 1px solid #333; font-size: 10px; color: #888; }
    `,
    $: { app: "#app" },
    ready() {
        if (!this.$.app) return;
        const MCP_BASE = "http://127.0.0.1:3000";
        const STORAGE_KEY = "cocos-mcp-recorder-settings";
        const PERSISTED_KEYS = ["fps", "quality", "coefficient", "format", "savePath", "shotFormat"];
        // 从 localStorage 读取设置
        const loadSettings = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch { return {}; }
        };
        const saved = loadSettings();
        // 从项目设置读取 autoArchiveRecordings
        const loadProjectConfig = () => {
            try {
                const fs = require("fs");
                const path = require("path");
                const p = path.join(Editor.Project.path, "settings", "cocos-creator-mcp.json");
                if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
            } catch { /* ignore */ }
            return {};
        };
        const projectCfg = loadProjectConfig();
        const app = createAppRec({
            data() {
                return {
                    recording: false,
                    stopping: false,
                    shooting: false,
                    elapsed: "0.0",
                    recordingInfo: "",
                    fps: saved.fps ?? 30,
                    quality: saved.quality ?? "medium",
                    coefficient: saved.coefficient ?? 0.25,
                    format: saved.format ?? "mp4",
                    savePath: saved.savePath ?? "temp/recordings",
                    shotFormat: saved.shotFormat ?? "png",
                    autoArchive: projectCfg.autoArchiveRecordings ?? false,
                    showArchiveHelp: false,
                    lastResult: null as any,
                    lastError: false,
                    _startTime: 0,
                    _timer: null as any,
                    _aliveCheckTimer: null as any,
                };
            },
            watch: {
                fps(this: any) { this.saveSettings(); },
                quality(this: any) { this.saveSettings(); },
                coefficient(this: any) { this.saveSettings(); },
                format(this: any) { this.saveSettings(); },
                savePath(this: any) { this.saveSettings(); },
                shotFormat(this: any) { this.saveSettings(); },
            },
            methods: {
                saveSettings(this: any) {
                    const data: any = {};
                    for (const key of PERSISTED_KEYS) data[key] = this[key];
                    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
                },
                async isPreviewRunning(this: any): Promise<boolean> {
                    try {
                        const res = await fetch(`${MCP_BASE}/mcp`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                jsonrpc: "2.0", id: 98, method: "tools/call",
                                params: {
                                    name: "debug_game_command",
                                    arguments: { type: "inspect", args: { name: "Canvas" }, timeout: 1500 },
                                },
                            }),
                        });
                        const json = await res.json();
                        const content = json.result?.content?.[0]?.text;
                        const parsed = content ? JSON.parse(content) : null;
                        return !!parsed?.success;
                    } catch {
                        return false;
                    }
                },
                async start(this: any) {
                    this.lastResult = null;
                    if (!await this.isPreviewRunning()) {
                        this.lastResult = { error: "游戏预览未在运行。请先启动预览再录制。" };
                        this.lastError = true;
                        return;
                    }
                    try {
                        const res = await fetch(`${MCP_BASE}/mcp`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                jsonrpc: "2.0",
                                id: 1,
                                method: "tools/call",
                                params: {
                                    name: "debug_record_start",
                                    arguments: {
                                        fps: this.fps,
                                        coefficient: this.coefficient,
                                        format: this.format,
                                        savePath: this.savePath,
                                    },
                                },
                            }),
                        });
                        const json = await res.json();
                        const content = json.result?.content?.[0]?.text;
                        const parsed = content ? JSON.parse(content) : null;
                        if (parsed?.success && parsed.data?.id) {
                            this.recording = true;
                            const d = parsed.data;
                            const mbps = d?.videoBitsPerSecond ? (d.videoBitsPerSecond / 1_000_000).toFixed(2) : "?";
                            this.recordingInfo = `${d?.canvasWidth || "?"}x${d?.canvasHeight || "?"} @ ${d?.fps || "?"}fps / ${mbps}Mbps / ${d?.mimeType || ""}`;
                            this._startTime = Date.now();
                            this._timer = setInterval(() => {
                                this.elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
                            }, 100);
                            // 预览停止检测轮询（每 2 秒）
                            this._aliveCheckTimer = setInterval(() => {
                                this.checkPreviewAlive();
                            }, 2000);
                        } else {
                            // 尽可能显示详细的错误信息
                            const errDetail = parsed?.data?.error
                                || parsed?.error
                                || (parsed?.data ? JSON.stringify(parsed.data) : null)
                                || (parsed ? JSON.stringify(parsed).substring(0, 200) : "no response")
                                || "录制启动失败";
                            this.lastResult = { error: errDetail };
                            this.lastError = true;
                        }
                    } catch (e: any) {
                        this.lastResult = { error: `通信错误: ${e.message}` };
                        this.lastError = true;
                    }
                },
                async stop(this: any) {
                    this.stopping = true;
                    try {
                        const res = await fetch(`${MCP_BASE}/mcp`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                jsonrpc: "2.0",
                                id: 2,
                                method: "tools/call",
                                params: {
                                    name: "debug_record_stop",
                                    arguments: { timeout: 60000 },
                                },
                            }),
                        });
                        const json = await res.json();
                        const content = json.result?.content?.[0]?.text;
                        const parsed = content ? JSON.parse(content) : null;
                        if (parsed?.success && parsed.data?.path) {
                            this.lastResult = { path: parsed.data.path, size: parsed.data.size };
                            this.lastError = false;
                        } else {
                            const errDetail = parsed?.data?.error
                                || parsed?.error
                                || (parsed?.data ? JSON.stringify(parsed.data) : null)
                                || "停止录制失败";
                            this.lastResult = { error: errDetail };
                            this.lastError = true;
                        }
                    } catch (e: any) {
                        this.lastResult = { error: `通信错误: ${e.message}` };
                        this.lastError = true;
                    } finally {
                        this.recording = false;
                        this.stopping = false;
                        if (this._timer) { clearInterval(this._timer); this._timer = null; }
                        if (this._aliveCheckTimer) { clearInterval(this._aliveCheckTimer); this._aliveCheckTimer = null; }
                    }
                },
                onQualityChange(this: any) {
                    const map: Record<string, number> = { low: 0.15, medium: 0.25, high: 0.40, ultra: 0.60 };
                    if (this.quality !== "custom") this.coefficient = map[this.quality];
                },
                onCoefChange(this: any) {
                    const map: Record<number, string> = { 0.15: "low", 0.25: "medium", 0.40: "high", 0.60: "ultra" };
                    this.quality = map[this.coefficient] || "custom";
                },
                resetQuality(this: any) {
                    this.fps = 30;
                    this.quality = "medium";
                    this.coefficient = 0.25;
                    this.format = "mp4";
                },
                resetSavePath(this: any) {
                    this.savePath = "temp/recordings";
                },
                onAutoArchiveChange(this: any) {
                    try {
                        const fs = require("fs");
                        const path = require("path");
                        const p = path.join(Editor.Project.path, "settings", "cocos-creator-mcp.json");
                        let cfg: any = {};
                        if (fs.existsSync(p)) cfg = JSON.parse(fs.readFileSync(p, "utf-8"));
                        cfg.autoArchiveRecordings = this.autoArchive;
                        const dir = path.dirname(p);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf-8");
                    } catch (e) {
                        console.warn("[recorder] 设置保存失败:", e);
                    }
                },
                async screenshot(this: any) {
                    this.shooting = true;
                    if (!await this.isPreviewRunning()) {
                        this.lastResult = { error: "游戏预览未在运行。请先启动预览再截图。" };
                        this.lastError = true;
                        this.shooting = false;
                        return;
                    }
                    try {
                        const res = await fetch(`${MCP_BASE}/mcp`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                jsonrpc: "2.0",
                                id: 3,
                                method: "tools/call",
                                params: {
                                    name: "debug_game_command",
                                    arguments: { type: "screenshot", args: {}, timeout: 5000, maxWidth: 0, imageFormat: this.shotFormat },
                                },
                            }),
                        });
                        const json = await res.json();
                        const content = json.result?.content?.[0]?.text;
                        const parsed = content ? JSON.parse(content) : null;
                        if (parsed?.success && parsed.path) {
                            // 复制到 savePath 目录下
                            const fs = require("fs");
                            const path = require("path");
                            const projectPath = Editor.Project.path;
                            let destDir = this.savePath || "temp/recordings";
                            if (!path.isAbsolute(destDir)) destDir = path.join(projectPath, destDir);
                            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                            const ts = new Date().toISOString().replace(/[:.]/g, "-");
                            const ext = path.extname(parsed.path) || ".png";
                            const destPath = path.join(destDir, `screenshot_${ts}${ext}`);
                            fs.copyFileSync(parsed.path, destPath);
                            // 按设置归档旧文件
                            try {
                                const settingsPath = path.join(projectPath, "settings", "cocos-creator-mcp.json");
                                if (fs.existsSync(settingsPath)) {
                                    const cfg = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
                                    if (cfg.autoArchiveRecordings) {
                                        const { archiveOldFiles } = require("../../archive");
                                        archiveOldFiles(destDir);
                                    }
                                }
                            } catch { /* ignore */ }
                            this.lastResult = { kind: "shot", path: destPath, size: parsed.size };
                            this.lastError = false;
                        } else {
                            const errDetail = parsed?.error || parsed?.message || "截图失败";
                            this.lastResult = { error: errDetail };
                            this.lastError = true;
                        }
                    } catch (e: any) {
                        this.lastResult = { error: `通信错误: ${e.message}` };
                        this.lastError = true;
                    } finally {
                        this.shooting = false;
                    }
                },
                async checkPreviewAlive(this: any) {
                    if (!this.recording) return;
                    try {
                        // 通过 MCP 发送轻量 inspect 命令
                        const res = await fetch(`${MCP_BASE}/mcp`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                jsonrpc: "2.0", id: 99, method: "tools/call",
                                params: {
                                    name: "debug_game_command",
                                    arguments: { type: "inspect", args: { name: "Canvas" }, timeout: 1500 },
                                },
                            }),
                        });
                        const json = await res.json();
                        const content = json.result?.content?.[0]?.text;
                        const parsed = content ? JSON.parse(content) : null;
                        if (parsed?.success) {
                            // 预览存活
                            return;
                        }
                        // 无响应 → 视为预览已停止，停止录制状态
                        console.warn("[PreviewRecorder] preview not responding, stopping recording state");
                        this.recording = false;
                        if (this._timer) { clearInterval(this._timer); this._timer = null; }
                        if (this._aliveCheckTimer) { clearInterval(this._aliveCheckTimer); this._aliveCheckTimer = null; }
                        this.lastResult = { error: "预览已停止，录制已中断（视频未保存）" };
                        this.lastError = true;
                    } catch (e) {
                        // 网络错误按通信错误忽略（可能是暂时的）
                    }
                },
                async selectSaveFolder(this: any) {
                    try {
                        const result = await (Editor.Dialog as any).select({
                            title: "选择保存文件夹",
                            type: "directory",
                            multi: false,
                        });
                        if (result?.filePaths?.length) {
                            const path = require("path");
                            const projectPath = Editor.Project.path;
                            const absPath = result.filePaths[0];
                            // 项目目录下则用相对路径保存
                            const relPath = path.relative(projectPath, absPath);
                            if (!relPath.startsWith("..") && !path.isAbsolute(relPath)) {
                                this.savePath = relPath.replace(/\\/g, "/");
                            } else {
                                this.savePath = absPath;
                            }
                        }
                    } catch (e: any) {
                        console.error("[PreviewRecorder] selectSaveFolder failed:", e);
                    }
                },
                openSaveFolder(this: any) {
                    const path = require("path");
                    const fs = require("fs");
                    const projectPath = Editor.Project.path;
                    let dir = this.savePath || "temp/recordings";
                    if (!path.isAbsolute(dir)) dir = path.join(projectPath, dir);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    try {
                        const { spawn } = require("child_process");
                        const platform = process.platform;
                        const [cmd, ...args] = platform === "win32"
                            ? ["explorer.exe", dir.replace(/\//g, "\\")]
                            : platform === "darwin"
                            ? ["open", dir]
                            : ["xdg-open", dir];
                        const p = spawn(cmd, args, { detached: true, stdio: "ignore" });
                        p.unref();
                    } catch (e: any) {
                        console.error("[PreviewRecorder] openSaveFolder failed:", e);
                        this.lastResult = { error: `无法打开文件夹: ${e.message}` };
                        this.lastError = true;
                    }
                },
                openFolder(this: any) {
                    if (!this.lastResult?.path) return;
                    const filePath = this.lastResult.path;
                    try {
                        const { shell } = require("electron");
                        if (shell?.showItemInFolder) {
                            shell.showItemInFolder(filePath);
                            return;
                        }
                    } catch (e) { /* fallback */ }
                    // 兜底：按操作系统执行命令
                    try {
                        const { exec } = require("child_process");
                        const platform = process.platform;
                        if (platform === "win32") {
                            exec(`explorer.exe /select,"${filePath.replace(/\//g, "\\")}"`);
                        } else if (platform === "darwin") {
                            exec(`open -R "${filePath}"`);
                        } else {
                            const dir = require("path").dirname(filePath);
                            exec(`xdg-open "${dir}"`);
                        }
                    } catch (e: any) {
                        console.error("[PreviewRecorder] openFolder failed:", e);
                    }
                },
            },
        });
        app.mount(this.$.app);
        panelDataMapRec.set(this, app);
    },
    beforeClose() { },
    close() {
        const app = panelDataMapRec.get(this);
        if (app) app.unmount();
        panelDataMapRec.delete(this);
    },
});

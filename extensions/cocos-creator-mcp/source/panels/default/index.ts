const { createApp } = require("vue");
const panelDataMap = new WeakMap<any, any>();
const EXT_NAME = "cocos-creator-mcp";
const fs = require("fs");
const path = require("path");

function contextFile(): string {
    return path.join(Editor.Project.path, "settings", "cocos-creator-mcp-context.json");
}

function readReferences(): any[] {
    try {
        const file = contextFile();
        if (!fs.existsSync(file)) return [];
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        return Array.isArray(data?.references) ? data.references : [];
    } catch { return []; }
}

function writeReferences(references: any[]): void {
    const file = contextFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ references }, null, 2), "utf8");
}

/** Cocos ui-kit 拖拽协议写入 dataTransfer 的自定义类型名（ui-drag-item 的 dragstart 设置）。 */
const COCOS_DT_TYPES = ["name", "value", "additional", "types"];

/** 在 drop 事件处理的同步阶段捕获 dataTransfer 全部数据。
 * Chromium 中 dataTransfer 在事件处理异步后（如 await 之后）会失效，getData 返回空、types 清空。 */
function captureDataTransfer(dt: DataTransfer | null): { types: string[]; values: Record<string, string> } {
    const types = dt ? Array.from(dt.types || []) : [];
    const values: Record<string, string> = {};
    for (const t of types) {
        try {
            const v = dt!.getData(t);
            if (v) values[t] = v;
        } catch { /* unsupported clipboard/drag type */ }
    }
    // 兜底：直接读 Cocos 已知类型（types 列表可能不完整）
    for (const t of COCOS_DT_TYPES) {
        if (values[t] !== undefined) continue;
        try {
            const v = dt!.getData(t);
            if (v) values[t] = v;
        } catch { /* unsupported */ }
    }
    return { types, values };
}

/** 主对象类型正则（节点/资产），用于从 additional 中排除组件子条目（cc.Sprite/cc.Button 等）。 */
const MAIN_OBJECT_TYPE_RE = /^cc\.(Node|Prefab|SceneAsset|Texture2D|SpriteFrame|AudioClip|AnimationClip|Material|Font|TTFFont|LabelAtlas|JsonAsset|TextAsset|SkeletonData|SpineSkeletonData|SpriteAtlas|TiledMapAsset|Mesh|ParticleSystemData|Asset)$/;

/** 从捕获的 dataTransfer 中提取拖拽【主对象】标识（uuid / db:// url），支持多选拖拽。
 * 收集协议字段 'value'（可能逗号分隔多个）与 'additional' 中的全部主对象条目（跳过组件子条目）。 */
function extractPrimaryIdFromDt(data: { types: string[]; values: Record<string, string> }): string[] {
    const ids: string[] = [];
    const addIfValid = (v: any) => {
        if (typeof v !== "string" || !v) return;
        for (const part of v.split(/[,;\s]+/).filter(Boolean)) {
            const m = part.match(/[A-Za-z0-9+/]{22}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
            if (m) ids.push(m[0]);
            else if (/^db:\/\//.test(part)) ids.push(part);
        }
    };
    addIfValid(data.values["value"]);
    try {
        const arr = JSON.parse(data.values["additional"] || "[]");
        if (Array.isArray(arr)) {
            let foundMain = false;
            for (const item of arr) {
                const t: string = item?.type || "";
                if (MAIN_OBJECT_TYPE_RE.test(t)) {
                    foundMain = true;
                    addIfValid(item?.value);
                }
            }
            // 兼容：additional 中无主类型条目时，退回第一个条目
            if (!foundMain && arr.length) addIfValid(arr[0]?.value);
        }
    } catch { /* additional 非 JSON */ }
    return [...new Set(ids)];
}

/** 多通道兜底：从 Cocos 当前选中对象解析 UUID（node 或 asset）。
 * 仅在 drag session 与 DOM DataTransfer 都拿不到数据时使用，避免误判。 */
function fallbackToEditorSelection(): string[] {
    try {
        // @cocos/creator-types 未收录这些运行时 API，此处通过 any 访问
        const sel: any = (Editor as any).Selection;
        const active = sel?.curGlobalActivate?.();
        const type: string = active?.type || "";
        const uuids: string[] = [];
        if (type === "node") uuids.push(...(sel?.curSelection?.("node") || []));
        else if (type === "asset") uuids.push(...(sel?.curSelection?.("asset") || []));
        if (uuids.length) console.log(`[cocos-creator-mcp] Resolved ${uuids.length} reference(s) from current selection (${type})`);
        return uuids;
    } catch (e: any) {
        console.warn("[cocos-creator-mcp] Editor.Selection fallback failed:", e?.message || String(e));
        return [];
    }
}

module.exports = Editor.Panel.define({
    template: `
<div id="app">
    <h2>Cocos Creator MCP</h2>
    <section class="reference-section">
        <div class="reference-label-row"><div class="reference-label">对象引用</div><button class="clear-btn" @click="clearAllReferences" title="清空所有对象引用">清空</button></div>
        <div class="reference-box" tabindex="0" :class="{ 'drag-active': dragActive }"
            @dragenter.prevent="onDragEnter" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop"
            @keydown.delete.prevent="removeLastReference" @keydown.backspace.prevent="removeLastReference">
            <span v-for="item in references" :key="item.id" class="reference-tag">@{{ item.name }}<button class="tag-note" @click.stop="startEditNote(item)" title="添加/编辑备注">✎</button><button class="tag-remove" @click.stop="removeReference(item.id)" title="移除此对象引用">×</button></span>
            <template v-for="item in references" :key="'n'+item.id"><span v-if="item.note" class="note-badge" :title="item.note">📝 {{ item.note }}</span></template>
            <span v-if="references.length === 0" class="reference-placeholder">将节点、预制体、场景或资源拖到这里</span>
            <span v-if="dragActive" class="drop-hint">松开以添加对象引用</span>
        </div>
        <div v-if="editingNoteId" class="note-editor">
            <span class="note-editor-label">备注（{{ editingNoteName }}）：</span>
            <input v-model="noteDraft" class="note-input" @keydown.enter.prevent="saveNote" @keydown.esc.prevent="cancelNoteEdit" @blur="saveNote" placeholder="输入你要对这个对象做什么..." />
            <button class="small-btn" @mousedown.prevent="saveNote">保存</button>
            <button class="small-btn" @mousedown.prevent="cancelNoteEdit">取消</button>
        </div>
        <div class="reference-tip">拖入后只记录 @对象名；点击 × 或在输入框中按 Delete / Backspace 仅移除引用，不会删除 Cocos 对象。</div>
        <div v-if="referenceMessage" class="reference-message">{{ referenceMessage }}</div>
    </section>
    <div class="status">服务状态：<strong :class="running ? 'on' : 'off'">{{ running ? '运行中' : '已停止' }}</strong></div>
    <div class="port-row"><label>端口：</label><input type="number" v-model.number="editPort" :disabled="running" min="1024" max="65535" /><button v-if="!running && editPort !== port" @click="applyPort" class="small-btn">应用</button></div>
    <div class="actions"><button v-if="!running" @click="start" class="action-btn">启动 MCP 服务</button><button v-if="running" @click="stop" class="action-btn stop-btn">停止 MCP 服务</button></div>
    <div v-if="running" class="info"><p>地址：<code>http://127.0.0.1:{{ port }}/mcp</code></p><p>工具数量：<strong>{{ toolCount }}</strong></p></div>
    <div v-if="error" class="error">{{ error }}</div>
</div>`,
    style: `
#app { padding:12px;font-family:sans-serif;color:#ccc;font-size:12px;overflow-y:auto; } h2 { margin:0 0 10px;font-size:16px; }
.reference-section { margin:10px 0 14px; }.reference-label-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:5px; }.reference-label { color:#9fd0ff;font-weight:bold; }.clear-btn { padding:1px 8px;border:1px solid #5a7a92;border-radius:3px;background:#2b4a61;color:#b9d9ed;cursor:pointer;font-size:10px; }.clear-btn:hover { background:#3f6685;color:#fff; }
.reference-box { display:flex;min-height:52px;padding:7px;flex-wrap:wrap;align-content:center;gap:6px;outline:none;border:1px dashed #50708a;border-radius:5px;background:#192631;cursor:copy; }.reference-box:focus { border-color:#6fc3ff;box-shadow:0 0 0 2px rgba(111,195,255,.24); }.reference-box.drag-active { border-color:#7bd3ff;background:#24465e;box-shadow:0 0 0 2px rgba(111,195,255,.35); }
.reference-tag { display:inline-flex;align-items:center;max-width:220px;padding:3px 5px 3px 7px;border:1px solid #477da1;border-radius:12px;background:#27516e;color:#d9f0ff;font-size:12px;word-break:break-all; }.tag-note { width:18px;height:18px;margin-left:2px;border:0;border-radius:50%;background:transparent;color:#9fc9e3;cursor:pointer;font-size:12px;line-height:16px; }.tag-note:hover { background:#3f6685;color:#fff; }.tag-remove { width:16px;height:16px;margin-left:4px;border:0;border-radius:50%;background:transparent;color:#b9d9ed;cursor:pointer;font-size:15px;line-height:14px; }.tag-remove:hover { background:#a34a4a;color:#fff; }.note-badge { display:inline-block;max-width:220px;padding:1px 6px;border:1px solid #6a6a3a;border-radius:4px;background:#3a3a1a;color:#e3e3a0;font-size:10px;word-break:break-all; }.reference-placeholder { align-self:center;color:#8799a7; }.drop-hint { align-self:center;color:#d8f2ff;font-weight:bold; }.note-editor { margin:6px 0 0;padding:6px 8px;background:#223342;border:1px solid #3a5a75;border-radius:4px;display:flex;align-items:center;gap:6px; }.note-editor-label { color:#9fd0ff;font-size:11px;white-space:nowrap; }.note-input { flex:1;min-width:0;padding:3px 6px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;font-size:11px; }.reference-tip { margin-top:5px;color:#8195a4;font-size:10px;line-height:1.45; }.reference-message { margin-top:4px;color:#8fe39e;font-size:11px; }
.status { margin:8px 0; }.on { color:#4f4; }.off { color:#f66; }.port-row { margin:8px 0;display:flex;align-items:center;gap:8px; }.port-row input { width:80px;padding:3px 6px;background:#222;color:#ccc;border:1px solid #444;border-radius:3px;font-size:12px; }.port-row input:disabled { opacity:.5; }.actions { margin:8px 0; }.action-btn,.small-btn { padding:4px 9px;border:1px solid #4c7594;border-radius:3px;background:#315b78;color:#e4f3ff;cursor:pointer;font-size:11px; }.action-btn:hover,.small-btn:hover { background:#40789d; }.stop-btn { border-color:#8b5858;background:#6d3b3b; }.stop-btn:hover { background:#8b4a4a; }.info { margin:8px 0;padding:8px;background:var(--color-normal-fill-emphasis);border-radius:4px; }.info p { margin:4px 0; }.info code { background:#333;padding:2px 6px;border-radius:3px;font-size:11px; }.error { margin:8px 0;color:#f66; }`,
    $: { app: "#app" },
    ready() {
        if (!this.$.app) return;
        const app = createApp({
            data() { return { running:false,port:3000,editPort:3000,toolCount:0,error:"",references:[] as any[],dragActive:false,dragDepth:0,referenceMessage:"",editingNoteId:"",editingNoteName:"",noteDraft:"" }; },
            methods: {
                async refresh(this:any) { try { const s=await Editor.Message.request(EXT_NAME,"get-server-status"); this.running=s.running;this.port=s.port;this.editPort=s.port;this.toolCount=s.toolCount;this.references=readReferences(); } catch(e:any) { console.warn("[cocos-creator-mcp] panel refresh failed:",e); } },
                async start(this:any) { try { this.error="";const r=await Editor.Message.request(EXT_NAME,"start-server");this.running=r.running;this.port=r.port;this.editPort=r.port;await this.refresh(); } catch(e:any) { this.error=e.message||String(e); } },
                async stop(this:any) { try { await Editor.Message.request(EXT_NAME,"stop-server");this.running=false;this.toolCount=0; } catch(e:any) { this.error=e.message||String(e); } },
                async applyPort(this:any) { try { this.error="";const r=await Editor.Message.request(EXT_NAME,"update-port",this.editPort);this.port=r.port;this.running=r.running;await this.refresh(); } catch(e:any) { this.error=e.message||String(e); } },
                onDragEnter(this:any,e:DragEvent) { e.preventDefault();this.dragDepth++;this.dragActive=true; }, onDragOver(this:any,e:DragEvent) { e.preventDefault();if(e.dataTransfer){e.dataTransfer.dropEffect="copy";}this.dragActive=true; },
                onDragLeave(this:any,e:DragEvent) { e.preventDefault();this.dragDepth=Math.max(0,this.dragDepth-1);if(!this.dragDepth)this.dragActive=false; },
                async onDrop(this:any,e:DragEvent) {
                    e.preventDefault();this.dragDepth=0;this.dragActive=false;this.referenceMessage="";
                    // 必须在事件处理同步阶段捕获 dataTransfer（await 后 dataTransfer 会失效）
                    const dtCaptured=captureDataTransfer(e.dataTransfer);
                    // 主通道：同步捕获的 dataTransfer（Cocos ui-kit 协议，主对象 value/additional）
                    let draggedUuids=extractPrimaryIdFromDt(dtCaptured);
                    // 兜底：Editor.Selection（覆盖无 DataTransfer 的场景）
                    if(!draggedUuids.length) draggedUuids=fallbackToEditorSelection();
                    if(!draggedUuids.length) { this.referenceMessage="未收到 Cocos 拖拽对象信息，请重试或先选中对象再拖拽。";console.warn("[cocos-creator-mcp] Drop ignored: no identifiable object from drag payload / dataTransfer / selection");return; }
                    const refs=readReferences();let added=0,duplicates=0,invalid=0;
                    for(const uuid of draggedUuids) {
                        try {
                            const nodeResult=await Editor.Message.request("scene","execute-scene-script",{name:EXT_NAME,method:"getSelectedNodeDetails",args:[uuid]});
                            if(nodeResult?.success&&nodeResult?.data?.uuid) {
                                const n=nodeResult.data;const item={id:`node:${n.uuid}`,kind:"node",uuid:n.uuid,name:n.name,path:n.path||n.name,type:"node",components:(n.components||[]).map((c:any)=>c.type),addedAt:new Date().toISOString()};const index=refs.findIndex((x:any)=>x.id===item.id);
                                if(index>=0) { duplicates++;console.warn(`[cocos-creator-mcp] 重复节点引用已跳过：uuid=${item.uuid}，name=${item.name}`); } else { refs.push(item);added++; }
                                continue;
                            }
                            const info=await Editor.Message.request("asset-db","query-asset-info",uuid);
                            if(!info||!info.uuid||!info.url) { invalid++;console.warn(`[cocos-creator-mcp] 无效拖拽对象已跳过：uuid=${uuid}；既不是有效场景节点也不是有效资源`);continue; }
                            const item={id:`asset:${info.uuid}`,kind:"asset",uuid:info.uuid,name:info.name||"未命名资源",path:info.url,type:info.type||info.importer||"asset",addedAt:new Date().toISOString()};const index=refs.findIndex((x:any)=>x.id===item.id);
                            if(index>=0) { duplicates++;console.warn(`[cocos-creator-mcp] 重复资源引用已跳过：uuid=${item.uuid}，name=${item.name}`); } else { refs.push(item);added++; }
                        } catch(error:any) { invalid++;console.warn(`[cocos-creator-mcp] 无效拖拽对象已跳过：uuid=${uuid}；错误=${error?.message||String(error)}`); }
                    }
                    writeReferences(refs);
                    await this.refresh();const summary:string[]=[];if(added)summary.push(`新增 ${added} 个`);if(duplicates)summary.push(`重复跳过 ${duplicates} 个`);if(invalid)summary.push(`无效跳过 ${invalid} 个`);this.referenceMessage=summary.length?summary.join("，")+"对象引用。":"对象已在引用列表中，已刷新其后台信息。";
                },
                async removeReference(this:any,id:string) { const refs=readReferences().filter((item:any)=>item.id!==id);writeReferences(refs);await this.refresh();this.referenceMessage="对象引用已移除；Cocos 对象未被删除。"; },
                async removeLastReference(this:any) { const last=this.references[this.references.length-1];if(last)await this.removeReference(last.id); },
                async clearAllReferences(this:any) { writeReferences([]);this.editingNoteId="";this.editingNoteName="";this.noteDraft="";await this.refresh();this.referenceMessage="已清空所有对象引用；Cocos 对象未被删除。"; },
                startEditNote(this:any,item:any) { this.editingNoteId=item.id;this.editingNoteName=item.name;this.noteDraft=item.note||""; },
                async saveNote(this:any) {
                    if(!this.editingNoteId) return;
                    const id=this.editingNoteId;
                    const note=(this.noteDraft||"").trim();
                    const refs=readReferences().map((r:any)=>r.id===id?{...r,note:note||undefined}:r);
                    writeReferences(refs);
                    this.editingNoteId="";this.editingNoteName="";this.noteDraft="";
                    await this.refresh();
                    this.referenceMessage=note?"备注已保存，新任务读取引用时可见。":"备注已清除。";
                },
                cancelNoteEdit(this:any) { this.editingNoteId="";this.editingNoteName="";this.noteDraft=""; },
            },
            async mounted(this:any) { await this.refresh(); },
        });
        app.mount(this.$.app);panelDataMap.set(this,app);
    },
    close() { const app=panelDataMap.get(this);if(app)app.unmount(); },
});

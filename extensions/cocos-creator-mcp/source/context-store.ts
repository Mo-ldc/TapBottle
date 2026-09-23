import fs from "fs";
import path from "path";

export interface EditorContextItem {
    id: string;
    name: string;
    kind: "node" | "asset";
    uuid: string;
    path: string;
    type?: string;
    components?: string[];
    note?: string; // 开发者对该对象操作意图的备注（面板 ✎ 编辑）
    addedAt: string;
}

function storePath(): string {
    return path.join(Editor.Project.path, "settings", "cocos-creator-mcp-context.json");
}

function readStore(): EditorContextItem[] {
    try {
        const file = storePath();
        if (!fs.existsSync(file)) return [];
        const value = JSON.parse(fs.readFileSync(file, "utf8"));
        return Array.isArray(value?.references) ? value.references : [];
    } catch (e) {
        console.warn("[cocos-creator-mcp] Failed to read editor context:", e);
        return [];
    }
}

function writeStore(items: EditorContextItem[]): void {
    const file = storePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ references: items }, null, 2), "utf8");
}

function makeId(item: Omit<EditorContextItem, "id" | "addedAt">): string {
    return `${item.kind}:${item.uuid}`;
}

/** Adds or refreshes a panel @object reference. It never changes the Cocos object. */
export function addEditorContext(item: Omit<EditorContextItem, "id" | "addedAt">): EditorContextItem {
    const items = readStore();
    const id = makeId(item);
    const existing = items.find((entry) => entry.id === id);
    if (existing) {
        Object.assign(existing, item, { addedAt: new Date().toISOString() });
        writeStore(items);
        return existing;
    }
    const entry: EditorContextItem = { ...item, id, addedAt: new Date().toISOString() };
    items.push(entry);
    writeStore(items);
    return entry;
}

/** Removes only the panel reference tag; the original Cocos node/asset is untouched. */
export function removeEditorContext(id: string): boolean {
    const items = readStore();
    const index = items.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    items.splice(index, 1);
    writeStore(items);
    return true;
}

export function getEditorContext(): EditorContextItem[] {
    return readStore();
}

export function clearEditorContext(): void {
    writeStore([]);
}

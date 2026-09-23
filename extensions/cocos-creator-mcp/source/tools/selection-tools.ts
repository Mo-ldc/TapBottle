import { ToolCategory, ToolDefinition, ToolResult } from "../types";
import { ok, err } from "../tool-base";

const EXT_NAME = "cocos-creator-mcp";

type SelectionScope = "node" | "asset" | "all";

/**
 * Read-only access to the objects selected in the Cocos Creator editor.
 * Selection belongs to the editor main process, while node details are
 * resolved by the extension's scene script.
 */
export class SelectionTools implements ToolCategory {
    readonly categoryName = "selection";

    getTools(): ToolDefinition[] {
        return [{
            name: "editor_selection",
            description: "Read the objects currently selected in the Cocos Creator editor. Returns selected scene nodes with hierarchy paths and component summaries, selected assets with asset metadata, or both. This tool is read-only.",
            inputSchema: {
                type: "object",
                properties: {
                    scope: {
                        type: "string",
                        enum: ["node", "asset", "all"],
                        description: "Selection to read: 'node' (default), 'asset', or 'all'.",
                    },
                },
            },
        }];
    }

    async execute(toolName: string, args: Record<string, any>): Promise<ToolResult> {
        if (toolName !== "editor_selection") return err(`Unknown tool: ${toolName}`);

        const scope: SelectionScope = args.scope || "node";
        if (scope !== "node" && scope !== "asset" && scope !== "all") {
            return err("editor_selection: 'scope' must be 'node', 'asset', or 'all'.");
        }

        try {
            const result: Record<string, any> = { success: true, scope };
            if (scope === "node" || scope === "all") result.nodes = await this.getNodes();
            if (scope === "asset" || scope === "all") result.assets = await this.getAssets();
            return ok(result);
        } catch (e: any) {
            return err(e?.message || String(e));
        }
    }

    private getSelected(type: "node" | "asset"): string[] {
        const selection = (Editor as any).Selection;
        if (!selection?.getSelected) {
            throw new Error("Editor.Selection.getSelected is unavailable in this Cocos Creator version.");
        }
        const uuids = selection.getSelected(type);
        return Array.isArray(uuids) ? uuids : [];
    }

    private async getNodes(): Promise<any[]> {
        const uuids = this.getSelected("node");
        return Promise.all(uuids.map(async (uuid) => {
            const info = await (Editor.Message.request as any)("scene", "execute-scene-script", {
                name: EXT_NAME,
                method: "getSelectedNodeDetails",
                args: [uuid],
            });
            return info?.success ? info.data : { uuid, error: info?.error || "Node is no longer available" };
        }));
    }

    private async getAssets(): Promise<any[]> {
        const uuids = this.getSelected("asset");
        return Promise.all(uuids.map(async (uuid) => {
            try {
                const info = await (Editor.Message.request as any)("asset-db", "query-asset-info", uuid);
                return {
                    uuid,
                    name: info?.name ?? null,
                    url: info?.url ?? null,
                    type: info?.type ?? info?.importer ?? null,
                    isSubAsset: info?.isSubAsset ?? false,
                };
            } catch (e: any) {
                return { uuid, error: e?.message || String(e) };
            }
        }));
    }
}

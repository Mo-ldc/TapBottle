import { ToolCategory, ToolDefinition, ToolResult } from "../types";
import { ok, err } from "../tool-base";
import { clearEditorContext, getEditorContext } from "../context-store";

/** Read-only lookup for @object references placed in the MCP panel. */
export class ContextTools implements ToolCategory {
    readonly categoryName = "context";

    getTools(): ToolDefinition[] {
        return [{
            name: "editor_context",
            description: "Read the hidden object references (@name tags) added through the Cocos Creator MCP panel. Returns exact object UUIDs, paths, types, and node components for the agent to resolve a user's @object request. Action 'list' is read-only; action 'clear' removes only panel reference tags, never Cocos objects.",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["list", "clear"], description: "'list' (default) reads @object references; 'clear' removes all reference tags only." },
                },
            },
        }];
    }

    async execute(toolName: string, args: Record<string, any>): Promise<ToolResult> {
        if (toolName !== "editor_context") return err(`Unknown tool: ${toolName}`);
        const action = args.action || "list";
        if (action === "list") return ok({ success: true, references: getEditorContext() });
        if (action === "clear") {
            clearEditorContext();
            return ok({ success: true, cleared: true, note: "Only panel @object references were removed; no Cocos node or asset was changed." });
        }
        return err("editor_context: action must be 'list' or 'clear'.");
    }
}

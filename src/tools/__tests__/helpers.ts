import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;

/**
 * McpServer mock: captures registered tool handlers so tests can call them directly.
 */
export function createMockServer(): { server: McpServer; callTool: (name: string, args: Record<string, unknown>) => Promise<string> } {
  const handlers = new Map<string, ToolHandler>();

  const server = {
    tool(name: string, _desc: string, _schema: unknown, handler: ToolHandler) {
      handlers.set(name, handler);
    },
  } as unknown as McpServer;

  async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const handler = handlers.get(name);
    if (!handler) throw new Error(`Tool not registered: ${name}`);
    const result = await handler(args);
    return result.content.map((c) => c.text).join("");
  }

  return { server, callTool };
}

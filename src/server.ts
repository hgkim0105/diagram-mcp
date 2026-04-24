import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export const server = new McpServer({
  name: "diagram-mcp",
  version: "1.0.0",
});

registerAllTools(server);

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUtilityTools } from "./utility.js";
import { registerMermaidTools } from "./mermaid.js";
import { registerPlantUMLTools } from "./plantuml.js";
import { registerGraphvizTools } from "./graphviz.js";
import { registerChartTools } from "./charts.js";

export function registerAllTools(server: McpServer): void {
  registerUtilityTools(server);
  registerMermaidTools(server);
  registerPlantUMLTools(server);
  registerGraphvizTools(server);
  registerChartTools(server);
}

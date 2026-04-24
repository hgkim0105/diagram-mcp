import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function wrap(syntax: string): string {
  return `\`\`\`dot\n${syntax.trim()}\n\`\`\``;
}

function formatAttrs(attrs: Record<string, string>): string {
  const pairs = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return pairs ? ` [${pairs}]` : "";
}

// ── 스키마 ─────────────────────────────────────────────────────────────────────

const GvNode = z.object({
  id: z.string().describe("노드 고유 ID (공백없이)"),
  label: z.string().optional().describe("노드 표시 텍스트. 없으면 id 사용"),
  shape: z
    .enum(["box", "circle", "ellipse", "diamond", "hexagon", "parallelogram", "triangle", "cylinder", "note", "oval"])
    .optional()
    .describe("노드 모양"),
  style: z.string().optional().describe("스타일. 예: filled, dashed, rounded"),
  fillcolor: z.string().optional().describe("배경색. 예: lightblue, #f0f0f0"),
  color: z.string().optional().describe("테두리 색"),
  fontcolor: z.string().optional().describe("글자 색"),
});

const GvEdge = z.object({
  from: z.string().describe("출발 노드 ID"),
  to: z.string().describe("도착 노드 ID"),
  label: z.string().optional().describe("엣지 레이블"),
  style: z.enum(["solid", "dashed", "dotted", "bold", "invis"]).optional().describe("선 스타일"),
  color: z.string().optional().describe("선 색"),
  arrowhead: z
    .enum(["normal", "vee", "dot", "odot", "none", "diamond", "box"])
    .optional()
    .describe("화살표 모양"),
});

const GraphAttrs = z
  .record(z.string())
  .optional()
  .describe(
    "그래프 전역 속성. 예: {\"rankdir\": \"LR\", \"splines\": \"ortho\", \"bgcolor\": \"white\"}"
  );

// ── 공통 빌더 ─────────────────────────────────────────────────────────────────

function buildGraph(
  graphType: "digraph" | "graph",
  nodes: z.infer<typeof GvNode>[],
  edges: z.infer<typeof GvEdge>[],
  graphAttrs?: Record<string, string>,
  title?: string
): string {
  const edgeOp = graphType === "digraph" ? "->" : "--";
  const lines: string[] = [`${graphType} G {`];

  // 전역 속성
  if (graphAttrs && Object.keys(graphAttrs).length > 0) {
    for (const [k, v] of Object.entries(graphAttrs)) {
      lines.push(`  ${k}="${v}"`);
    }
  }
  if (title) lines.push(`  label="${title}"\n  labelloc="t"\n  fontsize="16"`);
  lines.push(`  node [fontname="Arial" fontsize="12"]`);
  lines.push(`  edge [fontname="Arial" fontsize="11"]`);

  // 노드
  for (const n of nodes) {
    const attrs: Record<string, string> = {};
    if (n.label) attrs["label"] = n.label;
    if (n.shape) attrs["shape"] = n.shape;
    if (n.style) attrs["style"] = n.style;
    if (n.fillcolor) attrs["fillcolor"] = n.fillcolor;
    if (n.color) attrs["color"] = n.color;
    if (n.fontcolor) attrs["fontcolor"] = n.fontcolor;
    lines.push(`  ${n.id}${formatAttrs(attrs)}`);
  }

  // 엣지
  for (const e of edges) {
    const attrs: Record<string, string> = {};
    if (e.label) attrs["label"] = e.label;
    if (e.style && e.style !== "solid") attrs["style"] = e.style;
    if (e.color) attrs["color"] = e.color;
    if (e.arrowhead) attrs["arrowhead"] = e.arrowhead;
    lines.push(`  ${e.from} ${edgeOp} ${e.to}${formatAttrs(attrs)}`);
  }

  lines.push("}");
  return lines.join("\n");
}

// ── 도구 등록 ─────────────────────────────────────────────────────────────────

export function registerGraphvizTools(server: McpServer): void {
  // ─── 1. Directed Graph (Digraph) ──────────────────────────────────────────
  server.tool(
    "generate_graphviz_digraph",
    "Graphviz 방향 그래프(Digraph)를 생성합니다. " +
      "서비스 의존성, 데이터 파이프라인, DAG, 네트워크 토폴로지 표현에 적합합니다. " +
      "graph_attrs 예시: {\"rankdir\": \"LR\"}(좌→우), {\"rankdir\": \"TB\"}(위→아래). " +
      "노드 모양: box(기본), circle, diamond, cylinder(DB), hexagon, note. " +
      "노드에 style=filled + fillcolor 지정으로 색상 채우기 가능.",
    {
      nodes: z.array(GvNode).describe("노드 목록"),
      edges: z.array(GvEdge).describe("엣지 목록 (방향 있음 →)"),
      graph_attrs: GraphAttrs,
      title: z.string().optional().describe("그래프 제목"),
    },
    async ({ nodes, edges, graph_attrs, title }) => {
      const dot = buildGraph("digraph", nodes, edges, graph_attrs, title);
      return { content: [{ type: "text" as const, text: wrap(dot) }] };
    }
  );

  // ─── 2. Undirected Graph ──────────────────────────────────────────────────
  server.tool(
    "generate_graphviz_graph",
    "Graphviz 무방향 그래프를 생성합니다. " +
      "네트워크 연결, 관계 맵, 클러스터 표현에 적합합니다. " +
      "방향이 없는 -- 엣지를 사용합니다. " +
      "노드/엣지 속성은 generate_graphviz_digraph와 동일.",
    {
      nodes: z.array(GvNode).describe("노드 목록"),
      edges: z.array(GvEdge).describe("엣지 목록 (방향 없음 --)"),
      graph_attrs: GraphAttrs,
      title: z.string().optional().describe("그래프 제목"),
    },
    async ({ nodes, edges, graph_attrs, title }) => {
      const dot = buildGraph("graph", nodes, edges, graph_attrs, title);
      return { content: [{ type: "text" as const, text: wrap(dot) }] };
    }
  );
}

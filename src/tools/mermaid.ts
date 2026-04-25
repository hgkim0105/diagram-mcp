import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderViaKroki, getPngUrl } from "../lib/kroki.js";

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────────────

function wrap(syntax: string): string {
  return `\`\`\`mermaid\n${syntax.trim()}\n\`\`\``;
}

async function toOutput(syntax: string, format: string): Promise<string> {
  if (format === "svg") return renderViaKroki("mermaid", syntax);
  if (format === "png_url") return getPngUrl("mermaid", syntax);
  return wrap(syntax);
}

const OutputFormat = z
  .enum(["markdown", "svg", "png_url"])
  .optional()
  .default("markdown")
  .describe("출력 포맷. markdown=마크다운 코드블록(기본), svg=SVG (HTML/PDF용), png_url=PNG 이미지 URL (Slack/Discord용)");

function escapeLabel(label: string): string {
  return label.replace(/"/g, "&quot;").replace(/[[\]{}()]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function nodeShape(id: string, label: string, shape?: string): string {
  const l = escapeLabel(label);
  switch (shape) {
    case "diamond":       return `${id}{${l}}`;
    case "circle":        return `${id}((${l}))`;
    case "stadium":       return `${id}([${l}])`;
    case "parallelogram": return `${id}[/${l}/]`;
    case "hexagon":       return `${id}{{${l}}}`;
    case "cylinder":      return `${id}[(${l})]`;
    default:              return `${id}[${l}]`;
  }
}

function edgeArrow(label?: string, style?: string): string {
  if (style === "dotted") return label ? `-.->|${label}|` : "-.->";
  if (style === "thick")  return label ? `==>|${label}|` : "==>";
  return label ? `-->|${label}|` : "-->";
}

function msgArrow(type?: string): string {
  switch (type) {
    case "return":       return "-->>";
    case "async":        return "-)";
    case "async_return": return "--)";
    default:             return "->>";
  }
}

function classRelArrow(type?: string): string {
  switch (type) {
    case "inheritance":  return "--|>";
    case "realization":  return "..|>";
    case "composition":  return "*--";
    case "aggregation":  return "o--";
    case "dependency":   return "..>";
    default:             return "-->";
  }
}

function mindmapLines(nodes: MindmapNode[], depth: number): string {
  return nodes
    .map((n) => {
      const indent = "  ".repeat(depth);
      let line: string;
      switch (n.shape) {
        case "circle":  line = `${indent}((${n.text}))`; break;
        case "square":  line = `${indent}[${n.text}]`;   break;
        case "rounded": line = `${indent}(${n.text})`;   break;
        case "bang":    line = `${indent})${n.text}(`;   break;
        case "cloud":   line = `${indent})${n.text})`;   break;
        default:        line = `${indent}${n.text}`;
      }
      const kids =
        n.children && n.children.length > 0
          ? "\n" + mindmapLines(n.children, depth + 1)
          : "";
      return line + kids;
    })
    .join("\n");
}

interface MindmapNode {
  text: string;
  shape?: string;
  children?: MindmapNode[];
}

// ── 스키마 정의 ────────────────────────────────────────────────────────────────

const FlowNode = z.object({
  id: z.string().describe("노드 고유 ID (공백 없이)"),
  label: z.string().describe("노드에 표시할 텍스트"),
  shape: z
    .enum(["rect", "diamond", "circle", "stadium", "parallelogram", "hexagon", "cylinder"])
    .optional()
    .describe("노드 모양. 기본값 rect(사각형)"),
});

const FlowEdge = z.object({
  from: z.string().describe("출발 노드 ID"),
  to: z.string().describe("도착 노드 ID"),
  label: z.string().optional().describe("엣지 레이블"),
  style: z.enum(["solid", "dotted", "thick"]).optional().describe("선 스타일"),
});

const SeqMessage = z.object({
  from: z.string().describe("발신 참여자 이름"),
  to: z.string().describe("수신 참여자 이름"),
  text: z.string().describe("메시지 내용"),
  type: z
    .enum(["sync", "return", "async", "async_return"])
    .optional()
    .describe("메시지 타입. sync=실선화살표, return=점선화살표, async=비동기"),
});

const ClassDef = z.object({
  name: z.string().describe("클래스 이름"),
  attributes: z.array(z.string()).optional().describe("속성 목록. 예: ['+name: String', '-age: int']"),
  methods: z.array(z.string()).optional().describe("메서드 목록. 예: ['+speak(): void']"),
});

const ClassRel = z.object({
  from: z.string().describe("관계 출발 클래스"),
  to: z.string().describe("관계 도착 클래스"),
  type: z
    .enum(["inheritance", "realization", "composition", "aggregation", "association", "dependency"])
    .optional()
    .describe("관계 타입"),
  label: z.string().optional().describe("관계 레이블"),
});

const EREntity = z.object({
  name: z.string().describe("엔티티 이름 (대문자 권장)"),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        key: z.enum(["PK", "FK", "UK"]).optional(),
      })
    )
    .optional()
    .describe("컬럼 목록"),
});

const ERRel = z.object({
  from: z.string().describe("관계 출발 엔티티"),
  to: z.string().describe("관계 도착 엔티티"),
  label: z.string().describe("관계 동사 (예: places, contains)"),
  from_card: z
    .enum(["||", "o|", "|{", "o{"])
    .optional()
    .describe("출발 카디널리티. || 정확히1, o| 0또는1, |{ 1이상, o{ 0이상"),
  to_card: z
    .enum(["||", "o|", "|{", "o{"])
    .optional()
    .describe("도착 카디널리티"),
});

const GanttTask = z.object({
  name: z.string().describe("태스크 이름"),
  status: z
    .enum(["done", "active", "crit", "milestone"])
    .optional()
    .describe("태스크 상태"),
  start: z.string().optional().describe("시작일 (YYYY-MM-DD) 또는 after 태스크이름"),
  duration: z.string().optional().describe("기간. 예: 7d, 2w"),
});

const MindmapNodeSchema: z.ZodType<MindmapNode> = z.lazy(() =>
  z.object({
    text: z.string().describe("노드 텍스트"),
    shape: z
      .enum(["default", "circle", "square", "rounded", "bang", "cloud"])
      .optional()
      .describe("노드 모양"),
    children: z.array(MindmapNodeSchema).optional().describe("하위 노드 목록"),
  })
);

// ── 도구 등록 ─────────────────────────────────────────────────────────────────

export function registerMermaidTools(server: McpServer): void {
  // ─── 1. Flowchart ──────────────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_flowchart",
    "구조화된 데이터로 Mermaid 플로우차트를 생성합니다. " +
      "프로세스 흐름, 의사결정 트리, 워크플로우 표현에 사용하세요. " +
      "노드 모양: rect(사각형), diamond(마름모/조건), circle(원), stadium(알약), cylinder(DB). " +
      "엣지 스타일: solid(실선), dotted(점선), thick(굵은선).",
    {
      nodes: z.array(FlowNode).describe("노드 목록"),
      edges: z.array(FlowEdge).describe("엣지 목록"),
      direction: z
        .enum(["TD", "LR", "BT", "RL"])
        .optional()
        .describe("흐름 방향. TD=위→아래(기본), LR=왼→오른, BT=아래→위, RL=오른→왼"),
      title: z.string().optional().describe("다이어그램 제목"),
      output_format: OutputFormat,
    },
    async ({ nodes, edges, direction = "TD", title, output_format = "markdown" }) => {
      const lines: string[] = [`flowchart ${direction}`];
      if (title) lines.push(`  ---\n  title: ${title}\n  ---`);

      for (const n of nodes) {
        lines.push(`  ${nodeShape(n.id, n.label, n.shape)}`);
      }
      for (const e of edges) {
        lines.push(`  ${e.from} ${edgeArrow(e.label, e.style)} ${e.to}`);
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 2. Sequence Diagram ───────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_sequence",
    "Mermaid 시퀀스 다이어그램을 생성합니다. " +
      "API 호출 흐름, 시스템 간 통신, 인증 플로우 표현에 적합합니다. " +
      "메시지 타입: sync(동기호출/실선), return(응답/점선), async(비동기), async_return(비동기응답).",
    {
      participants: z.array(z.string()).describe("참여자 이름 목록 (표시 순서대로)"),
      messages: z.array(SeqMessage).describe("메시지 목록"),
      title: z.string().optional().describe("다이어그램 제목"),
      output_format: OutputFormat,
    },
    async ({ participants, messages, title, output_format = "markdown" }) => {
      const lines: string[] = ["sequenceDiagram"];
      if (title) lines.push(`  title ${title}`);
      for (const p of participants) lines.push(`  participant ${p}`);
      for (const m of messages) {
        lines.push(`  ${m.from}${msgArrow(m.type)}${m.to}: ${m.text}`);
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 3. Class Diagram ──────────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_class",
    "Mermaid 클래스 다이어그램을 생성합니다. " +
      "OOP 설계, 도메인 모델 표현에 적합합니다. " +
      "속성/메서드 가시성: +(public), -(private), #(protected), ~(package). " +
      "관계 타입: inheritance(상속), realization(구현), composition(합성), aggregation(집합), association(연관), dependency(의존).",
    {
      classes: z.array(ClassDef).describe("클래스 목록"),
      relationships: z.array(ClassRel).describe("관계 목록"),
      output_format: OutputFormat,
    },
    async ({ classes, relationships, output_format = "markdown" }) => {
      const lines: string[] = ["classDiagram"];
      for (const c of classes) {
        lines.push(`  class ${c.name} {`);
        for (const a of c.attributes ?? []) lines.push(`    ${a}`);
        for (const m of c.methods ?? []) lines.push(`    ${m}`);
        lines.push("  }");
      }
      for (const r of relationships) {
        const arrow = classRelArrow(r.type);
        const lbl = r.label ? ` : ${r.label}` : "";
        lines.push(`  ${r.from} ${arrow} ${r.to}${lbl}`);
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 4. ER Diagram ─────────────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_er",
    "Mermaid ER 다이어그램을 생성합니다. " +
      "데이터베이스 스키마, 엔티티 관계 설계에 적합합니다. " +
      "카디널리티: ||=정확히1, o|=0또는1, |{=1이상, o{=0이상. " +
      "컬럼 키: PK(기본키), FK(외래키), UK(유니크).",
    {
      entities: z.array(EREntity).describe("엔티티 목록"),
      relationships: z.array(ERRel).describe("관계 목록"),
      output_format: OutputFormat,
    },
    async ({ entities, relationships, output_format = "markdown" }) => {
      const lines: string[] = ["erDiagram"];
      for (const r of relationships) {
        const fc = r.from_card ?? "||";
        const tc = r.to_card ?? "o{";
        lines.push(`  ${r.from} ${fc}--${tc} ${r.to} : ${r.label}`);
      }
      for (const e of entities) {
        if (!e.attributes?.length) continue;
        lines.push(`  ${e.name} {`);
        for (const a of e.attributes) {
          const key = a.key ? ` ${a.key}` : "";
          lines.push(`    ${a.type} ${a.name}${key}`);
        }
        lines.push("  }");
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 5. Gantt Chart ────────────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_gantt",
    "Mermaid 간트 차트를 생성합니다. " +
      "프로젝트 일정, 태스크 기간, 마일스톤 표현에 적합합니다. " +
      "태스크 상태: done(완료), active(진행중), crit(중요), milestone(마일스톤). " +
      "기간 형식: 7d(7일), 2w(2주). 시작일: YYYY-MM-DD 또는 'after 태스크이름'.",
    {
      title: z.string().describe("차트 제목"),
      sections: z
        .array(
          z.object({
            name: z.string().describe("섹션 이름"),
            tasks: z.array(GanttTask).describe("태스크 목록"),
          })
        )
        .describe("섹션 목록"),
      date_format: z.string().optional().describe("날짜 형식. 기본값 YYYY-MM-DD"),
      output_format: OutputFormat,
    },
    async ({ title, sections, date_format = "YYYY-MM-DD", output_format = "markdown" }) => {
      const lines: string[] = ["gantt", `  title ${title}`, `  dateFormat ${date_format}`];
      for (const sec of sections) {
        lines.push(`  section ${sec.name}`);
        for (const t of sec.tasks) {
          const parts: string[] = [];
          if (t.status) parts.push(t.status);
          if (t.start) parts.push(t.start);
          if (t.duration) parts.push(t.duration);
          lines.push(`    ${t.name} :${parts.join(", ")}`);
        }
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 6. Pie Chart ──────────────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_pie",
    "Mermaid 파이 차트를 생성합니다. " +
      "비율, 구성 비교, 데이터 분포 표현에 적합합니다. " +
      "value는 숫자(비율 자동 계산됨).",
    {
      title: z.string().describe("차트 제목"),
      slices: z
        .array(
          z.object({
            label: z.string().describe("슬라이스 레이블"),
            value: z.number().describe("수치값 (비율 자동 계산됨)"),
          })
        )
        .describe("슬라이스 목록"),
      output_format: OutputFormat,
    },
    async ({ title, slices, output_format = "markdown" }) => {
      const lines: string[] = [`pie title ${title}`];
      for (const s of slices) {
        lines.push(`  "${s.label}" : ${s.value}`);
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 7. Mindmap ────────────────────────────────────────────────────────────
  server.tool(
    "generate_mermaid_mindmap",
    "Mermaid 마인드맵을 생성합니다. " +
      "계층적 아이디어, 개념 구조, 브레인스토밍 결과 표현에 적합합니다. " +
      "children은 재귀적으로 중첩 가능. " +
      "루트/노드 모양: circle(원), square(사각형), rounded(둥근사각형), cloud(구름), bang(폭발형).",
    {
      root: z.string().describe("루트 노드 텍스트"),
      root_shape: z
        .enum(["default", "circle", "square", "rounded", "bang", "cloud"])
        .optional()
        .describe("루트 노드 모양. 기본값 circle"),
      children: z.array(MindmapNodeSchema).describe("1단계 하위 노드 목록 (재귀 중첩 가능)"),
      output_format: OutputFormat,
    },
    async ({ root, root_shape = "circle", children, output_format = "markdown" }) => {
      const rootNode = nodeForMindmap(root, root_shape);
      const lines: string[] = ["mindmap", `  ${rootNode}`];
      if (children.length > 0) {
        lines.push(mindmapLines(children, 2));
      }

      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );
}

function nodeForMindmap(text: string, shape?: string): string {
  switch (shape) {
    case "circle":  return `((${text}))`;
    case "square":  return `[${text}]`;
    case "rounded": return `(${text})`;
    case "bang":    return `)${text}(`;
    case "cloud":   return `)${text})`;
    default:        return `((${text}))`;
  }
}

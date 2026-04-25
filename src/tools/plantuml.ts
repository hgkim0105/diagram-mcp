import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderViaKroki, getPngUrl } from "../lib/kroki.js";

function wrap(syntax: string): string {
  return `\`\`\`plantuml\n${syntax.trim()}\n\`\`\``;
}

async function toOutput(syntax: string, format: string): Promise<string> {
  if (format === "svg") return renderViaKroki("plantuml", syntax);
  if (format === "png_url") return getPngUrl("plantuml", syntax);
  return wrap(syntax);
}

const OutputFormat = z
  .enum(["markdown", "svg", "png_url"])
  .optional()
  .default("markdown")
  .describe("출력 포맷. markdown=마크다운 코드블록(기본), svg=SVG (HTML/PDF용), png_url=PNG 이미지 URL (Slack/Discord용)");

function msgArrow(type?: string): string {
  switch (type) {
    case "return":       return "-->";
    case "async":        return "->>";
    case "async_return": return "-->>";
    default:             return "->";
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

// ── 스키마 ─────────────────────────────────────────────────────────────────────

const Participant = z.object({
  type: z
    .enum(["actor", "participant", "boundary", "control", "entity", "database", "collections", "queue"])
    .optional()
    .describe("참여자 타입. 기본값 participant"),
  name: z.string().describe("참여자 이름 (표시명)"),
  alias: z.string().optional().describe("참여자 별칭 (공백 있는 이름에 사용)"),
});

const SeqMessage = z.object({
  from: z.string().describe("발신자 이름 또는 별칭"),
  to: z.string().describe("수신자 이름 또는 별칭"),
  text: z.string().describe("메시지 내용"),
  type: z
    .enum(["sync", "return", "async", "async_return"])
    .optional()
    .describe("메시지 타입. sync=실선, return=점선응답, async=비동기"),
  note: z.string().optional().describe("이 메시지 위에 표시할 노트"),
});

const ClassDef = z.object({
  name: z.string().describe("클래스 이름"),
  stereotype: z.string().optional().describe("스테레오타입. 예: interface, abstract, service"),
  attributes: z.array(z.string()).optional().describe("속성. 예: +name: String"),
  methods: z.array(z.string()).optional().describe("메서드. 예: +speak(): void"),
});

const ClassRel = z.object({
  from: z.string().describe("출발 클래스"),
  to: z.string().describe("도착 클래스"),
  type: z
    .enum(["inheritance", "realization", "composition", "aggregation", "association", "dependency"])
    .optional()
    .describe("관계 타입"),
  label: z.string().optional().describe("관계 레이블"),
  from_label: z.string().optional().describe("출발쪽 카디널리티. 예: 1, *"),
  to_label: z.string().optional().describe("도착쪽 카디널리티. 예: 1, *, 0..n"),
});

const Component = z.object({
  type: z
    .enum(["component", "interface", "database", "cloud", "node", "frame", "package", "queue", "storage", "actor"])
    .optional()
    .describe("컴포넌트 타입. 기본값 component"),
  name: z.string().describe("컴포넌트 이름"),
  id: z.string().optional().describe("참조용 ID (공백없이). 없으면 name 사용"),
});

const Connection = z.object({
  from: z.string().describe("출발 컴포넌트 ID 또는 이름"),
  to: z.string().describe("도착 컴포넌트 ID 또는 이름"),
  label: z.string().optional().describe("연결 레이블"),
  style: z.enum(["solid", "dotted"]).optional().describe("선 스타일"),
});

const State = z.object({
  name: z.string().describe("상태 이름"),
  description: z.string().optional().describe("상태 설명 (상태 내부에 표시)"),
});

const Transition = z.object({
  from: z.string().describe("출발 상태. '[*]'는 시작/종료 의사상태"),
  to: z.string().describe("도착 상태. '[*]'는 시작/종료 의사상태"),
  label: z.string().optional().describe("전이 트리거/조건"),
});

// ── 도구 등록 ─────────────────────────────────────────────────────────────────

export function registerPlantUMLTools(server: McpServer): void {
  // ─── 1. Sequence Diagram ───────────────────────────────────────────────────
  server.tool(
    "generate_plantuml_sequence",
    "PlantUML 시퀀스 다이어그램을 생성합니다. " +
      "actor, database 등 다양한 참여자 타입을 지원합니다. " +
      "Mermaid 시퀀스보다 표현력이 풍부하고 노트/그룹화 기능이 있습니다. " +
      "참여자 타입: actor, participant, boundary, control, entity, database, collections, queue.",
    {
      participants: z.array(Participant).describe("참여자 목록"),
      messages: z.array(SeqMessage).describe("메시지 목록"),
      title: z.string().optional().describe("다이어그램 제목"),
      output_format: OutputFormat,
    },
    async ({ participants, messages, title, output_format = "markdown" }) => {
      const lines: string[] = ["@startuml"];
      if (title) lines.push(`title ${title}`);

      for (const p of participants) {
        const pType = p.type ?? "participant";
        const alias = p.alias ? ` as ${p.alias}` : "";
        const nameStr = p.name.includes(" ") ? `"${p.name}"` : p.name;
        lines.push(`${pType} ${nameStr}${alias}`);
      }

      for (const m of messages) {
        if (m.note) lines.push(`note over ${m.from}: ${m.note}`);
        lines.push(`${m.from} ${msgArrow(m.type)} ${m.to} : ${m.text}`);
      }

      lines.push("@enduml");
      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 2. Class Diagram ──────────────────────────────────────────────────────
  server.tool(
    "generate_plantuml_class",
    "PlantUML 클래스 다이어그램을 생성합니다. " +
      "스테레오타입(interface, abstract, service 등)을 지원합니다. " +
      "속성/메서드 가시성: +(public), -(private), #(protected), ~(package). " +
      "관계 타입: inheritance(상속), realization(구현), composition(합성), aggregation(집합), association(연관), dependency(의존). " +
      "카디널리티 표기: from_label, to_label으로 '1', '*', '0..n' 등 지정.",
    {
      classes: z.array(ClassDef).describe("클래스 목록"),
      relationships: z.array(ClassRel).describe("관계 목록"),
      title: z.string().optional().describe("다이어그램 제목"),
      output_format: OutputFormat,
    },
    async ({ classes, relationships, title, output_format = "markdown" }) => {
      const lines: string[] = ["@startuml"];
      if (title) lines.push(`title ${title}`);

      for (const c of classes) {
        const stereo = c.stereotype ? ` <<${c.stereotype}>>` : "";
        lines.push(`class ${c.name}${stereo} {`);
        for (const a of c.attributes ?? []) lines.push(`  ${a}`);
        for (const m of c.methods ?? []) lines.push(`  ${m}`);
        lines.push("}");
      }

      for (const r of relationships) {
        const arrow = classRelArrow(r.type);
        const fl = r.from_label ? ` "${r.from_label}"` : "";
        const tl = r.to_label ? ` "${r.to_label}"` : "";
        const lbl = r.label ? ` : ${r.label}` : "";
        lines.push(`${r.from}${fl} ${arrow}${tl} ${r.to}${lbl}`);
      }

      lines.push("@enduml");
      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 3. Component Diagram ─────────────────────────────────────────────────
  server.tool(
    "generate_plantuml_component",
    "PlantUML 컴포넌트 다이어그램을 생성합니다. " +
      "시스템 아키텍처, 서비스 의존 관계, 인프라 구조 표현에 적합합니다. " +
      "컴포넌트 타입: component(기본), interface, database, cloud, node, frame, package, queue, storage, actor.",
    {
      components: z.array(Component).describe("컴포넌트 목록"),
      connections: z.array(Connection).describe("연결 목록"),
      title: z.string().optional().describe("다이어그램 제목"),
      output_format: OutputFormat,
    },
    async ({ components, connections, title, output_format = "markdown" }) => {
      const lines: string[] = ["@startuml"];
      if (title) lines.push(`title ${title}`);

      for (const c of components) {
        const id = c.id ?? c.name.replace(/\s+/g, "_");
        const nameStr = c.name.includes(" ") ? `"${c.name}"` : c.name;
        const cType = c.type ?? "component";

        if (cType === "component") {
          lines.push(`[${c.name}] as ${id}`);
        } else if (cType === "interface") {
          lines.push(`interface ${nameStr} as ${id}`);
        } else if (cType === "database") {
          lines.push(`database ${nameStr} as ${id}`);
        } else if (cType === "cloud") {
          lines.push(`cloud ${nameStr} as ${id}`);
        } else if (cType === "node") {
          lines.push(`node ${nameStr} as ${id}`);
        } else if (cType === "queue") {
          lines.push(`queue ${nameStr} as ${id}`);
        } else if (cType === "storage") {
          lines.push(`storage ${nameStr} as ${id}`);
        } else if (cType === "actor") {
          lines.push(`actor ${nameStr} as ${id}`);
        } else {
          lines.push(`${cType} ${nameStr} as ${id}`);
        }
      }

      for (const conn of connections) {
        const arrow = conn.style === "dotted" ? "..>" : "-->";
        const lbl = conn.label ? ` : ${conn.label}` : "";
        lines.push(`${conn.from} ${arrow} ${conn.to}${lbl}`);
      }

      lines.push("@enduml");
      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );

  // ─── 4. State Diagram ─────────────────────────────────────────────────────
  server.tool(
    "generate_plantuml_state",
    "PlantUML 상태 다이어그램을 생성합니다. " +
      "상태 머신, 비즈니스 프로세스, 객체 라이프사이클 표현에 적합합니다. " +
      "'[*]'를 from/to로 지정하면 시작/종료 의사상태로 연결됩니다.",
    {
      states: z.array(State).describe("상태 목록"),
      transitions: z.array(Transition).describe("전이 목록"),
      title: z.string().optional().describe("다이어그램 제목"),
      output_format: OutputFormat,
    },
    async ({ states, transitions, title, output_format = "markdown" }) => {
      const lines: string[] = ["@startuml"];
      if (title) lines.push(`title ${title}`);

      for (const s of states) {
        if (s.description) {
          lines.push(`state "${s.name}" as ${s.name.replace(/\s+/g, "_")} : ${s.description}`);
        }
      }

      for (const t of transitions) {
        const lbl = t.label ? ` : ${t.label}` : "";
        lines.push(`${t.from} --> ${t.to}${lbl}`);
      }

      lines.push("@enduml");
      return { content: [{ type: "text" as const, text: await toOutput(lines.join("\n"), output_format) }] };
    }
  );
}

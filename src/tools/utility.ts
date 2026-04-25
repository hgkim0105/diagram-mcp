import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderViaKroki, getPngUrl, type KrokiDiagramType } from "../lib/kroki.js";

const KROKI_TYPES: Record<string, KrokiDiagramType> = {
  mermaid: "mermaid",
  plantuml: "plantuml",
  dot: "graphviz",
  graphviz: "graphviz",
};

const SUPPORTED_TYPES = [
  {
    name: "Mermaid Flowchart",
    type: "mermaid_flowchart",
    tool: "generate_mermaid_flowchart",
    description: "노드와 엣지로 구성된 흐름도. 프로세스, 의사결정, 워크플로우 표현에 적합",
    example: "flowchart TD\n  A[시작] --> B{조건}\n  B -->|참| C[처리]\n  B -->|거짓| D[종료]",
  },
  {
    name: "Mermaid Sequence Diagram",
    type: "mermaid_sequence",
    tool: "generate_mermaid_sequence",
    description: "참여자 간의 시간 순서 메시지 흐름. API 호출, 시스템 간 통신 표현에 적합",
    example: "sequenceDiagram\n  User->>Server: POST /login\n  Server-->>User: JWT token",
  },
  {
    name: "Mermaid Class Diagram",
    type: "mermaid_class",
    tool: "generate_mermaid_class",
    description: "클래스, 속성, 메서드, 상속 관계 표현. OOP 설계에 적합",
    example: "classDiagram\n  class Animal {\n    +String name\n    +speak() void\n  }\n  Dog --|> Animal",
  },
  {
    name: "Mermaid ER Diagram",
    type: "mermaid_er",
    tool: "generate_mermaid_er",
    description: "엔티티와 관계 표현. 데이터베이스 스키마 설계에 적합",
    example: "erDiagram\n  USER ||--o{ ORDER : places\n  USER { int id PK\n  string name }",
  },
  {
    name: "Mermaid Gantt Chart",
    type: "mermaid_gantt",
    tool: "generate_mermaid_gantt",
    description: "프로젝트 일정, 태스크 기간, 마일스톤 표현",
    example: "gantt\n  title 프로젝트\n  dateFormat YYYY-MM-DD\n  section 1단계\n    설계 :done, 2024-01-01, 7d",
  },
  {
    name: "Mermaid Pie Chart",
    type: "mermaid_pie",
    tool: "generate_mermaid_pie",
    description: "비율/구성 표현. 간단한 데이터 분포 시각화에 적합",
    example: 'pie title 언어 분포\n  "Python" : 45.5\n  "TypeScript" : 30.2',
  },
  {
    name: "Mermaid Mindmap",
    type: "mermaid_mindmap",
    tool: "generate_mermaid_mindmap",
    description: "계층적 아이디어 구조 표현. 브레인스토밍, 개념 정리에 적합",
    example: "mindmap\n  root((주제))\n    브랜치A\n      잎1\n    브랜치B",
  },
  {
    name: "PlantUML Sequence",
    type: "plantuml_sequence",
    tool: "generate_plantuml_sequence",
    description: "actor, database 등 다양한 참여자 타입 지원하는 시퀀스 다이어그램",
    example: "@startuml\nactor User\nparticipant API\nUser -> API : 요청\nAPI --> User : 응답\n@enduml",
  },
  {
    name: "PlantUML Class",
    type: "plantuml_class",
    tool: "generate_plantuml_class",
    description: "PlantUML 기반 클래스 다이어그램. 가시성 수정자 지원",
    example: "@startuml\nclass Animal {\n  +name: String\n  +speak(): void\n}\n@enduml",
  },
  {
    name: "PlantUML Component",
    type: "plantuml_component",
    tool: "generate_plantuml_component",
    description: "시스템 컴포넌트, 인터페이스, 의존성 표현. 아키텍처 다이어그램에 적합",
    example: "@startuml\n[Frontend] --> [Backend] : HTTPS\ndatabase DB\n[Backend] --> DB\n@enduml",
  },
  {
    name: "PlantUML State",
    type: "plantuml_state",
    tool: "generate_plantuml_state",
    description: "상태 머신, 상태 전이 표현",
    example: "@startuml\n[*] --> Idle\nIdle --> Running : start()\nRunning --> [*]\n@enduml",
  },
  {
    name: "Graphviz Digraph",
    type: "graphviz_digraph",
    tool: "generate_graphviz_digraph",
    description: "방향 그래프. 의존성, 네트워크 토폴로지, DAG 표현에 적합",
    example: 'digraph G {\n  rankdir=LR\n  A [label="서비스A"]\n  A -> B [label="호출"]\n}',
  },
  {
    name: "Graphviz Graph",
    type: "graphviz_graph",
    tool: "generate_graphviz_graph",
    description: "무방향 그래프. 네트워크, 관계 표현에 적합",
    example: 'graph G {\n  A [label="노드A"]\n  A -- B\n}',
  },
  {
    name: "Bar Chart (SVG)",
    type: "bar_chart",
    tool: "generate_bar_chart",
    description: "막대 차트. 카테고리별 수치 비교에 적합. SVG로 직접 렌더링",
    example: '{ "title": "월별 매출", "data": [{"month":"1월","value":1200}], "x_field":"month", "y_field":"value" }',
  },
  {
    name: "Line Chart (SVG)",
    type: "line_chart",
    tool: "generate_line_chart",
    description: "선 차트. 시계열 데이터, 추세 표현에 적합. SVG로 직접 렌더링",
    example: '{ "title": "성장 추이", "data": [{"date":"1월","users":100}], "x_field":"date", "y_field":"users" }',
  },
  {
    name: "Scatter Plot (SVG)",
    type: "scatter_plot",
    tool: "generate_scatter_plot",
    description: "산점도. 두 수치 변수의 상관관계 표현. SVG로 직접 렌더링",
    example: '{ "title": "비용 vs 성능", "data": [{"cost":1.2,"score":85}], "x_field":"cost", "y_field":"score" }',
  },
];

export function registerUtilityTools(server: McpServer): void {
  // ─────────────────────────────────────────────
  // render_diagram: 기존 문법을 마크다운 코드블록으로 포매팅
  // ─────────────────────────────────────────────
  server.tool(
    "render_diagram",
    "이미 작성된 다이어그램 문법을 포매팅하거나 SVG로 렌더링합니다. " +
      "Mermaid, PlantUML, Graphviz DOT 등 직접 작성한 문법이 있을 때 사용하세요. " +
      "output_format=svg 지정 시 Kroki API를 통해 실제 SVG 이미지로 변환합니다. " +
      "diagram_type: mermaid | plantuml | dot | graphviz | d2 | 기타",
    {
      diagram_type: z
        .string()
        .describe("다이어그램 타입 (mermaid, plantuml, dot, graphviz 등)"),
      source: z.string().describe("렌더링할 다이어그램 원본 문법"),
      output_format: z
        .enum(["markdown", "svg", "png_url"])
        .optional()
        .default("markdown")
        .describe("출력 포맷. markdown=코드블록(기본), svg=SVG (HTML/PDF용), png_url=PNG URL (Slack/Discord용)"),
    },
    async ({ diagram_type, source, output_format = "markdown" }) => {
      if (output_format === "svg" || output_format === "png_url") {
        const krokiType = KROKI_TYPES[diagram_type.toLowerCase()];
        if (!krokiType) {
          return {
            content: [{
              type: "text" as const,
              text: `렌더링 불가: '${diagram_type}'은 Kroki 미지원 타입입니다. 지원 타입: mermaid, plantuml, dot, graphviz`,
            }],
          };
        }
        const text = output_format === "png_url"
          ? getPngUrl(krokiType, source.trim())
          : await renderViaKroki(krokiType, source.trim());
        return { content: [{ type: "text" as const, text }] };
      }
      const formatted = `\`\`\`${diagram_type}\n${source.trim()}\n\`\`\``;
      return { content: [{ type: "text" as const, text: formatted }] };
    }
  );

  // ─────────────────────────────────────────────
  // list_supported_diagram_types: 지원 타입 목록
  // ─────────────────────────────────────────────
  server.tool(
    "list_supported_diagram_types",
    "이 MCP 서버가 지원하는 모든 다이어그램 타입 목록을 반환합니다. " +
      "각 타입의 설명, 사용할 도구 이름, 예시 문법을 포함합니다. " +
      "어떤 다이어그램을 사용할지 모를 때 먼저 이 도구를 호출하세요.",
    {},
    async () => {
      const lines = SUPPORTED_TYPES.map(
        (t) =>
          `## ${t.name}\n` +
          `- **도구**: \`${t.tool}\`\n` +
          `- **설명**: ${t.description}\n` +
          `- **예시**:\n\`\`\`\n${t.example}\n\`\`\``
      ).join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `# 지원 다이어그램 타입 (${SUPPORTED_TYPES.length}종)\n\n${lines}`,
          },
        ],
      };
    }
  );
}

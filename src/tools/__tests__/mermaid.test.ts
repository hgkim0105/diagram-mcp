import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { registerMermaidTools } from "../mermaid.js";
import { createMockServer } from "./helpers.js";

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

function mockKroki(): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, status: 200, text: async () => FAKE_SVG,
  }));
}

afterEach(() => vi.unstubAllGlobals());

let call: (name: string, args: Record<string, unknown>) => Promise<string>;

beforeAll(() => {
  const { server, callTool } = createMockServer();
  registerMermaidTools(server);
  call = callTool;
});

// ── Flowchart ──────────────────────────────────────────────────────────────────

describe("generate_mermaid_flowchart", () => {
  it("기본 플로우차트 (TD, rect 노드)", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "Start" }, { id: "B", label: "End" }],
      edges: [{ from: "A", to: "B" }],
    });
    expect(out).toContain("```mermaid");
    expect(out).toContain("flowchart TD");
    expect(out).toContain("A[Start]");
    expect(out).toContain("B[End]");
    expect(out).toContain("A --> B");
  });

  it("방향 LR", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "X", label: "X" }],
      edges: [],
      direction: "LR",
    });
    expect(out).toContain("flowchart LR");
  });

  it("방향 BT / RL", async () => {
    const bt = await call("generate_mermaid_flowchart", { nodes: [], edges: [], direction: "BT" });
    expect(bt).toContain("flowchart BT");
    const rl = await call("generate_mermaid_flowchart", { nodes: [], edges: [], direction: "RL" });
    expect(rl).toContain("flowchart RL");
  });

  it("모든 노드 모양", async () => {
    const shapes = ["rect", "diamond", "circle", "stadium", "parallelogram", "hexagon", "cylinder"] as const;
    const nodes = shapes.map((shape, i) => ({ id: `n${i}`, label: `Node${i}`, shape }));
    const out = await call("generate_mermaid_flowchart", { nodes, edges: [] });
    expect(out).toContain("n0[Node0]");        // rect
    expect(out).toContain("n1{Node1}");        // diamond
    expect(out).toContain("n2((Node2))");      // circle
    expect(out).toContain("n3([Node3])");      // stadium
    expect(out).toContain("n4[/Node4/]");      // parallelogram
    expect(out).toContain("n5{{Node5}}");      // hexagon
    expect(out).toContain("n6[(Node6)]");      // cylinder
  });

  it("엣지 스타일: dotted, thick, 레이블 포함", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "A" }, { id: "B", label: "B" }, { id: "C", label: "C" }],
      edges: [
        { from: "A", to: "B", label: "yes", style: "dotted" },
        { from: "B", to: "C", label: "no", style: "thick" },
      ],
    });
    expect(out).toContain("-.->|yes|");
    expect(out).toContain("==>|no|");
  });

  it("레이블 없는 dotted/thick 엣지", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "A" }, { id: "B", label: "B" }, { id: "C", label: "C" }],
      edges: [
        { from: "A", to: "B", style: "dotted" },
        { from: "B", to: "C", style: "thick" },
      ],
    });
    expect(out).toContain("A -.-> B");
    expect(out).toContain("B ==> C");
  });

  it("제목 포함", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "A" }],
      edges: [],
      title: "My Flow",
    });
    expect(out).toContain("title: My Flow");
  });

  it("특수문자 레이블 이스케이프", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: 'Say "Hello"' }, { id: "B", label: "a[b]" }],
      edges: [],
    });
    expect(out).toContain("&quot;");
    expect(out).toContain("&#91;");
  });
});

// ── Sequence ───────────────────────────────────────────────────────────────────

describe("generate_mermaid_sequence", () => {
  it("기본 시퀀스 다이어그램", async () => {
    const out = await call("generate_mermaid_sequence", {
      participants: ["Client", "Server"],
      messages: [{ from: "Client", to: "Server", text: "GET /data" }],
    });
    expect(out).toContain("sequenceDiagram");
    expect(out).toContain("participant Client");
    expect(out).toContain("participant Server");
    expect(out).toContain("Client->>Server: GET /data");
  });

  it("모든 메시지 타입", async () => {
    const out = await call("generate_mermaid_sequence", {
      participants: ["A", "B"],
      messages: [
        { from: "A", to: "B", text: "sync", type: "sync" },
        { from: "B", to: "A", text: "return", type: "return" },
        { from: "A", to: "B", text: "async", type: "async" },
        { from: "B", to: "A", text: "async_return", type: "async_return" },
      ],
    });
    expect(out).toContain("A->>B: sync");
    expect(out).toContain("B-->>A: return");
    expect(out).toContain("A-)B: async");
    expect(out).toContain("B--)A: async_return");
  });

  it("제목 포함", async () => {
    const out = await call("generate_mermaid_sequence", {
      participants: ["A"],
      messages: [],
      title: "Auth Flow",
    });
    expect(out).toContain("title Auth Flow");
  });
});

// ── Class Diagram ──────────────────────────────────────────────────────────────

describe("generate_mermaid_class", () => {
  it("기본 클래스 다이어그램", async () => {
    const out = await call("generate_mermaid_class", {
      classes: [{ name: "Animal", attributes: ["+name: String"], methods: ["+speak(): void"] }],
      relationships: [],
    });
    expect(out).toContain("classDiagram");
    expect(out).toContain("class Animal {");
    expect(out).toContain("+name: String");
    expect(out).toContain("+speak(): void");
  });

  it("모든 관계 타입", async () => {
    const types = ["inheritance", "realization", "composition", "aggregation", "association", "dependency"] as const;
    const out = await call("generate_mermaid_class", {
      classes: [],
      relationships: types.map((type, i) => ({ from: `A${i}`, to: `B${i}`, type })),
    });
    expect(out).toContain("--|>");   // inheritance
    expect(out).toContain("..|>");   // realization
    expect(out).toContain("*--");    // composition
    expect(out).toContain("o--");    // aggregation
    expect(out).toContain("-->");    // association
    expect(out).toContain("..>");    // dependency
  });

  it("관계 레이블", async () => {
    const out = await call("generate_mermaid_class", {
      classes: [],
      relationships: [{ from: "Car", to: "Engine", type: "composition", label: "has" }],
    });
    expect(out).toContain("Car *-- Engine : has");
  });

  it("속성/메서드 없는 빈 클래스", async () => {
    const out = await call("generate_mermaid_class", {
      classes: [{ name: "EmptyClass" }],
      relationships: [],
    });
    expect(out).toContain("class EmptyClass {");
    expect(out).toContain("}");
  });
});

// ── ER Diagram ─────────────────────────────────────────────────────────────────

describe("generate_mermaid_er", () => {
  it("기본 ER 다이어그램", async () => {
    const out = await call("generate_mermaid_er", {
      entities: [
        {
          name: "USER",
          attributes: [
            { name: "id", type: "int", key: "PK" },
            { name: "email", type: "string", key: "UK" },
          ],
        },
      ],
      relationships: [{ from: "USER", to: "ORDER", label: "places" }],
    });
    expect(out).toContain("erDiagram");
    expect(out).toContain("USER ||--o{ ORDER : places");
    expect(out).toContain("int id PK");
    expect(out).toContain("string email UK");
  });

  it("모든 카디널리티 조합", async () => {
    const cards = ["||", "o|", "|{", "o{"] as const;
    const out = await call("generate_mermaid_er", {
      entities: [],
      relationships: cards.map((fc, i) =>
        cards.map((tc, j) => ({ from: `E${i}`, to: `F${j}`, label: "rel", from_card: fc, to_card: tc }))
      ).flat(),
    });
    expect(out).toContain("||--||");
    expect(out).toContain("o|--o{");
    expect(out).toContain("|{--|{");
  });

  it("FK 컬럼", async () => {
    const out = await call("generate_mermaid_er", {
      entities: [{ name: "ORDER", attributes: [{ name: "user_id", type: "int", key: "FK" }] }],
      relationships: [],
    });
    expect(out).toContain("int user_id FK");
  });

  it("속성 없는 엔티티는 블록 출력 안 함", async () => {
    const out = await call("generate_mermaid_er", {
      entities: [{ name: "EMPTY" }],
      relationships: [],
    });
    expect(out).not.toContain("EMPTY {");
  });
});

// ── Gantt ──────────────────────────────────────────────────────────────────────

describe("generate_mermaid_gantt", () => {
  it("기본 간트 차트", async () => {
    const out = await call("generate_mermaid_gantt", {
      title: "Project Plan",
      sections: [
        {
          name: "Phase 1",
          tasks: [{ name: "Task A", status: "done", start: "2024-01-01", duration: "7d" }],
        },
      ],
    });
    expect(out).toContain("gantt");
    expect(out).toContain("title Project Plan");
    expect(out).toContain("dateFormat YYYY-MM-DD");
    expect(out).toContain("section Phase 1");
    expect(out).toContain("Task A :done, 2024-01-01, 7d");
  });

  it("모든 태스크 상태", async () => {
    const statuses = ["done", "active", "crit", "milestone"] as const;
    const out = await call("generate_mermaid_gantt", {
      title: "T",
      sections: [{
        name: "S",
        tasks: statuses.map((s) => ({ name: s, status: s })),
      }],
    });
    for (const s of statuses) expect(out).toContain(`:${s}`);
  });

  it("커스텀 날짜 형식", async () => {
    const out = await call("generate_mermaid_gantt", {
      title: "T",
      sections: [],
      date_format: "MM/DD/YYYY",
    });
    expect(out).toContain("dateFormat MM/DD/YYYY");
  });

  it("여러 섹션", async () => {
    const out = await call("generate_mermaid_gantt", {
      title: "Multi",
      sections: [
        { name: "Alpha", tasks: [{ name: "A1" }] },
        { name: "Beta", tasks: [{ name: "B1" }] },
      ],
    });
    expect(out).toContain("section Alpha");
    expect(out).toContain("section Beta");
  });
});

// ── Pie Chart ──────────────────────────────────────────────────────────────────

describe("generate_mermaid_pie", () => {
  it("기본 파이 차트", async () => {
    const out = await call("generate_mermaid_pie", {
      title: "Fruit Share",
      slices: [
        { label: "Apple", value: 40 },
        { label: "Banana", value: 35 },
        { label: "Cherry", value: 25 },
      ],
    });
    expect(out).toContain(`pie title Fruit Share`);
    expect(out).toContain(`"Apple" : 40`);
    expect(out).toContain(`"Banana" : 35`);
    expect(out).toContain(`"Cherry" : 25`);
  });

  it("슬라이스 1개", async () => {
    const out = await call("generate_mermaid_pie", {
      title: "Single",
      slices: [{ label: "All", value: 100 }],
    });
    expect(out).toContain(`"All" : 100`);
  });

  it("부동소수 값", async () => {
    const out = await call("generate_mermaid_pie", {
      title: "Decimal",
      slices: [{ label: "X", value: 33.3 }, { label: "Y", value: 66.7 }],
    });
    expect(out).toContain("33.3");
    expect(out).toContain("66.7");
  });
});

// ── Mindmap ────────────────────────────────────────────────────────────────────

describe("generate_mermaid_mindmap", () => {
  it("기본 마인드맵", async () => {
    const out = await call("generate_mermaid_mindmap", {
      root: "Central Idea",
      children: [{ text: "Branch A" }, { text: "Branch B" }],
    });
    expect(out).toContain("mindmap");
    expect(out).toContain("((Central Idea))");
    expect(out).toContain("Branch A");
    expect(out).toContain("Branch B");
  });

  it("루트 모양 - 모든 옵션", async () => {
    const cases: [string, string][] = [
      ["circle",  "((Root))"],
      ["square",  "[Root]"],
      ["rounded", "(Root)"],
      ["bang",    ")Root("],
      ["cloud",   ")Root)"],
      ["default", "((Root))"],
    ];
    for (const [shape, expected] of cases) {
      const out = await call("generate_mermaid_mindmap", { root: "Root", root_shape: shape, children: [] });
      expect(out, `shape=${shape}`).toContain(expected);
    }
  });

  it("자식 노드 모양 - 모든 옵션", async () => {
    const out = await call("generate_mermaid_mindmap", {
      root: "Root",
      children: [
        { text: "C", shape: "circle" },
        { text: "S", shape: "square" },
        { text: "R", shape: "rounded" },
        { text: "B", shape: "bang" },
        { text: "Cl", shape: "cloud" },
        { text: "D", shape: "default" },
      ],
    });
    expect(out).toContain("((C))");
    expect(out).toContain("[S]");
    expect(out).toContain("(R)");
    expect(out).toContain(")B(");
    expect(out).toContain(")Cl)");
    expect(out).toContain("D");
  });

  it("재귀 중첩 자식", async () => {
    const out = await call("generate_mermaid_mindmap", {
      root: "Root",
      children: [
        {
          text: "L1",
          children: [
            { text: "L2", children: [{ text: "L3" }] },
          ],
        },
      ],
    });
    expect(out).toContain("L1");
    expect(out).toContain("L2");
    expect(out).toContain("L3");
  });
});

// ── output_format 통합 테스트 ──────────────────────────────────────────────────

describe("output_format 옵션", () => {
  it("output_format 미지정 → 기본값 markdown (코드블록 반환)", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "A" }],
      edges: [],
    });
    expect(out).toContain("```mermaid");
  });

  it("output_format=markdown → 코드블록 반환", async () => {
    const out = await call("generate_mermaid_sequence", {
      participants: ["A", "B"],
      messages: [],
      output_format: "markdown",
    });
    expect(out).toContain("```mermaid");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (flowchart)", async () => {
    mockKroki();
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "A" }],
      edges: [],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (sequence)", async () => {
    mockKroki();
    const out = await call("generate_mermaid_sequence", {
      participants: ["A", "B"],
      messages: [{ from: "A", to: "B", text: "hi" }],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (pie)", async () => {
    mockKroki();
    const out = await call("generate_mermaid_pie", {
      title: "T",
      slices: [{ label: "A", value: 50 }, { label: "B", value: 50 }],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=png_url → Kroki PNG URL 반환 (fetch 없음)", async () => {
    const out = await call("generate_mermaid_flowchart", {
      nodes: [{ id: "A", label: "Start" }, { id: "B", label: "End" }],
      edges: [{ from: "A", to: "B" }],
      output_format: "png_url",
    });
    expect(out).toMatch(/^https:\/\/kroki\.io\/mermaid\/png\//);
  });

  it("output_format=png_url → 슬랙 Block Kit image_url로 바로 사용 가능한 URL 형식", async () => {
    const out = await call("generate_mermaid_sequence", {
      participants: ["Client", "Server"],
      messages: [{ from: "Client", to: "Server", text: "GET /api" }],
      output_format: "png_url",
    });
    // URL 형식 검증: https://kroki.io/mermaid/png/{base64url}
    expect(out).toMatch(/^https:\/\/kroki\.io\/mermaid\/png\/[A-Za-z0-9_-]+$/);
  });
});

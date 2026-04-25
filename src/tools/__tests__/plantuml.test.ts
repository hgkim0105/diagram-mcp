import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { registerPlantUMLTools } from "../plantuml.js";
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
  registerPlantUMLTools(server);
  call = callTool;
});

// ── Sequence Diagram ───────────────────────────────────────────────────────────

describe("generate_plantuml_sequence", () => {
  it("기본 시퀀스 다이어그램", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "User" }, { name: "API" }],
      messages: [{ from: "User", to: "API", text: "login" }],
    });
    expect(out).toContain("```plantuml");
    expect(out).toContain("@startuml");
    expect(out).toContain("@enduml");
    expect(out).toContain("participant User");
    expect(out).toContain("participant API");
    expect(out).toContain("User -> API : login");
  });

  it("모든 참여자 타입", async () => {
    const types = ["actor", "participant", "boundary", "control", "entity", "database", "collections", "queue"] as const;
    const out = await call("generate_plantuml_sequence", {
      participants: types.map((type, i) => ({ type, name: `P${i}` })),
      messages: [],
    });
    for (const t of types) expect(out).toContain(`${t} P`);
  });

  it("이름에 공백 있는 참여자 → 따옴표 처리", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "Order Service" }],
      messages: [],
    });
    expect(out).toContain(`participant "Order Service"`);
  });

  it("별칭(alias) 참여자", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "Order Service", alias: "OS" }],
      messages: [],
    });
    expect(out).toContain("as OS");
  });

  it("모든 메시지 타입", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "A" }, { name: "B" }],
      messages: [
        { from: "A", to: "B", text: "sync", type: "sync" },
        { from: "B", to: "A", text: "return", type: "return" },
        { from: "A", to: "B", text: "async", type: "async" },
        { from: "B", to: "A", text: "async_ret", type: "async_return" },
      ],
    });
    expect(out).toContain("A -> B : sync");
    expect(out).toContain("B --> A : return");
    expect(out).toContain("A ->> B : async");
    expect(out).toContain("B -->> A : async_ret");
  });

  it("노트 포함 메시지", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "A" }, { name: "B" }],
      messages: [{ from: "A", to: "B", text: "call", note: "Important step" }],
    });
    expect(out).toContain("note over A: Important step");
  });

  it("제목 포함", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [],
      messages: [],
      title: "Login Flow",
    });
    expect(out).toContain("title Login Flow");
  });
});

// ── Class Diagram ──────────────────────────────────────────────────────────────

describe("generate_plantuml_class", () => {
  it("기본 클래스 다이어그램", async () => {
    const out = await call("generate_plantuml_class", {
      classes: [
        {
          name: "Vehicle",
          attributes: ["+brand: String", "-speed: int"],
          methods: ["+accelerate(): void"],
        },
      ],
      relationships: [],
    });
    expect(out).toContain("@startuml");
    expect(out).toContain("class Vehicle {");
    expect(out).toContain("+brand: String");
    expect(out).toContain("+accelerate(): void");
    expect(out).toContain("@enduml");
  });

  it("스테레오타입", async () => {
    const out = await call("generate_plantuml_class", {
      classes: [
        { name: "IAnimal", stereotype: "interface" },
        { name: "AbstractBase", stereotype: "abstract" },
      ],
      relationships: [],
    });
    expect(out).toContain("class IAnimal <<interface>>");
    expect(out).toContain("class AbstractBase <<abstract>>");
  });

  it("모든 관계 타입", async () => {
    const types = ["inheritance", "realization", "composition", "aggregation", "association", "dependency"] as const;
    const out = await call("generate_plantuml_class", {
      classes: [],
      relationships: types.map((type, i) => ({ from: `A${i}`, to: `B${i}`, type })),
    });
    expect(out).toContain("--|>");  // inheritance
    expect(out).toContain("..|>");  // realization
    expect(out).toContain("*--");   // composition
    expect(out).toContain("o--");   // aggregation
    expect(out).toContain("-->");   // association
    expect(out).toContain("..>");   // dependency
  });

  it("카디널리티 레이블", async () => {
    const out = await call("generate_plantuml_class", {
      classes: [],
      relationships: [
        { from: "Order", to: "Item", type: "composition", from_label: "1", to_label: "*", label: "contains" },
      ],
    });
    expect(out).toContain('"1"');
    expect(out).toContain('"*"');
    expect(out).toContain(": contains");
  });

  it("제목 포함", async () => {
    const out = await call("generate_plantuml_class", {
      classes: [],
      relationships: [],
      title: "Domain Model",
    });
    expect(out).toContain("title Domain Model");
  });
});

// ── Component Diagram ──────────────────────────────────────────────────────────

describe("generate_plantuml_component", () => {
  it("기본 컴포넌트 다이어그램", async () => {
    const out = await call("generate_plantuml_component", {
      components: [{ name: "Frontend" }, { name: "Backend" }],
      connections: [{ from: "Frontend", to: "Backend", label: "REST" }],
    });
    expect(out).toContain("@startuml");
    expect(out).toContain("[Frontend]");
    expect(out).toContain("[Backend]");
    expect(out).toContain("Frontend --> Backend : REST");
  });

  it("모든 컴포넌트 타입", async () => {
    const types = ["component", "interface", "database", "cloud", "node", "frame", "package", "queue", "storage", "actor"] as const;
    const out = await call("generate_plantuml_component", {
      components: types.map((type, i) => ({ type, name: `C${i}` })),
      connections: [],
    });
    expect(out).toContain("[C0]");           // component
    expect(out).toContain("interface C1");
    expect(out).toContain("database C2");
    expect(out).toContain("cloud C3");
    expect(out).toContain("node C4");
    // index 5 = frame, 6 = package
    expect(out).toContain("queue C7");
    expect(out).toContain("storage C8");
    expect(out).toContain("actor C9");
  });

  it("공백 있는 컴포넌트 이름 → 따옴표 처리", async () => {
    const out = await call("generate_plantuml_component", {
      components: [{ type: "database", name: "Order DB" }],
      connections: [],
    });
    expect(out).toContain('"Order DB"');
  });

  it("점선(dotted) 연결", async () => {
    const out = await call("generate_plantuml_component", {
      components: [{ name: "A" }, { name: "B" }],
      connections: [{ from: "A", to: "B", style: "dotted" }],
    });
    expect(out).toContain("A ..> B");
  });

  it("커스텀 ID 사용", async () => {
    const out = await call("generate_plantuml_component", {
      components: [{ name: "My Service", id: "svc" }],
      connections: [],
    });
    expect(out).toContain("as svc");
  });

  it("제목 포함", async () => {
    const out = await call("generate_plantuml_component", {
      components: [],
      connections: [],
      title: "System Architecture",
    });
    expect(out).toContain("title System Architecture");
  });
});

// ── State Diagram ──────────────────────────────────────────────────────────────

describe("generate_plantuml_state", () => {
  it("기본 상태 다이어그램", async () => {
    const out = await call("generate_plantuml_state", {
      states: [{ name: "Idle" }, { name: "Running" }],
      transitions: [
        { from: "[*]", to: "Idle", label: "init" },
        { from: "Idle", to: "Running", label: "start" },
        { from: "Running", to: "[*]", label: "stop" },
      ],
    });
    expect(out).toContain("@startuml");
    expect(out).toContain("[*] --> Idle : init");
    expect(out).toContain("Idle --> Running : start");
    expect(out).toContain("Running --> [*] : stop");
    expect(out).toContain("@enduml");
  });

  it("설명 있는 상태", async () => {
    const out = await call("generate_plantuml_state", {
      states: [{ name: "Processing", description: "Handling request" }],
      transitions: [],
    });
    expect(out).toContain('state "Processing" as Processing : Handling request');
  });

  it("레이블 없는 전이", async () => {
    const out = await call("generate_plantuml_state", {
      states: [{ name: "A" }, { name: "B" }],
      transitions: [{ from: "A", to: "B" }],
    });
    expect(out).toContain("A --> B");
    expect(out).not.toContain("A --> B :");
  });

  it("제목 포함", async () => {
    const out = await call("generate_plantuml_state", {
      states: [],
      transitions: [],
      title: "Order Lifecycle",
    });
    expect(out).toContain("title Order Lifecycle");
  });
});

// ── output_format 통합 테스트 ──────────────────────────────────────────────────

describe("output_format 옵션", () => {
  it("output_format 미지정 → 기본값 markdown", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "A" }],
      messages: [],
    });
    expect(out).toContain("```plantuml");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (sequence)", async () => {
    mockKroki();
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "A" }, { name: "B" }],
      messages: [{ from: "A", to: "B", text: "hi" }],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (state)", async () => {
    mockKroki();
    const out = await call("generate_plantuml_state", {
      states: [{ name: "Idle" }],
      transitions: [{ from: "[*]", to: "Idle" }],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=png_url → Kroki PNG URL 반환", async () => {
    const out = await call("generate_plantuml_sequence", {
      participants: [{ name: "A" }, { name: "B" }],
      messages: [{ from: "A", to: "B", text: "call" }],
      output_format: "png_url",
    });
    expect(out).toMatch(/^https:\/\/kroki\.io\/plantuml\/png\/[A-Za-z0-9_-]+$/);
  });
});

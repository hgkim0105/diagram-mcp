import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { registerGraphvizTools } from "../graphviz.js";
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
  registerGraphvizTools(server);
  call = callTool;
});

// ── Digraph ────────────────────────────────────────────────────────────────────

describe("generate_graphviz_digraph", () => {
  it("기본 방향 그래프", async () => {
    const out = await call("generate_graphviz_digraph", {
      nodes: [{ id: "A" }, { id: "B" }],
      edges: [{ from: "A", to: "B" }],
    });
    expect(out).toContain("```dot");
    expect(out).toContain("digraph G {");
    expect(out).toContain("A -> B");
  });

  it("모든 노드 모양", async () => {
    const shapes = ["box", "circle", "ellipse", "diamond", "hexagon", "parallelogram", "triangle", "cylinder", "note", "oval"] as const;
    const nodes = shapes.map((shape, i) => ({ id: `n${i}`, shape }));
    const out = await call("generate_graphviz_digraph", { nodes, edges: [] });
    for (const shape of shapes) expect(out).toContain(`shape="${shape}"`);
  });

  it("노드 레이블/색상/스타일", async () => {
    const out = await call("generate_graphviz_digraph", {
      nodes: [{
        id: "db",
        label: "PostgreSQL",
        shape: "cylinder",
        style: "filled",
        fillcolor: "lightblue",
        color: "#333",
        fontcolor: "navy",
      }],
      edges: [],
    });
    expect(out).toContain('label="PostgreSQL"');
    expect(out).toContain('shape="cylinder"');
    expect(out).toContain('style="filled"');
    expect(out).toContain('fillcolor="lightblue"');
    expect(out).toContain('color="#333"');
    expect(out).toContain('fontcolor="navy"');
  });

  it("모든 엣지 스타일", async () => {
    const styles = ["solid", "dashed", "dotted", "bold", "invis"] as const;
    const nodes = [{ id: "A" }, { id: "B" }];
    for (const style of styles) {
      const out = await call("generate_graphviz_digraph", {
        nodes,
        edges: [{ from: "A", to: "B", style }],
      });
      if (style !== "solid") {
        expect(out).toContain(`style="${style}"`);
      }
    }
  });

  it("모든 화살표 모양", async () => {
    const arrowheads = ["normal", "vee", "dot", "odot", "none", "diamond", "box"] as const;
    const out = await call("generate_graphviz_digraph", {
      nodes: [{ id: "A" }, { id: "B" }],
      edges: arrowheads.map((arrowhead) => ({ from: "A", to: "B", arrowhead })),
    });
    for (const a of arrowheads) expect(out).toContain(`arrowhead="${a}"`);
  });

  it("엣지 레이블", async () => {
    const out = await call("generate_graphviz_digraph", {
      nodes: [{ id: "A" }, { id: "B" }],
      edges: [{ from: "A", to: "B", label: "uses", color: "red" }],
    });
    expect(out).toContain('label="uses"');
    expect(out).toContain('color="red"');
  });

  it("graph_attrs 적용", async () => {
    const out = await call("generate_graphviz_digraph", {
      nodes: [],
      edges: [],
      graph_attrs: { rankdir: "LR", splines: "ortho", bgcolor: "white" },
    });
    expect(out).toContain('rankdir="LR"');
    expect(out).toContain('splines="ortho"');
    expect(out).toContain('bgcolor="white"');
  });

  it("제목 포함", async () => {
    const out = await call("generate_graphviz_digraph", {
      nodes: [],
      edges: [],
      title: "Service Dependencies",
    });
    expect(out).toContain('label="Service Dependencies"');
    expect(out).toContain('labelloc="t"');
  });
});

// ── Undirected Graph ───────────────────────────────────────────────────────────

describe("generate_graphviz_graph", () => {
  it("기본 무방향 그래프", async () => {
    const out = await call("generate_graphviz_graph", {
      nodes: [{ id: "A" }, { id: "B" }, { id: "C" }],
      edges: [{ from: "A", to: "B" }, { from: "B", to: "C" }],
    });
    expect(out).toContain("graph G {");
    expect(out).toContain("A -- B");
    expect(out).toContain("B -- C");
    expect(out).not.toContain("->");
  });

  it("노드 속성과 엣지 레이블", async () => {
    const out = await call("generate_graphviz_graph", {
      nodes: [
        { id: "server1", label: "Server 1", shape: "box", style: "filled", fillcolor: "#f0f0f0" },
        { id: "server2", label: "Server 2", shape: "box" },
      ],
      edges: [{ from: "server1", to: "server2", label: "10Gbps" }],
    });
    expect(out).toContain('label="Server 1"');
    expect(out).toContain('label="10Gbps"');
    expect(out).toContain("server1 -- server2");
  });

  it("graph_attrs 적용", async () => {
    const out = await call("generate_graphviz_graph", {
      nodes: [],
      edges: [],
      graph_attrs: { rankdir: "TB" },
    });
    expect(out).toContain('rankdir="TB"');
  });
});

// ── output_format 통합 테스트 ──────────────────────────────────────────────────

describe("output_format 옵션", () => {
  it("output_format 미지정 → 기본값 markdown (dot 코드블록)", async () => {
    const out = await call("generate_graphviz_digraph", { nodes: [], edges: [] });
    expect(out).toContain("```dot");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (digraph)", async () => {
    mockKroki();
    const out = await call("generate_graphviz_digraph", {
      nodes: [{ id: "A" }, { id: "B" }],
      edges: [{ from: "A", to: "B" }],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=svg → Kroki 호출 후 SVG 반환 (undirected graph)", async () => {
    mockKroki();
    const out = await call("generate_graphviz_graph", {
      nodes: [{ id: "X" }, { id: "Y" }],
      edges: [{ from: "X", to: "Y" }],
      output_format: "svg",
    });
    expect(out).toContain("<svg");
  });

  it("output_format=png_url → Kroki PNG URL 반환 (digraph)", async () => {
    const out = await call("generate_graphviz_digraph", {
      nodes: [{ id: "A" }, { id: "B" }],
      edges: [{ from: "A", to: "B" }],
      output_format: "png_url",
    });
    expect(out).toMatch(/^https:\/\/kroki\.io\/graphviz\/png\/[A-Za-z0-9_-]+$/);
  });
});

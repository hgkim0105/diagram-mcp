import { describe, it, expect, vi, afterEach } from "vitest";
import { renderViaKroki, getPngUrl } from "../../lib/kroki.js";

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

function mockFetch(status: number, body: string): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("renderViaKroki", () => {
  it("SVG 렌더링 성공", async () => {
    mockFetch(200, FAKE_SVG);
    const svg = await renderViaKroki("mermaid", "graph TD\nA-->B");
    expect(svg).toContain("<svg");
  });

  it("mermaid 타입 — 올바른 URL로 POST", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => FAKE_SVG });
    vi.stubGlobal("fetch", spy);
    await renderViaKroki("mermaid", "graph TD\nA-->B");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/mermaid/svg"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("plantuml 타입 — 올바른 URL로 POST", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => FAKE_SVG });
    vi.stubGlobal("fetch", spy);
    await renderViaKroki("plantuml", "@startuml\nA->B\n@enduml");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/plantuml/svg"),
      expect.anything()
    );
  });

  it("graphviz 타입 — 올바른 URL로 POST", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => FAKE_SVG });
    vi.stubGlobal("fetch", spy);
    await renderViaKroki("graphviz", "digraph G { A->B }");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/graphviz/svg"),
      expect.anything()
    );
  });

  it("KROKI_BASE_URL 환경변수 반영", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => FAKE_SVG });
    vi.stubGlobal("fetch", spy);
    vi.stubEnv("KROKI_BASE_URL", "https://my-kroki.internal");
    await renderViaKroki("mermaid", "graph TD\nA-->B");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("my-kroki.internal"),
      expect.anything()
    );
  });

  it("HTTP 500 에러 → 명확한 에러 메시지", async () => {
    mockFetch(500, "Internal Server Error");
    await expect(renderViaKroki("mermaid", "bad syntax"))
      .rejects.toThrow("HTTP 500");
  });

  it("HTTP 400 에러 → 에러 throw", async () => {
    mockFetch(400, "Bad Request");
    await expect(renderViaKroki("mermaid", ""))
      .rejects.toThrow("HTTP 400");
  });

  it("네트워크 오류 → 연결 실패 메시지", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(renderViaKroki("mermaid", "graph TD\nA-->B"))
      .rejects.toThrow("Kroki 서버 연결 실패");
  });

  it("응답이 SVG가 아니면 에러", async () => {
    mockFetch(200, "not an svg response");
    await expect(renderViaKroki("mermaid", "graph TD\nA-->B"))
      .rejects.toThrow("올바른 SVG가 아닙니다");
  });
});

// ── getPngUrl ──────────────────────────────────────────────────────────────────

describe("getPngUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("올바른 Kroki PNG URL 구조 반환", () => {
    const url = getPngUrl("mermaid", "graph TD\nA-->B");
    expect(url).toMatch(/^https:\/\/kroki\.io\/mermaid\/png\//);
  });

  it("plantuml 타입 URL", () => {
    const url = getPngUrl("plantuml", "@startuml\nA->B\n@enduml");
    expect(url).toContain("/plantuml/png/");
  });

  it("graphviz 타입 URL", () => {
    const url = getPngUrl("graphviz", "digraph G { A->B }");
    expect(url).toContain("/graphviz/png/");
  });

  it("KROKI_BASE_URL 환경변수 반영", () => {
    vi.stubEnv("KROKI_BASE_URL", "https://my-kroki.internal");
    const url = getPngUrl("mermaid", "graph TD\nA-->B");
    expect(url).toContain("my-kroki.internal");
  });

  it("URL에 base64url 인코딩 포함 (fetch 불필요 — 순수 동기)", () => {
    const url = getPngUrl("mermaid", "graph TD\nA-->B");
    const encoded = url.split("/").pop()!;
    // base64url 문자만 포함 ('+', '/' 없음, '=' 패딩 없음)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("동일 소스는 항상 동일 URL 반환 (결정적)", () => {
    const source = "graph TD\nA-->B";
    expect(getPngUrl("mermaid", source)).toBe(getPngUrl("mermaid", source));
  });

  it("소스가 다르면 URL도 다름", () => {
    const url1 = getPngUrl("mermaid", "graph TD\nA-->B");
    const url2 = getPngUrl("mermaid", "graph LR\nX-->Y");
    expect(url1).not.toBe(url2);
  });
});

import { deflateSync } from "zlib";

export type KrokiDiagramType = "mermaid" | "plantuml" | "graphviz";

const DEFAULT_BASE = "https://kroki.io";
const TIMEOUT_MS = 10_000;

/**
 * Kroki GET URL용 인코딩: zlib deflate(level 9) → base64url
 * Slack image block, Markdown 이미지 링크 등에 직접 사용 가능한 공개 URL 반환.
 */
export function getPngUrl(diagramType: KrokiDiagramType, source: string): string {
  const base = process.env["KROKI_BASE_URL"] ?? DEFAULT_BASE;
  const encoded = deflateSync(Buffer.from(source, "utf-8"), { level: 9 }).toString("base64url");
  return `${base}/${diagramType}/png/${encoded}`;
}

/**
 * Kroki API POST 방식으로 SVG를 렌더링하여 반환한다.
 * 환경변수 KROKI_BASE_URL로 자가 호스팅 인스턴스 지정 가능.
 */
export async function renderViaKroki(
  diagramType: KrokiDiagramType,
  source: string
): Promise<string> {
  const base = process.env["KROKI_BASE_URL"] ?? DEFAULT_BASE;
  const url = `${base}/${diagramType}/svg`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: source,
      signal: controller.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Kroki 서버 연결 실패 (${url}): ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Kroki 렌더링 실패 [HTTP ${response.status}]: ${body.slice(0, 200)}`);
  }

  const svg = await response.text();
  if (!svg.includes("<svg")) {
    throw new Error("Kroki 응답이 올바른 SVG가 아닙니다.");
  }
  return svg;
}

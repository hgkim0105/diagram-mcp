# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # esbuild → dist/index.js (단일 번들)
npm run dev         # tsx로 빌드 없이 실행
npm run typecheck   # tsc --noEmit
npm test            # vitest run (전체)
npm run test:watch  # vitest 워치 모드
```

특정 테스트 파일만 실행:
```bash
npx vitest run src/tools/__tests__/mermaid.test.ts
```

## 아키텍처

**MCP 서버** — Claude가 도구를 호출하면 다이어그램 소스를 생성하거나 Kroki API로 렌더링해 반환한다.

```
src/
├── index.ts          # StdioServerTransport 진입점
├── server.ts         # McpServer 인스턴스 생성, registerAllTools() 호출
├── lib/
│   └── kroki.ts      # Kroki API 클라이언트 (renderViaKroki, getPngUrl)
└── tools/
    ├── index.ts      # registerAllTools() — 5개 등록 함수 오케스트레이션
    ├── mermaid.ts    # 7종 도구
    ├── plantuml.ts   # 4종 도구
    ├── graphviz.ts   # 2종 도구
    ├── charts.ts     # 3종 SVG 차트 (순수 TS 렌더링, Kroki 불필요)
    ├── utility.ts    # list_supported_diagram_types, render_diagram
    └── __tests__/    # vitest 테스트 (helpers.ts로 McpServer mock)
```

### 도구 등록 패턴

각 tool 파일은 `server.tool(name, description, zodSchema, asyncHandler)` 패턴을 사용한다. 핸들러는 `{ content: [{ type: "text", text }] }` 형태로 반환한다.

### output_format 파라미터

Mermaid·PlantUML·Graphviz 13개 도구에 공통 적용:

| 값 | 동작 |
|---|---|
| `"markdown"` (기본) | 마크다운 코드블록 반환 — Kroki 호출 없음 |
| `"svg"` | `renderViaKroki()` POST → SVG 문자열 반환 |
| `"png_url"` | `getPngUrl()` 동기 처리 → Kroki GET URL 반환 (fetch 없음) |

각 파일의 `toOutput(syntax, format)` 헬퍼가 세 경우를 분기한다.

### Kroki 연동 (`src/lib/kroki.ts`)

- `renderViaKroki(type, source)` — POST `/mermaid|plantuml|graphviz/svg`, 타임아웃 10초
- `getPngUrl(type, source)` — zlib deflate + base64url 인코딩으로 GET URL 생성 (네트워크 불필요)
- 환경변수 `KROKI_BASE_URL`로 자가 호스팅 인스턴스 지정 가능

### 테스트 전략

`helpers.ts`의 `createMockServer()`가 `McpServer`를 mock해 핸들러를 직접 호출할 수 있게 한다. Kroki fetch는 `vi.stubGlobal("fetch", ...)` / `vi.stubEnv("KROKI_BASE_URL", ...)` 으로 격리한다. `afterEach`에서 반드시 `vi.unstubAllGlobals()` + `vi.unstubAllEnvs()` 를 함께 호출해야 env 누수가 없다.

### SVG 차트

`charts.ts`는 Kroki를 사용하지 않고 680×420px SVG를 직접 생성한다. `output_format` 파라미터 없음. `niceTicks(min, max)`가 Y축 눈금을 계산하며 min === max 엣지 케이스를 처리한다.

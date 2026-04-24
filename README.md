# diagram-mcp

AI 에이전트(Claude)가 호출하는 다이어그램 생성 MCP 서버입니다.  
Mermaid, PlantUML, Graphviz, SVG 차트를 구조화된 데이터로 생성합니다.

- **외부 의존성 없음** — 인터넷/외부 API 불필요, 폐쇄망 동작
- **Node.js만 있으면 실행 가능** — Claude Code 설치 환경이면 추가 설치 불필요
- **18가지 도구** — Mermaid 7종, PlantUML 4종, Graphviz 2종, SVG 차트 3종, 유틸 2종

---

## 설치

### 1단계 — 저장소 클론

```bash
git clone <REPO_URL> ~/tools/diagram-mcp
```

### 2단계 — Claude Code에 등록

```bash
claude mcp add diagram-mcp -- node ~/tools/diagram-mcp/dist/index.js
```

### 확인

```bash
claude mcp list
```

`diagram-mcp` 가 목록에 있으면 완료입니다.

> **참고**: `dist/index.js`는 사전 빌드된 파일로 저장소에 포함되어 있습니다.  
> 소스를 직접 수정한 경우 `npm run build`로 재빌드하세요.

---

## 지원 도구 (18종)

### Mermaid

| 도구 | 설명 |
|------|------|
| `generate_mermaid_flowchart` | 플로우차트 — 프로세스, 워크플로우, 의사결정 트리 |
| `generate_mermaid_sequence` | 시퀀스 다이어그램 — API 호출 흐름, 시스템 간 통신 |
| `generate_mermaid_class` | 클래스 다이어그램 — OOP 설계, 도메인 모델 |
| `generate_mermaid_er` | ER 다이어그램 — 데이터베이스 스키마 설계 |
| `generate_mermaid_gantt` | 간트 차트 — 프로젝트 일정, 마일스톤 |
| `generate_mermaid_pie` | 파이 차트 — 비율, 구성 분포 |
| `generate_mermaid_mindmap` | 마인드맵 — 계층 구조, 브레인스토밍 |

### PlantUML

| 도구 | 설명 |
|------|------|
| `generate_plantuml_sequence` | 시퀀스 다이어그램 — actor, database 등 다양한 참여자 타입 지원 |
| `generate_plantuml_class` | 클래스 다이어그램 — 스테레오타입, 카디널리티 지원 |
| `generate_plantuml_component` | 컴포넌트 다이어그램 — 시스템 아키텍처, 서비스 의존성 |
| `generate_plantuml_state` | 상태 다이어그램 — 상태 머신, 비즈니스 프로세스 |

### Graphviz

| 도구 | 설명 |
|------|------|
| `generate_graphviz_digraph` | 방향 그래프 — 의존성, 데이터 파이프라인, DAG |
| `generate_graphviz_graph` | 무방향 그래프 — 네트워크, 관계 맵 |

### SVG 차트 (순수 TypeScript 렌더링)

| 도구 | 설명 |
|------|------|
| `generate_bar_chart` | 막대 차트 — 카테고리별 수치 비교, 그룹 막대 지원 |
| `generate_line_chart` | 선 차트 — 시계열, 추세, 다중 계열 지원 |
| `generate_scatter_plot` | 산점도 — 두 수치 변수의 상관관계 |

### 유틸리티

| 도구 | 설명 |
|------|------|
| `list_supported_diagram_types` | 지원 타입 목록 및 예시 문법 조회 |
| `render_diagram` | 직접 작성한 다이어그램 문법을 마크다운 코드블록으로 포맷 |

---

## 사용 예시

Claude에게 자연어로 요청하면 적절한 도구를 선택해 다이어그램을 생성합니다.

**플로우차트 요청:**
```
로그인 프로세스 플로우차트 그려줘
```

**시퀀스 다이어그램 요청:**
```
사용자 → API Gateway → Auth Service → DB 순서로 JWT 인증 흐름 시퀀스 다이어그램 만들어줘
```

**아키텍처 다이어그램 요청:**
```
마이크로서비스 아키텍처 컴포넌트 다이어그램 그려줘.
서비스: Frontend, API Gateway, Order Service, Payment Service, DB
```

**데이터 차트 요청:**
```
아래 데이터로 분기별 매출 막대 차트 만들어줘
Q1: 12억, Q2: 15억, Q3: 18억, Q4: 21억
```

---

## 개발 환경 설정

소스를 수정하려면:

```bash
# 의존성 설치
npm install

# 개발 모드 실행 (빌드 없이)
npm run dev

# 타입 검사
npm run typecheck

# 단일 파일로 빌드
npm run build
```

### 요구사항

- Node.js 18 이상
- npm 8 이상

---

## 출력 형식

- **Mermaid / PlantUML / Graphviz**: 마크다운 코드블록으로 반환 (Claude UI에서 자동 렌더링)
- **SVG 차트**: SVG 마크업 직접 반환 (HTML에 삽입하거나 `.svg` 파일로 저장 가능)

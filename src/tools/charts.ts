import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── 색상 팔레트 ────────────────────────────────────────────────────────────────

const COLORS = [
  "#4C9BE8", "#E8834C", "#4CB87A", "#E84C9B",
  "#9B4CE8", "#C8B84C", "#4CE8D4", "#E84C4C",
  "#7AB84C", "#4C7AE8",
];

function color(i: number): string {
  return COLORS[i % COLORS.length];
}

// ── 공통 유틸 ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 눈금 값 목록 계산 */
function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    const base = min === 0 ? 1 : Math.abs(min);
    min = min - base;
    max = max + base;
  }
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.ceil(rawStep / mag) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(1) + "K";
  return String(Math.round(v * 100) / 100);
}

// ── SVG 레이아웃 상수 ─────────────────────────────────────────────────────────

const W = 680, H = 420;
const ML = 70, MR = 30, MT = 55, MB = 75;
const CW = W - ML - MR;
const CH = H - MT - MB;

function svgOpen(title: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
    `viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif">\n` +
    `<rect width="${W}" height="${H}" fill="white" rx="4"/>\n` +
    `<text x="${W / 2}" y="30" text-anchor="middle" font-size="15" font-weight="bold" fill="#222">${esc(title)}</text>\n`
  );
}

function svgAxes(ticks: number[], yScale: (v: number) => number, xLabels: string[], xStep: number): string {
  const lines: string[] = [];

  // Y 그리드 & 눈금
  for (const t of ticks) {
    const y = MT + yScale(t);
    lines.push(`<line x1="${ML}" y1="${y}" x2="${ML + CW}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`);
    lines.push(`<text x="${ML - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${fmtNum(t)}</text>`);
  }

  // 축 선
  lines.push(`<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + CH}" stroke="#aaa" stroke-width="1.5"/>`);
  lines.push(`<line x1="${ML}" y1="${MT + CH}" x2="${ML + CW}" y2="${MT + CH}" stroke="#aaa" stroke-width="1.5"/>`);

  // X 레이블
  xLabels.forEach((lbl, i) => {
    const x = ML + xStep * i + xStep / 2;
    lines.push(
      `<text x="${x}" y="${MT + CH + 18}" text-anchor="middle" font-size="11" fill="#555" ` +
        `transform="rotate(-25 ${x} ${MT + CH + 18})">${esc(lbl)}</text>`
    );
  });

  return lines.join("\n");
}

function svgLegend(labels: string[], startX: number, startY: number): string {
  return labels
    .map((lbl, i) => {
      const x = startX + i * 110;
      const y = startY;
      return (
        `<rect x="${x}" y="${y}" width="12" height="12" fill="${color(i)}" rx="2"/>` +
        `<text x="${x + 16}" y="${y + 10}" font-size="11" fill="#444">${esc(lbl)}</text>`
      );
    })
    .join("\n");
}

function svgClose(): string {
  return "</svg>";
}

// ── 막대 차트 ─────────────────────────────────────────────────────────────────

function buildBarChart(
  title: string,
  data: Record<string, unknown>[],
  xField: string,
  yField: string,
  colorField?: string
): string {
  const categories = [...new Set(data.map((d) => String(d[xField] ?? "")))];
  const series = colorField
    ? [...new Set(data.map((d) => String(d[colorField] ?? "")))]
    : [yField];

  // 값 범위
  const allVals = data.map((d) => Number(d[yField]) || 0);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(...allVals, 0);
  const ticks = niceTicks(minVal, maxVal);
  const tMin = ticks[0], tMax = ticks[ticks.length - 1];
  const yScale = (v: number) => CH * (1 - (v - tMin) / (tMax - tMin));
  const zero = MT + yScale(0);

  const xStep = CW / categories.length;
  const barW = (xStep * 0.7) / series.length;
  const gap = xStep * 0.15;

  const parts: string[] = [svgOpen(title)];
  parts.push(svgAxes(ticks, yScale, categories, xStep));

  // 막대
  categories.forEach((cat, ci) => {
    series.forEach((ser, si) => {
      const row = colorField
        ? data.find((d) => String(d[xField]) === cat && String(d[colorField]) === ser)
        : data.find((d) => String(d[xField]) === cat);
      const val = row ? Number(row[yField]) || 0 : 0;
      const barX = ML + xStep * ci + gap + barW * si;
      const barY = Math.min(MT + yScale(val), zero);
      const barH = Math.abs(yScale(val) - yScale(0));
      const c = color(si);
      parts.push(
        `<rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" ` +
          `width="${barW.toFixed(1)}" height="${Math.max(barH, 1).toFixed(1)}" ` +
          `fill="${c}" opacity="0.85" rx="2"/>`
      );
      if (barH > 14) {
        const labelY = val >= 0 ? barY - 3 : barY + barH + 12;
        parts.push(
          `<text x="${(barX + barW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" ` +
            `text-anchor="middle" font-size="10" fill="#444">${fmtNum(val)}</text>`
        );
      }
    });
  });

  // 범례 (series > 1 일 때)
  if (series.length > 1) {
    const legendX = ML + (CW - series.length * 110) / 2;
    parts.push(svgLegend(series, legendX, H - 22));
  }

  parts.push(svgClose());
  return parts.join("\n");
}

// ── 선 차트 ───────────────────────────────────────────────────────────────────

function buildLineChart(
  title: string,
  data: Record<string, unknown>[],
  xField: string,
  yField: string,
  seriesField?: string
): string {
  const series = seriesField
    ? [...new Set(data.map((d) => String(d[seriesField] ?? "")))]
    : [yField];
  const xLabels = [...new Set(data.map((d) => String(d[xField] ?? "")))];

  const allVals = data.map((d) => Number(d[yField]) || 0);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const ticks = niceTicks(minVal, maxVal);
  const tMin = ticks[0], tMax = ticks[ticks.length - 1];
  const yScale = (v: number) => CH * (1 - (v - tMin) / (tMax - tMin));

  const xStep = CW / (xLabels.length - 1 || 1);

  const parts: string[] = [svgOpen(title)];
  parts.push(svgAxes(ticks, yScale, xLabels, CW / xLabels.length));

  series.forEach((ser, si) => {
    const rows = seriesField
      ? data.filter((d) => String(d[seriesField]) === ser)
      : data;

    const points = xLabels.map((lbl, xi) => {
      const row = rows.find((d) => String(d[xField]) === lbl);
      const val = row ? Number(row[yField]) || 0 : 0;
      return [ML + xStep * xi, MT + yScale(val)] as [number, number];
    });

    const c = color(si);
    const pointsStr = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    parts.push(
      `<polyline points="${pointsStr}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    );
    // 데이터 포인트
    for (const [px, py] of points) {
      parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="${c}" stroke="white" stroke-width="1.5"/>`);
    }
  });

  if (series.length > 1) {
    const legendX = ML + (CW - series.length * 110) / 2;
    parts.push(svgLegend(series, legendX, H - 22));
  }

  parts.push(svgClose());
  return parts.join("\n");
}

// ── 산점도 ────────────────────────────────────────────────────────────────────

function buildScatterPlot(
  title: string,
  data: Record<string, unknown>[],
  xField: string,
  yField: string,
  colorField?: string
): string {
  const series = colorField
    ? [...new Set(data.map((d) => String(d[colorField] ?? "")))]
    : ["data"];

  const xVals = data.map((d) => Number(d[xField]) || 0);
  const yVals = data.map((d) => Number(d[yField]) || 0);
  const xTicks = niceTicks(Math.min(...xVals), Math.max(...xVals));
  const yTicks = niceTicks(Math.min(...yVals), Math.max(...yVals));
  const xMin = xTicks[0], xMax = xTicks[xTicks.length - 1];
  const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];

  const xScale = (v: number) => CW * (v - xMin) / (xMax - xMin);
  const yScale = (v: number) => CH * (1 - (v - yMin) / (yMax - yMin));

  const parts: string[] = [svgOpen(title)];

  // Y 그리드 & 눈금
  const axisParts: string[] = [];
  for (const t of yTicks) {
    const y = MT + yScale(t);
    axisParts.push(`<line x1="${ML}" y1="${y}" x2="${ML + CW}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`);
    axisParts.push(`<text x="${ML - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${fmtNum(t)}</text>`);
  }
  // X 그리드 & 눈금
  for (const t of xTicks) {
    const x = ML + xScale(t);
    axisParts.push(`<line x1="${x}" y1="${MT}" x2="${x}" y2="${MT + CH}" stroke="#e8e8e8" stroke-width="1"/>`);
    axisParts.push(`<text x="${x}" y="${MT + CH + 16}" text-anchor="middle" font-size="11" fill="#555">${fmtNum(t)}</text>`);
  }
  axisParts.push(`<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + CH}" stroke="#aaa" stroke-width="1.5"/>`);
  axisParts.push(`<line x1="${ML}" y1="${MT + CH}" x2="${ML + CW}" y2="${MT + CH}" stroke="#aaa" stroke-width="1.5"/>`);
  parts.push(axisParts.join("\n"));

  // 축 레이블
  parts.push(`<text x="${ML + CW / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#555">${esc(xField)}</text>`);
  parts.push(
    `<text x="14" y="${MT + CH / 2}" text-anchor="middle" font-size="12" fill="#555" ` +
      `transform="rotate(-90 14 ${MT + CH / 2})">${esc(yField)}</text>`
  );

  // 점
  for (const row of data) {
    const xv = Number(row[xField]) || 0;
    const yv = Number(row[yField]) || 0;
    const serIdx = colorField
      ? series.indexOf(String(row[colorField] ?? ""))
      : 0;
    const cx = ML + xScale(xv);
    const cy = MT + yScale(yv);
    const lbl = colorField ? String(row[colorField] ?? "") : "";
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" ` +
        `fill="${color(serIdx)}" opacity="0.75" stroke="white" stroke-width="1">` +
        (lbl ? `<title>${esc(lbl)}: (${fmtNum(xv)}, ${fmtNum(yv)})</title>` : "") +
        `</circle>`
    );
  }

  if (series.length > 1 && colorField) {
    const legendX = ML + (CW - series.length * 110) / 2;
    parts.push(svgLegend(series, legendX, H - 22));
  }

  parts.push(svgClose());
  return parts.join("\n");
}

// ── 도구 등록 ─────────────────────────────────────────────────────────────────

const DataRow = z.record(z.unknown()).describe("데이터 행 (임의의 필드 포함 가능)");

export function registerChartTools(server: McpServer): void {
  // ─── 1. Bar Chart ─────────────────────────────────────────────────────────
  server.tool(
    "generate_bar_chart",
    "SVG 막대 차트를 생성합니다 (외부 의존성 없음). " +
      "카테고리별 수치 비교에 적합합니다. " +
      "color_field 지정 시 그룹별 막대가 나란히 표시됩니다. " +
      "반환값은 SVG 마크업으로, HTML에 직접 삽입하거나 .svg 파일로 저장할 수 있습니다.",
    {
      title: z.string().describe("차트 제목"),
      data: z.array(DataRow).describe("데이터 배열. 각 행은 x_field와 y_field를 포함해야 함"),
      x_field: z.string().describe("x축 카테고리 필드명"),
      y_field: z.string().describe("y축 수치 필드명"),
      color_field: z.string().optional().describe("그룹/색상 구분 필드명. 지정 시 그룹 막대 차트"),
    },
    async ({ title, data, x_field, y_field, color_field }) => {
      const svg = buildBarChart(
        title,
        data as Record<string, unknown>[],
        x_field,
        y_field,
        color_field
      );
      return { content: [{ type: "text" as const, text: svg }] };
    }
  );

  // ─── 2. Line Chart ────────────────────────────────────────────────────────
  server.tool(
    "generate_line_chart",
    "SVG 선 차트를 생성합니다 (외부 의존성 없음). " +
      "시계열 데이터, 추세, 변화 패턴 표현에 적합합니다. " +
      "series_field 지정 시 여러 계열을 색상으로 구분합니다. " +
      "반환값은 SVG 마크업.",
    {
      title: z.string().describe("차트 제목"),
      data: z.array(DataRow).describe("데이터 배열"),
      x_field: z.string().describe("x축 레이블 필드명 (날짜, 카테고리 등)"),
      y_field: z.string().describe("y축 수치 필드명"),
      series_field: z.string().optional().describe("계열 구분 필드명. 지정 시 다중 선 차트"),
    },
    async ({ title, data, x_field, y_field, series_field }) => {
      const svg = buildLineChart(
        title,
        data as Record<string, unknown>[],
        x_field,
        y_field,
        series_field
      );
      return { content: [{ type: "text" as const, text: svg }] };
    }
  );

  // ─── 3. Scatter Plot ──────────────────────────────────────────────────────
  server.tool(
    "generate_scatter_plot",
    "SVG 산점도를 생성합니다 (외부 의존성 없음). " +
      "두 수치 변수 간의 상관관계, 분포 패턴 표현에 적합합니다. " +
      "color_field 지정 시 그룹별 색상으로 구분됩니다. " +
      "반환값은 SVG 마크업.",
    {
      title: z.string().describe("차트 제목"),
      data: z.array(DataRow).describe("데이터 배열"),
      x_field: z.string().describe("x축 수치 필드명"),
      y_field: z.string().describe("y축 수치 필드명"),
      color_field: z.string().optional().describe("색상/그룹 구분 필드명"),
    },
    async ({ title, data, x_field, y_field, color_field }) => {
      const svg = buildScatterPlot(
        title,
        data as Record<string, unknown>[],
        x_field,
        y_field,
        color_field
      );
      return { content: [{ type: "text" as const, text: svg }] };
    }
  );
}

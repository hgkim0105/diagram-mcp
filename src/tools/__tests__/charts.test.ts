import { describe, it, expect, beforeAll } from "vitest";
import { registerChartTools } from "../charts.js";
import { createMockServer } from "./helpers.js";

let call: (name: string, args: Record<string, unknown>) => Promise<string>;

beforeAll(() => {
  const { server, callTool } = createMockServer();
  registerChartTools(server);
  call = callTool;
});

function isSvg(out: string): boolean {
  return out.startsWith("<svg") && out.trimEnd().endsWith("</svg>");
}

// ── Bar Chart ──────────────────────────────────────────────────────────────────

describe("generate_bar_chart", () => {
  it("기본 막대 차트 - 유효한 SVG 반환", async () => {
    const out = await call("generate_bar_chart", {
      title: "Monthly Sales",
      data: [
        { month: "Jan", sales: 100 },
        { month: "Feb", sales: 200 },
        { month: "Mar", sales: 150 },
      ],
      x_field: "month",
      y_field: "sales",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("Monthly Sales");
    expect(out).toContain("<rect");
    expect(out).toContain("Jan");
    expect(out).toContain("Feb");
    expect(out).toContain("Mar");
  });

  it("color_field로 그룹 막대 차트", async () => {
    const out = await call("generate_bar_chart", {
      title: "Grouped",
      data: [
        { category: "A", value: 10, group: "X" },
        { category: "A", value: 20, group: "Y" },
        { category: "B", value: 30, group: "X" },
        { category: "B", value: 40, group: "Y" },
      ],
      x_field: "category",
      y_field: "value",
      color_field: "group",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("X");
    expect(out).toContain("Y");
    // 범례 SVG 요소 존재 확인
    expect(out).toContain("rect");
  });

  it("음수 값 포함 차트", async () => {
    const out = await call("generate_bar_chart", {
      title: "Profit/Loss",
      data: [
        { quarter: "Q1", profit: 100 },
        { quarter: "Q2", profit: -50 },
        { quarter: "Q3", profit: 200 },
      ],
      x_field: "quarter",
      y_field: "profit",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("Profit/Loss");
  });

  it("대형 숫자 - K/M 포맷 적용", async () => {
    const out = await call("generate_bar_chart", {
      title: "Revenue",
      data: [
        { month: "Jan", revenue: 1_500_000 },
        { month: "Feb", revenue: 3_000_000 },
      ],
      x_field: "month",
      y_field: "revenue",
    });
    expect(isSvg(out)).toBe(true);
    // 1.5M 또는 3.0M 형식 포함 여부
    expect(out).toMatch(/[0-9.]+[KM]/);
  });

  it("단일 데이터 포인트", async () => {
    const out = await call("generate_bar_chart", {
      title: "Single",
      data: [{ label: "Only", value: 42 }],
      x_field: "label",
      y_field: "value",
    });
    expect(isSvg(out)).toBe(true);
  });

  it("모든 값이 동일 (niceTicks 엣지 케이스)", async () => {
    const out = await call("generate_bar_chart", {
      title: "Same",
      data: [
        { x: "A", y: 100 },
        { x: "B", y: 100 },
      ],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
  });

  it("특수문자 제목/레이블 이스케이프", async () => {
    const out = await call("generate_bar_chart", {
      title: "Sales <2024> & More",
      data: [{ cat: "A&B", val: 10 }],
      x_field: "cat",
      y_field: "val",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("&amp;");
    expect(out).toContain("&lt;");
    expect(out).toContain("&gt;");
  });

  it("0 값 포함", async () => {
    const out = await call("generate_bar_chart", {
      title: "Zero Test",
      data: [
        { x: "A", y: 0 },
        { x: "B", y: 50 },
      ],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
  });
});

// ── Line Chart ─────────────────────────────────────────────────────────────────

describe("generate_line_chart", () => {
  it("기본 선 차트 - 유효한 SVG 반환", async () => {
    const out = await call("generate_line_chart", {
      title: "Page Views",
      data: [
        { date: "2024-01", views: 1000 },
        { date: "2024-02", views: 1500 },
        { date: "2024-03", views: 1200 },
        { date: "2024-04", views: 1800 },
      ],
      x_field: "date",
      y_field: "views",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("Page Views");
    expect(out).toContain("<polyline");
    expect(out).toContain("<circle");
    expect(out).toContain("2024-01");
  });

  it("series_field로 다중 계열", async () => {
    const out = await call("generate_line_chart", {
      title: "Multi Series",
      data: [
        { month: "Jan", value: 10, series: "A" },
        { month: "Feb", value: 20, series: "A" },
        { month: "Jan", value: 30, series: "B" },
        { month: "Feb", value: 15, series: "B" },
      ],
      x_field: "month",
      y_field: "value",
      series_field: "series",
    });
    expect(isSvg(out)).toBe(true);
    // 두 개의 polyline 존재
    const polylineCount = (out.match(/<polyline/g) || []).length;
    expect(polylineCount).toBeGreaterThanOrEqual(2);
    // 범례 존재
    expect(out).toContain("A");
    expect(out).toContain("B");
  });

  it("단일 데이터 포인트", async () => {
    const out = await call("generate_line_chart", {
      title: "Single Point",
      data: [{ x: "Jan", y: 100 }],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
  });

  it("대형 숫자 K 포맷", async () => {
    const out = await call("generate_line_chart", {
      title: "Requests",
      data: [
        { time: "00:00", req: 5000 },
        { time: "01:00", req: 12000 },
        { time: "02:00", req: 8000 },
      ],
      x_field: "time",
      y_field: "req",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toMatch(/\d+(\.\d+)?K/);
  });

  it("음수 값 포함 선 차트", async () => {
    const out = await call("generate_line_chart", {
      title: "Temperature",
      data: [
        { day: "Mon", temp: -5 },
        { day: "Tue", temp: 3 },
        { day: "Wed", temp: -2 },
      ],
      x_field: "day",
      y_field: "temp",
    });
    expect(isSvg(out)).toBe(true);
  });

  it("모든 값 동일 (niceTicks 엣지 케이스)", async () => {
    const out = await call("generate_line_chart", {
      title: "Flat",
      data: [
        { x: "A", y: 50 },
        { x: "B", y: 50 },
        { x: "C", y: 50 },
      ],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
  });
});

// ── Scatter Plot ───────────────────────────────────────────────────────────────

describe("generate_scatter_plot", () => {
  it("기본 산점도 - 유효한 SVG 반환", async () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      x: i * 2,
      y: i * i * 0.5 + Math.random() * 5,
    }));
    const out = await call("generate_scatter_plot", {
      title: "Correlation",
      data,
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("Correlation");
    expect(out).toContain("<circle");
  });

  it("color_field로 그룹 산점도", async () => {
    const out = await call("generate_scatter_plot", {
      title: "Grouped Scatter",
      data: [
        { x: 1, y: 2, group: "A" },
        { x: 2, y: 3, group: "A" },
        { x: 3, y: 1, group: "B" },
        { x: 4, y: 4, group: "B" },
      ],
      x_field: "x",
      y_field: "y",
      color_field: "group",
    });
    expect(isSvg(out)).toBe(true);
    // 툴팁 title 요소 확인
    expect(out).toContain("<title>");
    // 범례
    expect(out).toContain("A");
    expect(out).toContain("B");
  });

  it("축 레이블 표시", async () => {
    const out = await call("generate_scatter_plot", {
      title: "Height vs Weight",
      data: [{ height: 170, weight: 65 }],
      x_field: "height",
      y_field: "weight",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("height");
    expect(out).toContain("weight");
  });

  it("모든 값 동일 X (niceTicks 엣지 케이스)", async () => {
    const out = await call("generate_scatter_plot", {
      title: "Same X",
      data: [
        { x: 5, y: 10 },
        { x: 5, y: 20 },
        { x: 5, y: 30 },
      ],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
  });

  it("모든 값 0인 케이스", async () => {
    const out = await call("generate_scatter_plot", {
      title: "Zero",
      data: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
  });

  it("대형 숫자 M 포맷", async () => {
    const out = await call("generate_scatter_plot", {
      title: "Big Numbers",
      data: [
        { x: 1_000_000, y: 2_000_000 },
        { x: 3_000_000, y: 4_000_000 },
      ],
      x_field: "x",
      y_field: "y",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toMatch(/[0-9.]+M/);
  });

  it("특수문자 color_field 이스케이프", async () => {
    const out = await call("generate_scatter_plot", {
      title: "Escape Test",
      data: [
        { x: 1, y: 2, group: "A & B" },
        { x: 3, y: 4, group: "<C>" },
      ],
      x_field: "x",
      y_field: "y",
      color_field: "group",
    });
    expect(isSvg(out)).toBe(true);
    expect(out).toContain("&amp;");
    expect(out).toContain("&lt;");
  });
});

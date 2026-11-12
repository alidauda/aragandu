import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { Text } from "@/components/text";
import { color, font, space } from "@/theme";

/** One mark on a chart. A null value is a day with nothing entered: a gap, not a zero. */
export type Point = { key: string; label: string; value: number | null };

type ChartProps = {
  points: Point[];
  /** How a value reads in the line above the chart: "142 crates". */
  format: (v: number) => string;
  height?: number;
  /** The top of the scale, when it isn't the data's own (100 for a percentage). */
  max?: number;
  tint?: string;
};

const AXIS = 36;
const TOP = 8;

/** A round number at or above the largest value, so the scale's lines land on clean figures. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(v));
  const lead = v / step;
  return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * step;
}

const compact = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${+v.toFixed(1)}`);

/** The frame both charts share: a readout of the chosen mark, a scale, and a place to press each mark. */
function Frame({ points, format, height = 150, max, children }: ChartProps & { children: (g: { w: number; h: number; top: number; chosen: number }) => ReactNode }) {
  const [width, setWidth] = useState(0);
  const lastFilled = points.reduce((a, p, i) => (p.value !== null ? i : a), -1);
  const [picked, setPicked] = useState<string | null>(null);
  const found = points.findIndex((p) => p.key === picked);
  const chosen = found >= 0 ? found : lastFilled;
  const top = max ?? niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)));
  const w = Math.max(0, width - AXIS);
  const h = height - TOP;
  const at = points[chosen];
  const ends = points.length > 2 ? [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]] : points;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md }}>
        <Text style={{ fontSize: font.figure, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{at && at.value !== null ? format(at.value) : "—"}</Text>
        <Text style={{ fontSize: font.small, color: color.muted }}>{at ? at.label : ""}</Text>
      </View>
      <View style={{ height, flexDirection: "row" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={{ width: AXIS, height, justifyContent: "space-between", paddingBottom: 0 }}>
          {[top, top / 2, 0].map((v, i) => (
            <Text key={i} style={{ fontSize: 11, color: color.muted, lineHeight: 14, marginTop: i === 0 ? TOP - 7 : 0, marginBottom: i === 2 ? -7 : 0 }}>
              {compact(v)}
            </Text>
          ))}
        </View>
        {w > 0 ? (
          <View style={{ width: w, height }}>
            <Svg width={w} height={height}>
              {[0, 0.5, 1].map((f) => (
                <Line key={f} x1={0} x2={w} y1={TOP + h * f} y2={TOP + h * f} stroke={color.grid} strokeWidth={1} />
              ))}
              {children({ w, h, top, chosen })}
            </Svg>
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
              {points.map((p) => (
                <Pressable key={p.key} accessibilityLabel={`${p.label}: ${p.value === null ? "nothing entered" : format(p.value)}`} onPress={() => setPicked(p.key)} style={{ flex: 1 }} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginLeft: AXIS }}>
        {ends.map((p) => (
          <Text key={p.key} style={{ fontSize: 11, color: color.muted }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Amounts per day: one bar each, the chosen one in full colour. Press a bar to read it. */
export function BarChart(props: ChartProps) {
  const tint = props.tint ?? color.chart;
  return (
    <Frame {...props}>
      {({ w, h, top, chosen }) => {
        const slot = w / props.points.length;
        const bar = Math.max(2, Math.min(24, slot - 2));
        return props.points.map((p, i) => {
          if (!p.value) return null;
          const tall = Math.max(2, (h * p.value) / top);
          const x = i * slot + (slot - bar) / 2;
          const y = TOP + h - tall;
          const r = Math.min(4, bar / 2, tall);
          // Rounded at the top, square on the baseline.
          const d = `M${x},${y + tall} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${y + tall} Z`;
          return <Path key={p.key} d={d} fill={tint} opacity={i === chosen ? 1 : 0.42} />;
        });
      }}
    </Frame>
  );
}

/** A rate or a weight over time: a line, broken where nothing was entered. Press a day to read it. */
export function LineChart(props: ChartProps) {
  const tint = props.tint ?? color.chart;
  return (
    <Frame {...props}>
      {({ w, h, top, chosen }) => {
        const n = props.points.length;
        const xOf = (i: number) => (n === 1 ? w / 2 : 5 + ((w - 10) * i) / (n - 1));
        const yOf = (v: number) => TOP + h - (h * Math.min(v, top)) / top;
        let line = "";
        let pen = false;
        props.points.forEach((p, i) => {
          if (p.value === null) return void (pen = false);
          line += `${pen ? "L" : "M"}${xOf(i)},${yOf(p.value)} `;
          pen = true;
        });
        const filled = props.points.map((p, i) => ({ p, i })).filter((x) => x.p.value !== null);
        // The wash under the line only when the line is unbroken.
        const whole = filled.length === n && n > 1;
        const at = props.points[chosen];
        return (
          <>
            {whole ? <Path d={`${line}L${xOf(n - 1)},${TOP + h} L${xOf(0)},${TOP + h} Z`} fill={tint} opacity={0.1} /> : null}
            <Path d={line} stroke={tint} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            {/* A lone point between gaps has no line to show it. */}
            {filled.length <= 2 ? filled.map(({ p, i }) => <Circle key={p.key} cx={xOf(i)} cy={yOf(p.value as number)} r={3} fill={tint} />) : null}
            {at && at.value !== null ? (
              <>
                <Line x1={xOf(chosen)} x2={xOf(chosen)} y1={TOP} y2={TOP + h} stroke={color.line} strokeWidth={1} />
                <Circle cx={xOf(chosen)} cy={yOf(at.value)} r={5} fill={tint} stroke="#ffffff" strokeWidth={2} />
              </>
            ) : null}
          </>
        );
      }}
    </Frame>
  );
}

/** A share of a whole as a ring, with whatever is given in its middle. */
export function Ring({ pct, size, stroke = 10, tint, track, children }: { pct: number | null; size: number; stroke?: number; tint: string; track: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const round = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(100, pct ?? 0)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {share > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tint}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${round * share} ${round}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** A figure's recent shape, small enough to sit in a tile: no scale, no labels. */
export function Spark({ values, width = 72, height = 28, tint = color.chart }: { values: number[]; width?: number; height?: number; tint?: string }) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const top = Math.max(...values, 1e-9);
  const xOf = (i: number) => 3 + ((width - 6) * i) / (values.length - 1);
  const yOf = (v: number) => 3 + (height - 6) * (1 - v / top);
  const d = values.map((v, i) => `${i ? "L" : "M"}${xOf(i)},${yOf(v)}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={tint} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <Circle cx={xOf(values.length - 1)} cy={yOf(values[values.length - 1])} r={3} fill={tint} />
    </Svg>
  );
}

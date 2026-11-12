import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { color, font, lift, radius, space } from "@/theme";
import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        { backgroundColor: color.card, borderRadius: radius.md, borderCurve: "continuous", padding: space.lg, gap: space.md, boxShadow: lift },
        style,
      ]}>
      {children}
    </View>
  );
}

/** A card's heading, with a quieter line beside or under it. */
export function CardTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: font.body + 1, fontWeight: "700", color: color.ink }}>{children}</Text>
      {sub ? <Text style={{ fontSize: font.small, color: color.muted }}>{sub}</Text> : null}
    </View>
  );
}

/** A heading between groups of cards. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={{ marginTop: space.sm, fontSize: font.small, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

/** A labelled figure: "Eggs today · 69 crates 18 pcs". */
export function Figure({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.md }}>
      <Text style={{ fontSize: font.label, color: color.body, flexShrink: 1 }}>{label}</Text>
      <Text selectable style={{ fontSize: font.body, fontWeight: "700", color: tone === "warn" ? color.warn : color.ink, fontVariant: ["tabular-nums"], textAlign: "right", flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}

/** A figure in a small box with its icon: several sit side by side. */
export function Tile({ icon, label, value, tone, children }: { icon: IconName; label: string; value: string; tone?: "warn"; children?: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: tone === "warn" ? color.warnSoft : color.bg, borderRadius: radius.sm, borderCurve: "continuous", padding: space.md, gap: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={16} color={tone === "warn" ? color.warn : color.muted} />
        <Text style={{ fontSize: font.small, color: tone === "warn" ? color.warn : color.muted, fontWeight: "500" }}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.sm }}>
        <Text selectable style={{ fontSize: 17, fontWeight: "700", color: color.ink, fontVariant: ["tabular-nums"], flexShrink: 1 }}>
          {value}
        </Text>
        {children}
      </View>
    </View>
  );
}

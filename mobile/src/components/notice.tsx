import { Text, View } from "react-native";

import { color, font, radius, space } from "@/theme";

const TONES = {
  good: [color.goodSoft, color.good],
  warn: [color.warnSoft, color.warn],
  bad: [color.badSoft, color.bad],
  plain: [color.brandSoft, color.brandDark],
} as const;

/** A message on the page: saved, kept for later, or what went wrong. */
export function Notice({ tone, children }: { tone: keyof typeof TONES; children: string }) {
  const [bg, ink] = TONES[tone];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: radius.sm, borderCurve: "continuous", padding: space.md }}>
      <Text selectable style={{ color: ink, fontSize: font.label, fontWeight: "600", lineHeight: 20 }}>
        {children}
      </Text>
    </View>
  );
}

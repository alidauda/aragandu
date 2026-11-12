import { ActivityIndicator, Pressable, Text } from "react-native";

import { color, font, radius, space } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  /** primary: the page's main action. quiet: a lesser one. danger: removes something. */
  kind?: "primary" | "quiet" | "danger";
  busy?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, kind = "primary", busy, disabled }: Props) {
  const off = busy || disabled;
  const filled = kind === "primary";
  const ink = filled ? "#ffffff" : kind === "danger" ? color.bad : color.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      android_ripple={{ color: filled ? color.brandDark : color.brandSoft }}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: space.sm,
        backgroundColor: filled ? color.brand : color.card,
        borderWidth: filled ? 0 : 1,
        borderColor: kind === "danger" ? color.bad : color.line,
        opacity: off ? 0.55 : pressed ? 0.85 : 1,
        overflow: "hidden",
      })}>
      {busy ? <ActivityIndicator color={ink} /> : null}
      <Text style={{ color: ink, fontSize: font.body + 1, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

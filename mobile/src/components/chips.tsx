import { Pressable, ScrollView, View } from "react-native";

import { color, font, space } from "@/theme";
import { Text } from "@/components/text";

type Props<T> = {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** One row that scrolls sideways (for a run of days); otherwise they wrap. */
  scroll?: boolean;
};

/** Pick one of a few: the feed type, the day, the buyer kind. */
export function Chips<T extends string | number>({ label, options, value, onChange, scroll }: Props<T>) {
  const chips = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable
        key={String(o.value)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => onChange(o.value)}
        style={{
          minHeight: 42,
          paddingHorizontal: space.lg,
          borderRadius: 21,
          justifyContent: "center",
          borderWidth: 1,
          borderColor: on ? color.brand : color.line,
          backgroundColor: on ? color.brand : "#ffffff",
        }}>
        <Text style={{ fontSize: font.label, fontWeight: "600", color: on ? "#ffffff" : color.body }}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space.xs }}>
      {label ? <Text style={{ fontSize: font.small, fontWeight: "600", color: color.body }}>{label}</Text> : null}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm }}>
          {chips}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{chips}</View>
      )}
    </View>
  );
}

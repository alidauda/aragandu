import { Children, type ReactNode } from "react";
import { Text, TextInput, View } from "react-native";

import { color, font, radius, space } from "@/theme";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** whole: a count. decimal: bags, litres, kilograms. text: a name. */
  kind?: "whole" | "decimal" | "text" | "email" | "password";
  hint?: string;
  placeholder?: string;
};

/** A labelled box. Number boxes open the number keys. */
export function Field({ label, value, onChange, kind = "whole", hint, placeholder }: Props) {
  const number = kind === "whole" || kind === "decimal";
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontSize: font.small, fontWeight: "600", color: color.body }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? (number ? "0" : undefined)}
        placeholderTextColor="#a9b4b3"
        keyboardType={kind === "whole" ? "number-pad" : kind === "decimal" ? "decimal-pad" : kind === "email" ? "email-address" : "default"}
        inputMode={kind === "whole" ? "numeric" : kind === "decimal" ? "decimal" : kind === "email" ? "email" : "text"}
        secureTextEntry={kind === "password"}
        autoCapitalize={kind === "text" ? "words" : "none"}
        autoCorrect={false}
        selectTextOnFocus={number}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: radius.sm,
          borderCurve: "continuous",
          backgroundColor: "#ffffff",
          paddingHorizontal: space.md,
          fontSize: font.input,
          color: color.ink,
          fontVariant: number ? ["tabular-nums"] : undefined,
        }}
      />
      {hint ? <Text style={{ fontSize: font.small - 1, color: color.muted }}>{hint}</Text> : null}
    </View>
  );
}

/** Fields side by side, sharing the width; they wrap on a narrow phone. */
export function FieldRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
      {Children.map(children, (child) => (
        <View style={{ flex: 1, minWidth: 96 }}>{child}</View>
      ))}
    </View>
  );
}

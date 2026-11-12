import { StyleSheet, Text as NativeText, type TextProps } from "react-native";

import { color, familyFor, font } from "@/theme";

/**
 * The app's text: Jost, with the weight in the style choosing the font file
 * (a custom font can't be made bold by the phone without smearing it).
 */
export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight, ...others } = flat;
  return <NativeText {...rest} style={[{ fontSize: font.body, color: color.ink }, others, { fontFamily: familyFor(fontWeight) }]} />;
}

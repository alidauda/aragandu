import { Children, type ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";

import { space } from "@/theme";

/** How wide a screen has to be before cards sit side by side (a tablet, or a phone on its side). */
export const WIDE = 720;

/** Cards one under another on a phone, two across on a tablet. */
export function Grid({ children }: { children: ReactNode }) {
  const wide = useWindowDimensions().width >= WIDE;
  if (!wide) return <View style={{ gap: space.md }}>{children}</View>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, alignItems: "flex-start" }}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ flexGrow: 1, flexBasis: "46%", minWidth: 320 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

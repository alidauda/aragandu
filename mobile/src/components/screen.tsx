import { useHeaderHeight } from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, View } from "react-native";

import { sync, useFarm } from "@/farm/store";
import { color, space } from "@/theme";

/**
 * A page that scrolls, keeps its fields above the keyboard, and reloads when
 * pulled down. `hero` runs edge to edge above the page's padded content;
 * `narrow` is for forms.
 */
export function Screen({ children, hero, narrow }: { children: ReactNode; hero?: ReactNode; narrow?: boolean }) {
  const { syncing } = useFarm();
  // The page sits under the header, so the keyboard's push is measured from below it.
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView
        contentInsetAdjustmentBehavior={hero ? "never" : "automatic"}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void sync()} tintColor={color.brand} colors={[color.brand]} />}>
        {hero}
        {/* On a tablet the page keeps to a readable width: forms narrower than dashboards. */}
        <View style={{ padding: space.lg, paddingBottom: 48, gap: space.md, width: "100%", maxWidth: narrow ? 720 : 1180, alignSelf: "center" }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

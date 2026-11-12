import { useHeaderHeight } from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, View } from "react-native";

import { sync, useFarm } from "@/farm/store";
import { color, space } from "@/theme";

/**
 * A page that scrolls, keeps its fields above the keyboard, and reloads when
 * pulled down. `hero` runs edge to edge above the page's padded content.
 */
export function Screen({ children, hero }: { children: ReactNode; hero?: ReactNode }) {
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
        <View style={{ padding: space.lg, paddingBottom: 48, gap: space.md }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

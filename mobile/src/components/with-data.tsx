import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import type { ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { SyncBar } from "@/components/sync-bar";
import { sync, useFarm } from "@/farm/store";
import { color, font, space } from "@/theme";

/**
 * A page that needs the farm's figures. Until they've loaded once it shows
 * that it's loading, or that there's no signal to load them with.
 */
export function WithData({ children }: { children: (S: ErpData) => ReactNode }) {
  const { data, online, syncing } = useFarm();
  if (data) {
    return (
      <Screen>
        <SyncBar />
        {children(data)}
      </Screen>
    );
  }
  return (
    <Screen>
      <View style={{ paddingTop: 80, alignItems: "center", gap: space.lg }}>
        {online || syncing ? (
          <>
            <ActivityIndicator size="large" color={color.brand} />
            <Text style={{ fontSize: font.body, color: color.body }}>Loading the farm's figures…</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: font.title, fontWeight: "700", color: color.ink }}>No signal</Text>
            <Text style={{ fontSize: font.body, color: color.body, textAlign: "center", lineHeight: 22 }}>
              The app needs to load the farm's figures once. After that it works without signal.
            </Text>
            <Button label="Try again" onPress={() => void sync()} />
          </>
        )}
      </View>
    </Screen>
  );
}

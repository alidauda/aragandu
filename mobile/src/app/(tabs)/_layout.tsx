import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icon";
import { mine, useFarm } from "@/farm/store";
import { tasksFor } from "@/farm/tasks";
import { color, family } from "@/theme";

const icon = (name: IconName) =>
  function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Icon name={name} size={size} color={focused ? color.brand : color.muted} />;
  };

export default function TabsLayout() {
  const farm = useFarm();
  const waiting = mine(farm).length;
  // An executive, or anyone with nothing to enter, has no Record tab.
  const records = !farm.data || tasksFor(farm.data).length > 0;
  // Room for the icon and its label above the phone's own bottom bar.
  const bottom = useSafeAreaInsets().bottom;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelStyle: { fontFamily: family["600"], fontSize: 12 },
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.line, height: 72 + bottom, paddingTop: 6, paddingBottom: 10 + bottom },
        headerStyle: { backgroundColor: color.brand },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontFamily: family["700"], fontSize: 20 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: color.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: icon("home") }} />
      <Tabs.Screen name="record" options={{ title: "Record", tabBarIcon: icon("record"), href: records ? undefined : null }} />
      <Tabs.Screen name="trends" options={{ title: "Trends", tabBarIcon: icon("trends") }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon("me"), tabBarBadge: waiting || undefined, tabBarBadgeStyle: { backgroundColor: color.chart2, color: "#ffffff", fontFamily: family["700"] } }} />
    </Tabs>
  );
}

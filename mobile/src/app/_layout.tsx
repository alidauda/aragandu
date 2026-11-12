import { Jost_400Regular } from "@expo-google-fonts/jost/400Regular";
import { Jost_500Medium } from "@expo-google-fonts/jost/500Medium";
import { Jost_600SemiBold } from "@expo-google-fonts/jost/600SemiBold";
import { Jost_700Bold } from "@expo-google-fonts/jost/700Bold";
import { useFonts } from "expo-font";
import * as Network from "expo-network";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";

import { noSignal, start, sync, tick, useFarm } from "@/farm/store";
import { color, family } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready, token } = useFarm();
  // If the typeface can't load, the phone's own is used: the app still opens.
  const [fonts, fontError] = useFonts({ Jost_400Regular, Jost_500Medium, Jost_600SemiBold, Jost_700Bold });
  const shown = ready && (fonts || !!fontError);

  useEffect(() => {
    void start();
  }, []);
  useEffect(() => {
    if (shown) SplashScreen.hide();
  }, [shown]);
  // Catch up when the app comes to the front, when signal returns, and each minute while it's open.
  useEffect(() => {
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") void sync();
    });
    const net = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) tick();
      else noSignal();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") tick();
    }, 60_000);
    return () => {
      app.remove();
      net.remove();
      clearInterval(timer);
    };
  }, []);

  // The sign-in page must not flash before the phone has said who's signed in.
  if (!shown) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.brand },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontFamily: family["700"], fontSize: 19 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.bg },
        }}>
        <Stack.Protected guard={!!token}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="layers-daily" options={{ title: "Layers daily entry" }} />
          <Stack.Screen name="sort-eggs" options={{ title: "Sort eggs" }} />
          <Stack.Screen name="sell-eggs" options={{ title: "Record an egg sale" }} />
          <Stack.Screen name="receipts" options={{ title: "Add a receipt" }} />
          <Stack.Screen name="birds-daily/[unit]" options={{ title: "Daily entry" }} />
          <Stack.Screen name="outbox" options={{ title: "Waiting to send" }} />
        </Stack.Protected>
        <Stack.Protected guard={!token}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

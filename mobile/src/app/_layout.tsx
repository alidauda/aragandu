import * as Network from "expo-network";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";

import { noSignal, start, sync, tick, useFarm } from "@/farm/store";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready, token } = useFarm();

  useEffect(() => {
    void start();
  }, []);
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);
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
  if (!ready) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.brand },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.bg },
        }}>
        <Stack.Protected guard={!!token}>
          <Stack.Screen name="index" options={{ title: "Argandu Farms" }} />
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

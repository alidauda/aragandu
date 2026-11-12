import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { ComponentProps } from "react";

type Material = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Each icon as the iPhone draws it (SF Symbols) and as Android does (Material). */
const ICONS = {
  home: ["house.fill", "home-variant"],
  record: ["square.and.pencil", "pencil-box-outline"],
  trends: ["chart.bar.xaxis", "chart-box-outline"],
  me: ["person.crop.circle", "account-circle-outline"],
  egg: ["oval.portrait", "egg-outline"],
  sort: ["tray.and.arrow.down", "tray-arrow-down"],
  sale: ["cart", "cart-outline"],
  receipt: ["doc.text.viewfinder", "receipt-text-outline"],
  bird: ["bird", "bird"],
  chick: ["thermometer.medium", "home-thermometer-outline"],
  feed: ["shippingbox", "sack"],
  store: ["archivebox", "archive-outline"],
  scale: ["scalemass", "scale-balance"],
  alert: ["exclamationmark.triangle.fill", "alert"],
  check: ["checkmark.circle.fill", "check-circle"],
  clock: ["clock", "clock-outline"],
  chevron: ["chevron.right", "chevron-right"],
  offline: ["wifi.slash", "wifi-off"],
  online: ["checkmark.icloud", "cloud-check-outline"],
  waiting: ["arrow.triangle.2.circlepath", "cloud-upload-outline"],
  up: ["arrow.up.right", "arrow-top-right"],
  down: ["arrow.down.right", "arrow-bottom-right"],
  signOut: ["rectangle.portrait.and.arrow.right", "logout"],
} as const satisfies Record<string, readonly [SFSymbol, Material]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const [sf, md] = ICONS[name];
  if (process.env.EXPO_OS === "ios") return <SymbolView name={sf} size={size} tintColor={color} resizeMode="scaleAspectFit" />;
  return <MaterialCommunityIcons name={md} size={size} color={color} />;
}

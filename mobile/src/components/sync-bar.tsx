import { Link } from "expo-router";
import { Pressable, Text } from "react-native";

import { ago } from "@/farm/day";
import { mine, useFarm } from "@/farm/store";
import { color, font, radius, space } from "@/theme";

/** Says when the phone is working from old figures or holding entries. Nothing shows when all is up to date. */
export function SyncBar() {
  const S = useFarm();
  const entries = mine(S);
  const waiting = entries.filter((e) => e.state === "waiting").length;
  const stuck = entries.length - waiting;
  if (S.online && entries.length === 0) return null;

  const parts = [
    S.online ? null : `No signal${S.loadedAt ? ` · figures from ${ago(S.loadedAt)}` : ""}`,
    waiting ? `${waiting} ${waiting === 1 ? "entry" : "entries"} waiting to send` : null,
    stuck ? `${stuck} ${stuck === 1 ? "entry needs" : "entries need"} a look` : null,
  ].filter(Boolean);
  const bad = stuck > 0;
  return (
    <Link href="/outbox" asChild>
      <Pressable
        accessibilityRole="link"
        style={{ backgroundColor: bad ? color.badSoft : color.warnSoft, borderRadius: radius.sm, borderCurve: "continuous", padding: space.md, flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text style={{ flex: 1, color: bad ? color.bad : color.warn, fontSize: font.label, fontWeight: "600", lineHeight: 20 }}>{parts.join(" · ")}</Text>
        <Text style={{ color: bad ? color.bad : color.warn, fontSize: font.label, fontWeight: "700" }}>View</Text>
      </Pressable>
    </Link>
  );
}

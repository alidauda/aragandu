import Constants from "expo-constants";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { roleLabels } from "@farm/access";
import type { ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, Figure } from "@/components/card";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { confirm } from "@/farm/confirm";
import { ago } from "@/farm/day";
import { mine, signOut, useFarm } from "@/farm/store";
import { color, font, space } from "@/theme";

/** Who's signed in, what they do, and how the phone stands with the website. */
export function Me({ S }: { S: ErpData }) {
  const farm = useFarm();
  const entries = mine(farm);
  const initials = S.viewer.name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const leave = () =>
    entries.length
      ? confirm("Sign out?", `${entries.length} ${entries.length === 1 ? "entry hasn't" : "entries haven't"} been sent yet. They stay on this phone and are sent when you sign in again.`, "Sign out", () => void signOut())
      : void signOut();

  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: color.sun, fontSize: 22, fontWeight: "700" }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: font.title, fontWeight: "700" }}>{S.viewer.name}</Text>
            <Text selectable style={{ fontSize: font.small, color: color.muted }}>
              {S.viewer.email}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {(roleLabels(S.viewer.grants).length ? roleLabels(S.viewer.grants) : ["No role yet"]).map((r) => (
            <View key={r} style={{ backgroundColor: color.brandSoft, borderRadius: 14, paddingHorizontal: space.md, paddingVertical: 5 }}>
              <Text style={{ fontSize: font.small, fontWeight: "600", color: color.brandDark }}>{r}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Figure label="Connection" value={farm.online ? "Connected" : "No signal"} tone={farm.online ? undefined : "warn"} />
        <Figure label="Figures loaded" value={farm.loadedAt ? ago(farm.loadedAt) : "—"} />
        <Link href="/outbox" asChild>
          <Pressable accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: 32 }}>
            <Text style={{ fontSize: font.label, color: color.body }}>Waiting to send</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontWeight: "700", color: entries.length ? color.warn : color.ink }}>{entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}` : "Nothing"}</Text>
              <Icon name="chevron" size={18} color={color.muted} />
            </View>
          </Pressable>
        </Link>
      </Card>

      <Button kind="quiet" label="Sign out" onPress={leave} />
      <Text style={{ fontSize: font.small, color: color.muted, textAlign: "center" }}>{`Argandu Farms · version ${Constants.expoConfig?.version ?? "1.0.0"}`}</Text>
    </>
  );
}

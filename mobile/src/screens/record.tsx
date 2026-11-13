import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import type { ErpData } from "@farm/erp/types";

import { Card } from "@/components/card";
import { Grid } from "@/components/grid";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { tasksFor } from "@/farm/tasks";
import { color, font, lift, radius, space } from "@/theme";

/** Everything this person can record, with today's daily records marked done or still to do. */
export function Record({ S }: { S: ErpData }) {
  const tasks = tasksFor(S);
  if (tasks.length === 0) {
    return (
      <Card>
        <Text style={{ color: color.body, lineHeight: 22 }}>Nothing to record in the app with your access. An admin can change what you do on the website (Team).</Text>
      </Card>
    );
  }
  return (
    <Grid>
      {tasks.map((t) => (
        <Link key={t.key} href={t.href} asChild>
          <Pressable
            accessibilityRole="link"
            android_ripple={{ color: color.brandSoft }}
            style={{ backgroundColor: color.card, borderRadius: radius.md, borderCurve: "continuous", padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.md, overflow: "hidden", boxShadow: lift }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, borderCurve: "continuous", backgroundColor: color.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name={t.icon} size={24} color={color.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: font.body + 1, fontWeight: "700" }}>{t.title}</Text>
              <Text style={{ fontSize: font.small, color: color.muted, lineHeight: 18 }}>{t.sub}</Text>
              {t.doneToday !== undefined ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <Icon name={t.doneToday ? "check" : "clock"} size={15} color={t.doneToday ? color.good : color.warn} />
                  <Text style={{ fontSize: font.small, fontWeight: "600", color: t.doneToday ? color.good : color.warn }}>{t.doneToday ? "Entered today" : "Not entered today"}</Text>
                </View>
              ) : null}
            </View>
            <Icon name="chevron" size={22} color={color.muted} />
          </Pressable>
        </Link>
      ))}
    </Grid>
  );
}

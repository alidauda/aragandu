import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { canAct, canSee, roleLabels, type Area } from "@farm/access";
import { broilerFeedPosition, broilerStats, UNIT } from "@farm/erp/broilers";
import { eggStock, fmtBags, fmtD, fmtEggs, fmtK, latestProduction, layersFeedPosition, ungradedEggs } from "@farm/erp/derive";
import type { BirdUnit, ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, CardTitle, Figure, SectionTitle } from "@/components/card";
import { confirm } from "@/farm/confirm";
import { ago } from "@/farm/day";
import { mine, signOut, useFarm } from "@/farm/store";
import { unitView } from "@/farm/unit";
import { color, font, radius, space } from "@/theme";

/** What can be recorded in the app, and the part of the farm each belongs to. */
const TASKS: { area: Area; href: Href; title: string; sub: string }[] = [
  { area: "layers", href: "/layers-daily", title: "Layers daily entry", sub: "Eggs, feed, water and mortality for each flock" },
  { area: "layers", href: "/sort-eggs", title: "Sort eggs", sub: "Good crates into the store, and cracks" },
  { area: "eggsales", href: "/sell-eggs", title: "Record an egg sale", sub: "Crates or cracked eggs, to a walk-in or a buyer" },
  { area: "broilers", href: "/birds-daily/broilers", title: "Broilers daily entry", sub: "Feed, water, mortality and weights for each batch" },
  { area: "brooding", href: "/birds-daily/brooding", title: "Brooding daily entry", sub: "Feed, water, mortality and weights for each batch" },
];

function Task({ href, title, sub }: { href: Href; title: string; sub: string }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        android_ripple={{ color: color.brandSoft }}
        style={{ backgroundColor: color.card, borderRadius: radius.md, borderCurve: "continuous", borderWidth: 1, borderColor: color.line, padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.md, overflow: "hidden" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: font.body + 1, fontWeight: "700", color: color.ink }}>{title}</Text>
          <Text style={{ fontSize: font.small, color: color.muted, lineHeight: 18 }}>{sub}</Text>
        </View>
        <Text style={{ fontSize: 22, color: color.brand, fontWeight: "600" }}>›</Text>
      </Pressable>
    </Link>
  );
}

function BirdsCard({ S, unit }: { S: ErpData; unit: BirdUnit }) {
  const view = unitView(S, unit);
  const stats = broilerStats(view, S.today).filter((b) => b.status === "active");
  const feed = broilerFeedPosition(view, S.today, unit);
  const lostToday = view.broilerDaily.filter((r) => r.date === S.today).reduce((a, r) => a + r.died + r.culled, 0);
  return (
    <Card>
      <CardTitle>{UNIT[unit].label}</CardTitle>
      <Figure label="Birds" value={`${fmtK(stats.reduce((a, b) => a + b.alive, 0))} in ${stats.length} ${stats.length === 1 ? "batch" : "batches"}`} />
      <Figure label="Lost today" value={fmtK(lostToday)} />
      <Figure
        label="Feed"
        value={`${fmtBags(Math.max(0, feed.stockKg), S.feedBagKg)}${feed.daysCover ? ` · ${feed.daysCover} days` : ""}`}
        tone={feed.daysCover && feed.daysCover < 7 ? "warn" : undefined}
      />
    </Card>
  );
}

function LayersCard({ S }: { S: ErpData }) {
  const feed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);
  const latest = latestProduction(S.batches, S.prodLog, S.today);
  const birds = S.batches.filter((b) => b.st === "active").reduce((a, b) => a + b.birds - b.mortality, 0);
  const eggsToday = S.prodLog.filter((p) => p.date === S.today).reduce((a, p) => a + p.eggs, 0);
  return (
    <Card>
      <CardTitle>Layers</CardTitle>
      <Figure label="Birds" value={fmtK(birds)} />
      <Figure label="Eggs today" value={fmtEggs(eggsToday, S.eggsPerCrate)} />
      <Figure
        label={latest && latest.day !== S.today ? `% production, ${fmtD(latest.day)}` : "% production today"}
        value={latest?.pct != null ? `${latest.pct.toFixed(1)}%` : "—"}
      />
      <Figure label="Eggs not yet sorted" value={fmtEggs(Math.max(0, ungradedEggs(S.prodLog, S.eggMoves, S.eggsPerCrate)), S.eggsPerCrate)} />
      <Figure label="Eggs in store" value={`${fmtK(eggStock(S.eggMoves, S.invoices))} crates`} />
      <Figure
        label="Feed"
        value={`${fmtBags(Math.max(0, feed.stockKg), S.feedBagKg)}${feed.daysCover ? ` · ${feed.daysCover} days` : ""}`}
        tone={feed.daysCover && feed.daysCover < 7 ? "warn" : undefined}
      />
    </Card>
  );
}

/** What this person can record, and their part of the farm at a glance. */
export function Home({ S }: { S: ErpData }) {
  const farm = useFarm();
  const g = S.viewer.grants;
  const tasks = TASKS.filter((t) => canAct(g, t.area, "staff"));
  const waiting = mine(farm).length;
  const sees = { layers: canSee(g, "layers"), broilers: canSee(g, "broilers"), brooding: canSee(g, "brooding") };

  const leave = () =>
    waiting
      ? confirm("Sign out?", `${waiting} ${waiting === 1 ? "entry hasn't" : "entries haven't"} been sent yet. They stay on this phone and are sent when you sign in again.`, "Sign out", () => void signOut())
      : void signOut();

  return (
    <>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: font.title, fontWeight: "700", color: color.ink }}>{S.viewer.name}</Text>
        <Text style={{ fontSize: font.label, color: color.muted }}>{roleLabels(g).join(" · ") || "No role yet"}</Text>
      </View>

      <SectionTitle>Record</SectionTitle>
      {tasks.length ? (
        tasks.map((t) => <Task key={t.title} href={t.href} title={t.title} sub={t.sub} />)
      ) : (
        <Card>
          <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>
            Nothing to record in the app with your access. An admin can change what you do on the website (Team).
          </Text>
        </Card>
      )}

      {sees.layers || sees.broilers || sees.brooding ? <SectionTitle>The farm now</SectionTitle> : null}
      {sees.layers ? <LayersCard S={S} /> : null}
      {sees.broilers ? <BirdsCard S={S} unit="broilers" /> : null}
      {sees.brooding ? <BirdsCard S={S} unit="brooding" /> : null}

      <Text style={{ fontSize: font.small, color: color.muted, textAlign: "center", marginTop: space.sm }}>
        {farm.loadedAt ? `Figures loaded ${ago(farm.loadedAt)}. Pull down to reload.` : ""}
      </Text>
      <Button kind="quiet" label="Sign out" onPress={leave} />
    </>
  );
}

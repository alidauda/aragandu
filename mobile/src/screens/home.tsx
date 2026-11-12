import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { canSee } from "@farm/access";
import { broilerFeedPosition, broilerStats, fmtKg, UNIT } from "@farm/erp/broilers";
import { eggStock, fmtBags, fmtD, fmtEggs, fmtK, latestProduction, layersFeedPosition, ungradedEggs } from "@farm/erp/derive";
import type { BirdUnit, ErpData } from "@farm/erp/types";

import { Card, CardTitle, SectionTitle, Tile } from "@/components/card";
import { BarChart, Ring, Spark } from "@/components/charts";
import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { ago, dayName } from "@/farm/day";
import { lastDays, layersSeries } from "@/farm/series";
import { mine, useFarm } from "@/farm/store";
import { tasksFor } from "@/farm/tasks";
import { unitView } from "@/farm/unit";
import { color, font, radius, space } from "@/theme";

const onBrand = "rgba(255,255,255,0.72)";

/** Morning, afternoon or evening on the farm (Lagos is an hour ahead of UTC). */
function greeting() {
  const hour = (new Date().getUTCHours() + 1) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** The top of Home: who's signed in, whether the phone is up to date, and the day's headline. */
export function HomeHero({ S }: { S: ErpData }) {
  const farm = useFarm();
  const insets = useSafeAreaInsets();
  const entries = mine(farm);
  const sync = !farm.online
    ? { icon: "offline" as const, text: "No signal" }
    : entries.length
      ? { icon: "waiting" as const, text: `${entries.length} waiting` }
      : { icon: "online" as const, text: "Up to date" };
  const g = S.viewer.grants;

  let headline = null;
  if (canSee(g, "layers")) {
    const latest = latestProduction(S.batches, S.prodLog, S.today);
    const days = layersSeries(S, lastDays(S.today, 2));
    const [before, today] = [days[0].eggs, days[1].eggs];
    const change = today > 0 && before > 0 ? Math.round((100 * (today - before)) / before) : null;
    headline = (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <Ring pct={latest?.pct ?? null} size={104} stroke={11} tint={color.sun} track="rgba(255,255,255,0.16)">
          <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "700" }}>{latest?.pct != null ? `${latest.pct.toFixed(0)}%` : "—"}</Text>
          <Text style={{ color: onBrand, fontSize: 11, fontWeight: "500" }}>{latest && latest.day !== S.today ? fmtD(latest.day) : "production"}</Text>
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: onBrand, fontSize: font.small, fontWeight: "500" }}>Eggs today</Text>
          <Text style={{ color: "#ffffff", fontSize: 28, fontWeight: "700", lineHeight: 34 }}>{today ? fmtEggs(today, S.eggsPerCrate) : "None yet"}</Text>
          {change !== null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name={change >= 0 ? "up" : "down"} size={15} color={color.sun} />
              <Text style={{ color: "#ffffff", fontSize: font.small, fontWeight: "600" }}>{`${Math.abs(change)}% ${change >= 0 ? "up" : "down"} on yesterday`}</Text>
            </View>
          ) : (
            <Text style={{ color: onBrand, fontSize: font.small }}>{before ? `Yesterday ${fmtEggs(before, S.eggsPerCrate)}` : "Nothing entered yesterday"}</Text>
          )}
        </View>
      </View>
    );
  } else {
    const unit = (["broilers", "brooding"] as const).find((u) => canSee(g, u));
    if (unit) {
      const stats = broilerStats(unitView(S, unit), S.today).filter((b) => b.status === "active");
      headline = (
        <View style={{ gap: 2 }}>
          <Text style={{ color: onBrand, fontSize: font.small, fontWeight: "500" }}>{`${UNIT[unit].label} on the farm`}</Text>
          <Text style={{ color: "#ffffff", fontSize: 28, fontWeight: "700" }}>{`${fmtK(stats.reduce((a, b) => a + b.alive, 0))} birds`}</Text>
          <Text style={{ color: onBrand, fontSize: font.small }}>{`in ${stats.length} ${stats.length === 1 ? "batch" : "batches"}`}</Text>
        </View>
      );
    }
  }

  return (
    <View style={{ backgroundColor: color.brand, paddingTop: insets.top + space.lg, paddingHorizontal: space.xl, paddingBottom: space.xl + 4, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderCurve: "continuous", gap: space.xl }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: onBrand, fontSize: font.label, fontWeight: "500" }}>{`${greeting()},`}</Text>
          <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "700" }} numberOfLines={1}>
            {S.viewer.name}
          </Text>
        </View>
        <Link href="/outbox" asChild>
          <Pressable accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingHorizontal: space.md, minHeight: 32 }}>
            <Icon name={sync.icon} size={15} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontSize: font.small, fontWeight: "600" }}>{sync.text}</Text>
          </Pressable>
        </Link>
      </View>
      {headline}
    </View>
  );
}

type Alert = { key: string; tone: "bad" | "warn"; text: string; href: Href };

/** What wants doing or watching today, most pressing first. */
function alertsFor(S: ErpData, stuck: number): Alert[] {
  const g = S.viewer.grants;
  const out: Alert[] = [];
  if (stuck) out.push({ key: "stuck", tone: "bad", text: `${stuck} ${stuck === 1 ? "entry needs" : "entries need"} a look`, href: "/outbox" });
  for (const t of tasksFor(S)) {
    if (t.doneToday === false) out.push({ key: t.key, tone: "warn", text: `Today's ${t.short} records aren't in yet`, href: t.href });
  }
  if (canSee(g, "layers")) {
    const week = layersSeries(S, lastDays(S.today, 8));
    const today = week[7].lost;
    const usual = week.slice(0, 7).reduce((a, d) => a + d.lost, 0) / 7;
    if (today >= 5 && today > 2 * usual) out.push({ key: "lost", tone: "bad", text: `Layers lost ${fmtK(today)} birds today — more than usual`, href: "/trends" });
    const feed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);
    if (feed.daysCover && feed.daysCover < 7) out.push({ key: "feed", tone: "warn", text: `Layers feed for about ${feed.daysCover} ${feed.daysCover === 1 ? "day" : "days"}`, href: "/trends" });
    const waiting = ungradedEggs(S.prodLog, S.eggMoves, S.eggsPerCrate);
    const perDay = week.slice(1).reduce((a, d) => a + d.eggs, 0) / 7;
    if (perDay > 0 && waiting > 2 * perDay) out.push({ key: "sort", tone: "warn", text: `${fmtEggs(waiting, S.eggsPerCrate)} waiting to be sorted`, href: "/sort-eggs" });
  }
  for (const unit of ["broilers", "brooding"] as const) {
    if (!canSee(g, unit)) continue;
    const feed = broilerFeedPosition(unitView(S, unit), S.today, unit);
    if (feed.daysCover && feed.daysCover < 7) out.push({ key: `${unit}-feed`, tone: "warn", text: `${UNIT[unit].label} feed for about ${feed.daysCover} ${feed.daysCover === 1 ? "day" : "days"}`, href: "/trends" });
  }
  return out;
}

function QuickAction({ href, icon, label, done }: { href: Href; icon: IconName; label: string; done?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label} style={{ alignItems: "center", gap: 6, width: 76 }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: color.card, alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(16, 39, 42, 0.08)" }}>
          <Icon name={icon} size={26} color={color.brand} />
          {done ? (
            <View style={{ position: "absolute", right: -2, top: -2, backgroundColor: color.card, borderRadius: 10 }}>
              <Icon name="check" size={18} color={color.good} />
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 12, fontWeight: "600", color: color.body }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function LayersCard({ S }: { S: ErpData }) {
  const week = layersSeries(S, lastDays(S.today, 7));
  const feed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);
  const birds = S.batches.filter((b) => b.st === "active").reduce((a, b) => a + b.birds - b.mortality, 0);
  const per = S.eggsPerCrate;
  return (
    <Card>
      <CardTitle sub="Eggs collected each day, in crates">Layers this week</CardTitle>
      <BarChart points={week.map((d) => ({ key: d.day, label: dayName(d.day, S.today), value: d.eggs ? d.eggs / per : null }))} format={(v) => fmtEggs(v * per, per)} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Tile icon="bird" label="Birds" value={fmtK(birds)} />
        <Tile icon="alert" label="Lost this week" value={fmtK(week.reduce((a, d) => a + d.lost, 0))}>
          <Spark values={week.map((d) => d.lost)} tint={color.chart2} />
        </Tile>
        <Tile icon="feed" label="Feed on hand" value={`${fmtBags(Math.max(0, feed.stockKg), S.feedBagKg)}${feed.daysCover ? ` · ${feed.daysCover}d` : ""}`} tone={feed.daysCover && feed.daysCover < 7 ? "warn" : undefined} />
        <Tile icon="store" label="In store" value={`${fmtK(eggStock(S.eggMoves, S.invoices))} crates`} />
        <Tile icon="sort" label="To sort" value={fmtEggs(Math.max(0, ungradedEggs(S.prodLog, S.eggMoves, per)), per)} />
      </View>
    </Card>
  );
}

function BirdsCard({ S, unit }: { S: ErpData; unit: BirdUnit }) {
  const view = unitView(S, unit);
  const stats = broilerStats(view, S.today).filter((b) => b.status === "active");
  const feed = broilerFeedPosition(view, S.today, unit);
  return (
    <Card>
      <CardTitle sub={`${fmtK(stats.reduce((a, b) => a + b.alive, 0))} birds · feed ${fmtBags(Math.max(0, feed.stockKg), S.feedBagKg)}${feed.daysCover ? `, about ${feed.daysCover} days` : ""}`}>{UNIT[unit].label}</CardTitle>
      {stats.length === 0 ? <Text style={{ color: color.body }}>No batches growing.</Text> : null}
      {stats.map((b) => (
        <View key={b.batch} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.md }}>
            <Text style={{ fontWeight: "700" }}>{b.batch}</Text>
            <Text style={{ fontSize: font.small, color: color.muted }}>{`Day ${b.ageDays ?? "—"} · ${fmtK(b.alive)} birds${b.weightKg ? ` · ${fmtKg(b.weightKg, 2)}` : ""}`}</Text>
          </View>
          {/* How many of the birds placed are still alive. */}
          <View style={{ height: 8, borderRadius: 4, backgroundColor: color.grid, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(0, Math.min(100, b.liveability))}%`, height: 8, borderRadius: 4, backgroundColor: b.liveability < 95 ? color.chart2 : color.chart }} />
          </View>
          <Text style={{ fontSize: 11, color: color.muted }}>{`${b.liveability.toFixed(1)}% alive of ${fmtK(b.placed)} placed`}</Text>
        </View>
      ))}
    </Card>
  );
}

/** The day at a glance: what needs doing, quick ways in, and each part of the farm this person sees. */
export function Home({ S }: { S: ErpData }) {
  const farm = useFarm();
  const g = S.viewer.grants;
  const tasks = tasksFor(S);
  const alerts = alertsFor(S, mine(farm).filter((e) => e.state !== "waiting").length);

  return (
    <>
      {tasks.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.xs, gap: space.sm }}>
          {tasks.map((t) => (
            <QuickAction key={t.key} href={t.href} icon={t.icon} label={t.short} done={t.doneToday} />
          ))}
        </ScrollView>
      ) : null}

      <SectionTitle>Today</SectionTitle>
      {alerts.length === 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.goodSoft, borderRadius: radius.sm, borderCurve: "continuous", padding: space.md }}>
          <Icon name="check" size={22} color={color.good} />
          <Text style={{ flex: 1, color: color.good, fontWeight: "600", fontSize: font.label }}>All caught up. Nothing needs attention.</Text>
        </View>
      ) : (
        alerts.map((a) => (
          <Link key={a.key} href={a.href} asChild>
            <Pressable
              accessibilityRole="link"
              style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: a.tone === "bad" ? color.badSoft : color.warnSoft, borderRadius: radius.sm, borderCurve: "continuous", padding: space.md }}>
              <Icon name={a.tone === "bad" ? "alert" : "clock"} size={20} color={a.tone === "bad" ? color.bad : color.warn} />
              <Text style={{ flex: 1, color: a.tone === "bad" ? color.bad : color.warn, fontWeight: "600", fontSize: font.label }}>{a.text}</Text>
              <Icon name="chevron" size={18} color={a.tone === "bad" ? color.bad : color.warn} />
            </Pressable>
          </Link>
        ))
      )}

      {canSee(g, "layers") ? <LayersCard S={S} /> : null}
      {canSee(g, "broilers") ? <BirdsCard S={S} unit="broilers" /> : null}
      {canSee(g, "brooding") ? <BirdsCard S={S} unit="brooding" /> : null}

      <Text style={{ fontSize: font.small, color: color.muted, textAlign: "center", marginTop: space.sm }}>{farm.loadedAt ? `Figures loaded ${ago(farm.loadedAt)}. Pull down to reload.` : ""}</Text>
    </>
  );
}

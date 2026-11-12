import { Text, View } from "react-native";

import { Button } from "@/components/button";
import { Card, CardTitle } from "@/components/card";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { confirm } from "@/farm/confirm";
import { ago } from "@/farm/day";
import { discard, mine, resend, sync, useFarm, type Entry } from "@/farm/store";
import { color, font, space } from "@/theme";

const STATE: Record<Entry["state"], string> = {
  waiting: "Waiting for signal",
  refused: "Not saved — the website refused it",
  unsure: "Not confirmed",
};

/** The entries made on this phone that haven't reached the website. */
export function Outbox() {
  const S = useFarm();
  const entries = mine(S);
  const waiting = entries.filter((e) => e.state === "waiting").length;

  if (entries.length === 0) {
    return (
      <Screen>
        <View style={{ paddingTop: 64, alignItems: "center", gap: space.sm }}>
          <Text style={{ fontSize: font.title, fontWeight: "700", color: color.ink }}>Nothing waiting</Text>
          <Text style={{ fontSize: font.body, color: color.body, textAlign: "center", lineHeight: 22 }}>Every entry made on this phone has reached the website.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {waiting ? (
        <>
          <Notice tone={S.online ? "plain" : "warn"}>
            {S.online ? "These are being sent, oldest first." : "No signal. These stay safe on this phone and are sent, oldest first, when there is signal."}
          </Notice>
          <Button label="Send now" onPress={() => void sync()} busy={S.syncing} />
        </>
      ) : null}
      {entries.map((e) => (
        <Card key={e.key}>
          <CardTitle sub={`${e.detail} · entered ${ago(e.at)}`}>{e.title}</CardTitle>
          <Text style={{ fontSize: font.label, fontWeight: "700", color: e.state === "waiting" ? color.warn : color.bad }}>{STATE[e.state]}</Text>
          {e.error ? (
            <Text selectable style={{ fontSize: font.label, color: color.body, lineHeight: 20 }}>
              {e.error}
            </Text>
          ) : null}
          {e.state === "refused" ? (
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Button kind="quiet" label="Try again" onPress={() => resend(e.key)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button kind="danger" label="Remove" onPress={() => discard(e.key)} />
              </View>
            </View>
          ) : e.state === "unsure" ? (
            <Button kind="danger" label="I've checked — remove" onPress={() => discard(e.key)} />
          ) : (
            <Button
              kind="danger"
              label="Remove without sending"
              onPress={() => confirm("Remove this entry?", "It hasn't been sent. Removing it means it is never saved.", "Remove", () => discard(e.key))}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}

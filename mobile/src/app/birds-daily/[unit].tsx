import { Stack, useLocalSearchParams } from "expo-router";

import { UNIT } from "@farm/erp/broilers";

import { Gate } from "@/components/gate";
import { BirdsDaily } from "@/screens/birds-daily";

export default function BirdsDailyRoute() {
  const unit = useLocalSearchParams<{ unit: string }>().unit === "brooding" ? "brooding" : "broilers";
  return (
    <>
      <Stack.Screen options={{ title: `${UNIT[unit].label} daily entry` }} />
      <Gate area={unit} wide>{(S) => <BirdsDaily S={S} unit={unit} />}</Gate>
    </>
  );
}

import { Gate } from "@/components/gate";
import { LayersDaily } from "@/screens/layers-daily";

export default function LayersDailyRoute() {
  return <Gate area="layers">{(S) => <LayersDaily S={S} />}</Gate>;
}

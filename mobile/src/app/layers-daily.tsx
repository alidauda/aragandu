import { Gate } from "@/components/gate";
import { LayersDaily } from "@/screens/layers-daily";

export default function LayersDailyRoute() {
  return <Gate area="layers" wide>{(S) => <LayersDaily S={S} />}</Gate>;
}

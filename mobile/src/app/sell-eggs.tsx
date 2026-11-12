import { Gate } from "@/components/gate";
import { SellEggs } from "@/screens/sell-eggs";

export default function SellEggsRoute() {
  return <Gate area="eggsales">{(S) => <SellEggs S={S} />}</Gate>;
}

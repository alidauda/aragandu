import { Gate } from "@/components/gate";
import { SortEggs } from "@/screens/sort-eggs";

export default function SortEggsRoute() {
  return <Gate area="layers">{(S) => <SortEggs S={S} />}</Gate>;
}

import { WithData } from "@/components/with-data";
import { Record } from "@/screens/record";

export default function RecordRoute() {
  return <WithData>{(S) => <Record S={S} />}</WithData>;
}

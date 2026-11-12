import { WithData } from "@/components/with-data";
import { Trends } from "@/screens/trends";

export default function TrendsRoute() {
  return <WithData>{(S) => <Trends S={S} />}</WithData>;
}

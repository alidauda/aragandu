import { WithData } from "@/components/with-data";
import { Me } from "@/screens/me";

export default function MeRoute() {
  return <WithData narrow>{(S) => <Me S={S} />}</WithData>;
}

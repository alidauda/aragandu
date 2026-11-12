import { WithData } from "@/components/with-data";
import { Home } from "@/screens/home";

export default function HomeRoute() {
  return <WithData>{(S) => <Home S={S} />}</WithData>;
}

import { WithData } from "@/components/with-data";
import { Home, HomeHero } from "@/screens/home";

export default function HomeRoute() {
  return <WithData hero={(S) => <HomeHero S={S} />}>{(S) => <Home S={S} />}</WithData>;
}

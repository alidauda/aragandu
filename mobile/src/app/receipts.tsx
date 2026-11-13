import { WithData } from "@/components/with-data";
import { Receipts } from "@/screens/receipts";

export default function ReceiptsRoute() {
  return <WithData narrow>{(S) => <Receipts S={S} />}</WithData>;
}

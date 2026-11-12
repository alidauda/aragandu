import { Chips } from "@/components/chips";
import { dayName, recordDays } from "@/farm/day";

/** The day an entry is for: today, or up to a week back. */
export function DayChips({ today, value, onChange }: { today: string; value: string; onChange: (day: string) => void }) {
  return <Chips scroll label="Day" value={value} onChange={onChange} options={recordDays(today).map((d) => ({ value: d, label: dayName(d, today) }))} />;
}

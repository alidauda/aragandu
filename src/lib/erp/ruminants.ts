/** Ruminants: goats, sheep and cattle, each by its tag. */
import type { Animal, AnimalWeight } from "./types";

/** An animal's age: "2 yrs 3 mths", "5 mths", "3 wks". */
export function animalAge(born: string | undefined, today: string) {
  if (!born) return "—";
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(born)) / 86_400_000));
  if (days < 60) return `${Math.floor(days / 7)} wks`;
  const months = Math.floor(days / 30.44);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${months} mths`;
  return `${years} ${years === 1 ? "yr" : "yrs"}${rest ? ` ${rest} mths` : ""}`;
}

/** The animal's last weight and the one before it, newest first. */
export function weightsOf(a: Pick<Animal, "id">, weights: AnimalWeight[]) {
  return weights.filter((w) => w.animal === a.id).sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id);
}

/** Grams a day between its last two weighings. */
export function gainPerDay(a: Pick<Animal, "id">, weights: AnimalWeight[]) {
  const [last, prev] = weightsOf(a, weights);
  if (!last || !prev) return null;
  const days = Math.round((Date.parse(last.date) - Date.parse(prev.date)) / 86_400_000);
  return days > 0 ? ((last.kg - prev.kg) * 1000) / days : null;
}

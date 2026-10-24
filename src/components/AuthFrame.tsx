import { BrandBadge } from "@/components/Logo";

/**
 * Sign-in, invite and reset pages: a brand panel beside the form, in the
 * guidelines' style — a text box on the division pattern. The farm (staff)
 * side is teal; the buyer portal is Argandu Poultry's red.
 */
export function AuthFrame({
  variant = "farm",
  children,
}: {
  variant?: "farm" | "poultry";
  children: React.ReactNode;
}) {
  const poultry = variant === "poultry";
  return (
    <main className="grid min-h-screen bg-[#f4f6f5] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className={`${poultry ? "pattern-poultry" : "pattern-teal"} hidden flex-col justify-between p-10 lg:flex`}>
        <BrandBadge tone={poultry ? "sun" : "sun"} division={poultry ? "POULTRY" : undefined} height={64} />
        <div className={`max-w-[440px] rounded-sm p-7 ${poultry ? "bg-[#fffbea]" : "bg-[#feea0d]"}`}>
          <span
            className={`font-sub inline-block px-2.5 py-1 text-[13px] text-white ${poultry ? "bg-[#d62f2f]" : "bg-[#055a5b]"}`}
          >
            {poultry ? "ARGANDU POULTRY" : "ARGANDU FARMS"}
          </span>
          <h2 className="font-display mt-4 text-[38px] uppercase leading-[0.98] text-[#055a5b]">
            {poultry ? "Fresh eggs, ordered your way" : "Honoring a royal agricultural legacy"}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#0d1d1d]/80">
            {poultry
              ? "Order within your weekly allocation, pay online, and follow every order to your door."
              : "Inspiring a new kind of agriculture — one that honors the intelligence of old ways while quietly shaping a future where tradition and innovation grow side by side."}
          </p>
        </div>
      </aside>
      <section className="flex items-center justify-center p-6">{children}</section>
    </main>
  );
}

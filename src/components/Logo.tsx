import { Sprout } from "lucide-react";

/** The Argandu mark: a sprout in a field-green tile, with the name. */
export function Logo({ caption }: { caption?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2f8f46] text-white">
        <Sprout size={22} strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span className="font-display block text-[19px] font-extrabold text-[#14231a]">
          Argandu
        </span>
        {caption ? (
          <span className="block text-[12.5px] font-medium text-[#8b958d]">{caption}</span>
        ) : null}
      </span>
    </span>
  );
}

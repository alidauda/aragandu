/**
 * The Argandu logomark (brand guidelines): the ARGANDU logotype in Ojuju
 * Bold inside the notched badge. Yellow on teal is the primary mark; each
 * division has its own colour and name under the logotype.
 */

export type BadgeTone = "teal" | "sun" | "poultry" | "feedmill";

const TONES: Record<BadgeTone, { fill: string; ink: string }> = {
  teal: { fill: "#055a5b", ink: "#feea0d" },
  sun: { fill: "#feea0d", ink: "#055a5b" },
  poultry: { fill: "#d62f2f", ink: "#fffbea" },
  feedmill: { fill: "#3b465c", ink: "#fee4b3" },
};

/** The badge on its own. `height` sets the size; it's twice as wide as tall. */
export function BrandBadge({
  tone = "teal",
  division,
  height = 40,
  className = "",
}: {
  tone?: BadgeTone;
  /** A division name set under the logotype: "POULTRY", "FEEDMILL". */
  division?: string;
  height?: number;
  className?: string;
}) {
  const { fill, ink } = TONES[tone];
  return (
    <svg
      viewBox="0 0 240 120"
      height={height}
      width={height * 2}
      role="img"
      aria-label={division ? `Argandu ${division.toLowerCase()}` : "Argandu"}
      className={`shrink-0 ${className}`}
    >
      {/* The badge: a body with a tab above and a curved base below. */}
      <rect x="62" y="4" width="116" height="34" rx="11" fill={fill} />
      <rect x="4" y="24" width="232" height="70" rx="15" fill={fill} />
      <path d="M62 84 H178 V98 Q178 115 120 116 Q62 115 62 98 Z" fill={fill} />
      <text
        x="120"
        y={division ? 66 : 74}
        textAnchor="middle"
        fill={ink}
        fontFamily="var(--font-ojuju), sans-serif"
        fontWeight="800"
        fontSize={division ? 40 : 46}
        textLength={division ? 176 : 196}
        lengthAdjust="spacingAndGlyphs"
      >
        ARGANDU
      </text>
      {division ? (
        <text
          x="120"
          y="90"
          textAnchor="middle"
          fill={ink}
          fontFamily="var(--font-acme), sans-serif"
          fontSize="17"
          letterSpacing="3"
        >
          {division}
        </text>
      ) : null}
    </svg>
  );
}

/** The badge with an optional caption beside it (sign-in pages, documents). */
export function Logo({
  caption,
  tone = "teal",
  division,
  height = 40,
}: {
  caption?: string;
  tone?: BadgeTone;
  division?: string;
  height?: number;
}) {
  return (
    <span className="flex items-center gap-3">
      <BrandBadge tone={tone} division={division} height={height} />
      {caption ? (
        <span className="font-sub text-[14px] leading-tight text-[#5d6b6b]">{caption}</span>
      ) : null}
    </span>
  );
}

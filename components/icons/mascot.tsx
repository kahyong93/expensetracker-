/**
 * Mascot (DESIGN_SYSTEM §6): white face, two eyes, a smile and two cheek dots.
 * Decorative, always aria-hidden. `cheek` picks the role cheek colour.
 */
const CHEEK = {
  logo: "var(--cf-logo-cheek)",
  in: "var(--cf-in-cheek)",
  out: "var(--cf-out-cheek)",
} as const;

export function Mascot({ cheek, size = 38 }: { cheek: keyof typeof CHEEK; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="18" style={{ fill: "var(--cf-surface)" }} />
      <circle cx="14" cy="18" r="2.2" style={{ fill: "var(--cf-ink)" }} />
      <circle cx="26" cy="18" r="2.2" style={{ fill: "var(--cf-ink)" }} />
      <path
        d="M15 24c1.5 2 3 3 5 3s3.5-1 5-3"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        style={{ stroke: "var(--cf-ink)" }}
      />
      <circle cx="10.5" cy="23.5" r="2.6" style={{ fill: CHEEK[cheek] }} />
      <circle cx="29.5" cy="23.5" r="2.6" style={{ fill: CHEEK[cheek] }} />
    </svg>
  );
}

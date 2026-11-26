/**
 * Category palette (DESIGN_SYSTEM §2.3). Categories get colours by index in their
 * order list, cycling every 6. JS needs the raw values for the donut conic-gradient
 * and the stacked share bar, so this is the one place hex lives outside globals.css.
 */
export type CategoryColor = { solid: string; tint: string };

export const CATEGORY_PALETTE: readonly CategoryColor[] = [
  { solid: "#FFB86B", tint: "#FFF1E0" },
  { solid: "#7CC6F2", tint: "#E6F4FC" },
  { solid: "#B49CF0", tint: "#F1ECFD" },
  { solid: "#F59AB5", tint: "#FDE9EF" },
  { solid: "#7DD3B0", tint: "#E5F7EF" },
  { solid: "#F2CC4E", tint: "#FDF5D6" },
];

export function categoryColor(index: number): CategoryColor {
  const i = ((index % CATEGORY_PALETTE.length) + CATEGORY_PALETTE.length) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[i];
}

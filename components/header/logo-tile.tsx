import { Mascot } from "@/components/icons/mascot";

/** Tilted pink logo tile with the mascot (DESIGN_SYSTEM §6, §7.11). Decorative. */
export function LogoTile() {
  return (
    <div
      aria-hidden="true"
      className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-cf-tile bg-cf-logo-tile shadow-cf-logo"
    >
      <Mascot cheek="logo" />
    </div>
  );
}

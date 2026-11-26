"use client";

import { LaptopIcon, PhoneIcon } from "@/components/icons/line-icons";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";

/** Phone / Laptop toggle (PRD G6, DESIGN_SYSTEM §8.3). Clicking the active one returns to Auto. */
export function LayoutToggle() {
  const { mode, isPhone, setMode } = useLayoutMode();
  const toast = useToast();

  const choose = (picked: "phone" | "laptop") => {
    const next = mode === picked ? "auto" : picked;
    setMode(next);
    toast(next === "auto" ? "Layout follows your screen size" : next === "phone" ? "Phone layout on" : "Laptop layout on");
  };

  return (
    <SegmentedControl
      aria-label="Layout"
      value={isPhone ? "phone" : "laptop"}
      onChange={choose}
      options={[
        {
          value: "phone",
          title: "Phone layout",
          ariaLabel: isPhone ? "Phone layout" : undefined,
          label: (
            <>
              <PhoneIcon />
              {isPhone ? null : "Phone"}
            </>
          ),
        },
        {
          value: "laptop",
          title: "Laptop layout",
          ariaLabel: isPhone ? "Laptop layout" : undefined,
          label: (
            <>
              <LaptopIcon />
              {isPhone ? null : "Laptop"}
            </>
          ),
        },
      ]}
    />
  );
}

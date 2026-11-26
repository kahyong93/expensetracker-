import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type ClerkAppearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

/**
 * Clerk's sign-in / sign-up modal, full pages and user menu, themed with the --cf-* tokens
 * (DESIGN_SYSTEM §12). Clerk's styles go in the "clerk" CSS layer, declared in
 * app/globals.css before Tailwind's utilities, so the classes below win.
 */
export const CLERK_APPEARANCE = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "var(--cf-primary)",
    colorPrimaryForeground: "var(--cf-surface)",
    colorForeground: "var(--cf-ink)",
    colorMutedForeground: "var(--cf-ink-muted)",
    colorMuted: "var(--cf-track)",
    colorBackground: "var(--cf-surface)",
    colorInput: "var(--cf-surface)",
    colorInputForeground: "var(--cf-ink)",
    colorBorder: "var(--cf-line-strong)",
    colorNeutral: "var(--cf-ink)",
    colorDanger: "var(--cf-invalid-text)",
    colorRing: "var(--cf-primary)",
    colorModalBackdrop: "var(--cf-overlay)",
    fontFamily: "var(--font-nunito), ui-sans-serif, sans-serif",
    borderRadius: "var(--cf-r-input)",
  },
  elements: {
    cardBox: "rounded-cf-modal border-2 border-cf-line shadow-cf-modal",
    headerTitle: "font-heading text-[21px] font-semibold",
    formButtonPrimary: "rounded-cf-pill font-extrabold shadow-cf-btn hover:bg-cf-primary-hover",
    socialButtonsBlockButton: "rounded-cf-pill",
    footerActionLink: "font-extrabold text-cf-primary hover:text-cf-primary-deep",
  },
} satisfies ClerkAppearance;

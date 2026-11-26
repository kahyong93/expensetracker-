"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { FormEvent, ReactNode } from "react";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Modal (DESIGN_SYSTEM §7.9). Centred on laptop, bottom sheet on phone. Built on the
 * Base UI dialog: role="dialog", aria-modal, focus trap, Esc and backdrop click close,
 * focus returns to the trigger.
 *
 * Pass `onSubmit` to wrap the body in a <form>; the submit button is then type="submit"
 * so Enter submits.
 */
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  /** Primary action label, e.g. "Save", "Create", "Delete". Omit for no actions row. */
  submitLabel?: string;
  onSubmit?: () => void;
  /** Disable the primary action (e.g. while an AI request runs). */
  submitDisabled?: boolean;
  cancelLabel?: string;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  submitLabel,
  onSubmit,
  submitDisabled,
  cancelLabel = "Cancel",
}: ModalProps) {
  const { isPhone } = useLayoutMode();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.();
  };

  const actions = submitLabel ? (
    <div className="mt-1 flex justify-end gap-2">
      <Button variant="neutral" size="lg" onClick={onClose}>
        {cancelLabel}
      </Button>
      <Button variant="primary" size="lg" type="submit" disabled={submitDisabled} className="px-[18px]">
        {submitLabel}
      </Button>
    </div>
  ) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-cf-overlay" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 box-border flex max-h-[88vh] w-[min(420px,100%)] flex-col gap-3.5 overflow-y-auto",
            "rounded-cf-modal bg-cf-surface p-[26px] text-cf-ink shadow-cf-modal",
            isPhone
              ? "bottom-0 left-1/2 -translate-x-1/2"
              : "top-1/2 left-1/2 max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2",
          )}
        >
          <Dialog.Title className="m-0 font-heading text-[22px] font-semibold">{title}</Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            {children}
            {actions}
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

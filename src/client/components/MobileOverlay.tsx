import React, { type ReactNode } from "react";
import Icon from "@mdi/react";
import { mdiMenu, mdiClose } from "@mdi/js";

interface HamburgerProps {
  onClick: () => void;
}

/** Hamburger button — visible only below md (768px) */
export function HamburgerButton({ onClick }: HamburgerProps) {
  return (
    <button
      onClick={onClick}
      className="md:hidden fixed top-2 left-2 z-50 p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white"
      data-testid="hamburger-button"
      aria-label="Open menu"
    >
      <Icon path={mdiMenu} size={0.8} />
    </button>
  );
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Mobile sidebar overlay — fixed position with backdrop */
export function MobileOverlay({ open, onClose, children }: OverlayProps) {
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40" data-testid="mobile-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        data-testid="mobile-backdrop"
      />
      {/* Sidebar panel */}
      <div className="absolute inset-y-0 left-0 w-72 bg-[#0a0a0a] border-r border-gray-800 overflow-y-auto z-50">
        <div className="flex justify-end p-2">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            data-testid="mobile-close"
            aria-label="Close menu"
          >
            <Icon path={mdiClose} size={0.7} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MoreVertical, Pencil, Link2, KeyRound, Download, Users, Trash2, Eye } from 'lucide-react';

const MENU_ITEMS = [
  { key: 'edit', label: 'Edit event details', icon: Pencil },
  { key: 'copy-link', label: 'Copy share link', icon: Link2 },
  { key: 'toggle-pin', label: 'PIN settings', icon: KeyRound },
  { key: 'toggle-publish', label: 'Toggle auto-publish', icon: Eye },
  { key: 'download-zip', label: 'Download all photos (zip)', icon: Download },
  { key: 'guest-tracker', label: 'View guest tracker', icon: Users },
  { key: 'delete', label: 'Delete event', icon: Trash2, destructive: true },
];

// Estimated menu height used only for upward-flip pre-check.
// The actual rendered height may differ; this gives a safe upper bound.
const MENU_ESTIMATED_HEIGHT = 7 * 44; // 7 items × 44px each

export default function EventCardMenu({ onAction, workingAction }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUpward: false });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Ensure we only use createPortal after mount (SSR safety)
  useEffect(() => { setMounted(true); }, []);

  // Compute position from trigger's bounding rect whenever the menu opens
  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const MENU_WIDTH = 234; // matches min-width in CSS
    const OFFSET = 6; // gap between trigger bottom and menu top

    const spaceBelow = viewportH - rect.bottom;
    const openUpward = spaceBelow < MENU_ESTIMATED_HEIGHT + OFFSET;

    // Align right edge of menu to right edge of trigger
    const left = rect.right - MENU_WIDTH;

    setMenuPos({
      top: openUpward ? rect.top - OFFSET : rect.bottom + OFFSET,
      bottom: openUpward ? window.innerHeight - rect.top + OFFSET : 'auto',
      left: Math.max(8, left), // clamp to 8px from left edge
      openUpward,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePos();

    function handleClickOutside(e) {
      // Close if click is outside both the trigger and the portaled menu
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function handleScroll() {
      // Recompute on scroll so menu tracks its trigger
      computePos();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', computePos, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', computePos);
    };
  }, [open, computePos]);

  function handleSelect(key) {
    setOpen(false);
    onAction?.(key);
  }

  const menuStyle = {
    position: 'absolute',
    top: menuPos.openUpward ? 'auto' : 'calc(100% + 6px)',
    bottom: menuPos.openUpward ? 'calc(100% + 6px)' : 'auto',
    right: 0,
    zIndex: 100,
    transformOrigin: menuPos.openUpward ? 'bottom right' : 'top right',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={triggerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Event options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="ecm-trigger"
      >
        <MoreVertical style={{ width: '16px', height: '16px' }} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="dropdown-menu ecm-dropdown"
        >
          {MENU_ITEMS.map(({ key, label, icon: Icon, destructive }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (workingAction) return;
                handleSelect(key);
              }}
              disabled={workingAction === key}
              className={`ecm-item ${destructive ? 'ecm-item-danger' : ''}`}
              style={workingAction === key ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {workingAction === key ? (
                <svg style={{ width: '16px', height: '16px', flexShrink: 0, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Icon style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              )}
              {workingAction === key ? 'Working...' : label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function EventCardMenu({ onAction, workingAction }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function handleSelect(key) {
    setOpen(false);
    onAction?.(key);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Event options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-black/30 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-white/10 bg-neutral-950/95 shadow-xl shadow-black/40 backdrop-blur-sm"
        >
          {MENU_ITEMS.map(({ key, label, icon: Icon, destructive }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (workingAction) return; // Prevent clicks while working
                handleSelect(key);
              }}
              disabled={workingAction === key}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                destructive
                  ? 'text-red-400/90 hover:bg-red-500/10 hover:text-red-400'
                  : 'text-white/80 hover:bg-amber-500/10 hover:text-amber-300'
              } ${workingAction === key ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {workingAction === key ? (
                <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              {workingAction === key ? 'Working...' : label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

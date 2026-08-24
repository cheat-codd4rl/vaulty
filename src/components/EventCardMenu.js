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
    <div style={{ position: 'relative' }} ref={menuRef}>
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
        className="ecm-trigger"
      >
        <MoreVertical style={{ width: '16px', height: '16px' }} />
      </button>

      {open && (
        <div
          role="menu"
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

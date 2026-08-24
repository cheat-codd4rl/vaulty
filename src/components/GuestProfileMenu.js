'use client';

import { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import { useRouter } from 'next/navigation';

export default function GuestProfileMenu({ eventId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`/api/events/${eventId}/session`);
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            // Priority: API > localStorage
            const guestName = data.name || localStorage.getItem(`vaulty_guest_name_${eventId}`) || 'Guest';
            setName(guestName);
          }
        }
      } catch (err) {
        // ignore
      }
      setLoading(false);
    }
    checkAuth();
  }, [eventId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setIsEditing(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });
      if (res.ok) {
        setName(editName.trim());
        localStorage.setItem(`vaulty_guest_name_${eventId}`, editName.trim());
        setIsEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          alert('Your session has expired. The page will reload so you can rejoin.');
          window.location.reload();
        } else {
          alert(data.error || 'Failed to update name');
        }
      }
    } catch (err) {
      alert('Failed to update name');
    }
    setSaving(false);
  };

  const handleLeave = async () => {
    await fetch(`/api/v1/events/${eventId}/leave`, { method: 'POST' });
    // Clear localStorage for good measure
    localStorage.removeItem(`vaulty_guest_name_${eventId}`);
    router.push('/');
  };

  if (loading) {
    return <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }}></div>;
  }

  // If no name found (meaning guest is fully unauthenticated/anonymous), don't show the profile button yet
  if (!name) return <ThemeToggle />;

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button 
        onClick={() => {
          setOpen(!open);
          setIsEditing(false);
        }}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--brass-soft)',
          color: 'var(--ink)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: '18px',
          cursor: 'pointer',
          padding: 0
        }}
        aria-label="Guest profile menu"
      >
        {name.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className="dropdown-menu">
          <div style={{ padding: '8px 12px 12px 12px', borderBottom: '1px solid var(--line-strong)', marginBottom: '4px' }}>
            {isEditing ? (
              <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your Name"
                  style={{ width: '100%', height: '32px', fontSize: '14px', padding: '0 8px', background: 'var(--ink-3)', border: '1px solid var(--line-strong)', borderRadius: '4px', color: 'var(--text)', outline: 'none' }}
                  autoFocus
                />
                <button type="submit" disabled={saving || !editName.trim()} className="btn btn-sm btn-brass" style={{ height: '32px', padding: '0 12px', flexShrink: 0 }}>
                  Save
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{name}</p>
                <button 
                  onClick={() => {
                    setEditName(name);
                    setIsEditing(true);
                  }} 
                  style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  Edit
                </button>
              </div>
            )}
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>Guest</p>
          </div>
          
          <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px' }}>Theme</span>
            <ThemeToggle />
          </div>
          
        </div>
      )}
    </div>
  );
}

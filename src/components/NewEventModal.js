'use client';

import { useState, useRef, useEffect } from 'react';
import { processImageFile } from '@/lib/fileProcessing';
import { createEvent } from '@/lib/store';
import { useToast } from './Toast';

export default function NewEventModal({ onClose, onCreated }) {
  const showToast = useToast();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [accessMode, setAccessMode] = useState('open');
  const [moderationMode, setModerationMode] = useState('auto');
  const [photographerName, setPhotographerName] = useState('');
  const [coverData, setCoverData] = useState(null);
  const [coverSet, setCoverSet] = useState(false);
  
  // Host Profile Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Registration fields
  const [hostName, setHostName] = useState('');
  const [hostEmail, setHostEmail] = useState('');
  const [hostPassword, setHostPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const coverInput = useRef(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/host/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsLoggedIn(true);
          }
        }
      } catch (err) {
        // ignore
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  const handleGeneratePassword = () => {
    const ADJECTIVES = ['brass', 'gold', 'swift', 'dark', 'wild', 'blue', 'neon', 'cool', 'fast', 'brave', 'silver', 'silent'];
    const NOUNS = ['otter', 'tiger', 'vault', 'fox', 'bear', 'hawk', 'wolf', 'lion', 'moon', 'star', 'river', 'forest'];
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    setHostPassword(`${adj}-${noun}-${num}`);
    setShowPassword(true);
  };

  const handleCover = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const res = await processImageFile(f);
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = Math.round(res.height * (640 / (res.width || 1)));
      const img = new window.Image();
      img.onload = () => {
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        setCoverData(c.toDataURL('image/jpeg', 0.7));
        setCoverSet(true);
      };
      img.src = URL.createObjectURL(res.blob);
    } catch {
      showToast("Couldn't read that image");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Give the event a name');
      return;
    }
    if (!isLoggedIn && (!hostName.trim() || !hostEmail.trim() || hostPassword.length < 6)) {
      showToast('Please fill out all Host details securely');
      return;
    }

    setCreating(true);
    try {
      const event = await createEvent({
        name: name.trim(),
        date,
        cover: coverData,
        accessMode,
        moderationMode,
        photographerName: photographerName.trim(),
        hostEmail: !isLoggedIn ? hostEmail.trim() : null,
        hostName: !isLoggedIn ? hostName.trim() : null,
        hostPassword: !isLoggedIn ? hostPassword : null,
      });
      showToast('Event created');
      if (onCreated) onCreated(event);
    } catch (err) {
      showToast(err.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-head">
          <h2>New event</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="evName">Event name</label>
            <input
              type="text"
              id="evName"
              placeholder="Priya &amp; Sam's Wedding"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="evDate">Date (optional)</label>
            <input type="date" id="evDate" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Cover photo (optional)</label>
            <div className="file-drop-mini" onClick={() => coverInput.current?.click()}>
              {coverSet ? 'Cover photo set ✓' : 'Tap to choose an image'}
            </div>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCover}
            />
          </div>
          <div className="field">
            <label>Access</label>
            <div className="radio-pills">
              <label
                className={`radio-pill ${accessMode === 'open' ? 'active' : ''}`}
                onClick={() => setAccessMode('open')}
              >
                <input type="radio" name="access" value="open" readOnly checked={accessMode === 'open'} />
                Open link
              </label>
              <label
                className={`radio-pill ${accessMode === 'pin' ? 'active' : ''}`}
                onClick={() => setAccessMode('pin')}
              >
                <input type="radio" name="access" value="pin" readOnly checked={accessMode === 'pin'} />
                Require a PIN
              </label>
            </div>
          </div>
          <div className="field">
            <label>Moderation</label>
            <div className="radio-pills">
              <label
                className={`radio-pill ${moderationMode === 'auto' ? 'active' : ''}`}
                onClick={() => setModerationMode('auto')}
              >
                <input
                  type="radio"
                  name="mod"
                  value="auto"
                  readOnly
                  checked={moderationMode === 'auto'}
                />
                Auto-publish
              </label>
              <label
                className={`radio-pill ${moderationMode === 'approval' ? 'active' : ''}`}
                onClick={() => setModerationMode('approval')}
              >
                <input
                  type="radio"
                  name="mod"
                  value="approval"
                  readOnly
                  checked={moderationMode === 'approval'}
                />
                I&apos;ll approve each photo
              </label>
            </div>
            <div className="hint">
              Approval mode holds new guest uploads in a review queue until you publish them.
            </div>
          </div>
          <div className="field">
            <label htmlFor="evPhotographer">Photographer name (optional)</label>
            <input
              type="text"
              id="evPhotographer"
              placeholder="For crediting the Pro Shots tab"
              value={photographerName}
              onChange={(e) => setPhotographerName(e.target.value)}
            />
          </div>

          {!authLoading && !isLoggedIn && (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Host Profile Setup</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
                You are creating your first event. Please create a host profile to manage your events later.
              </p>
              
              <div className="field">
                <label htmlFor="hostName">Your Name</label>
                <input
                  type="text"
                  id="hostName"
                  placeholder="e.g. Sam"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="hostEmail">Email Address</label>
                <input
                  type="email"
                  id="hostEmail"
                  placeholder="name@example.com"
                  value={hostEmail}
                  onChange={(e) => setHostEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="evHostPassword" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Host Password</span>
                  <button 
                    type="button" 
                    onClick={handleGeneratePassword} 
                    style={{ background: 'none', border: 'none', color: 'var(--brass-soft)', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                  >
                    Generate one for me
                  </button>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="evHostPassword"
                    placeholder="Set a password to recover access"
                    value={hostPassword}
                    onChange={(e) => setHostPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-ghost"
                    style={{ padding: '0 12px', minWidth: 'auto' }}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={creating} className="btn btn-brass btn-block" style={{ marginTop: '24px' }}>
            {creating ? 'Creating...' : 'Create event'}
          </button>
        </form>
      </div>
    </div>
  );
}

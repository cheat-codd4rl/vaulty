'use client';

import { useState, useRef } from 'react';
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
  const [hostPassword, setHostPassword] = useState('');
  const coverInput = useRef(null);

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
    const event = await createEvent({
      name: name.trim(),
      date,
      cover: coverData,
      accessMode,
      moderationMode,
      photographerName: photographerName.trim(),
      hostPassword: hostPassword || null,
    });
    showToast('Event created');
    if (onCreated) onCreated(event);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
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
            <label htmlFor="evDate">Date</label>
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
          <div className="field">
            <label htmlFor="evHostPassword">Host Password (Optional)</label>
            <input
              type="password"
              id="evHostPassword"
              placeholder="Set a password to recover access"
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
            />
            <div className="hint">
              If left blank, you won&apos;t be able to recover host access on another device.
            </div>
          </div>
          <button type="submit" className="btn btn-brass btn-block">
            Create event
          </button>
        </form>
      </div>
    </div>
  );
}

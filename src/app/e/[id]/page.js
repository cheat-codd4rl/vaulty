'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import UploadDropzone from '@/components/UploadDropzone';
import Gallery from '@/components/Gallery';
import AbsoluteThemeToggle from '@/components/AbsoluteThemeToggle';
import { useToast } from '@/components/Toast';
import {
  getEvent,
  listUploads,
  getMyUploadIds,
  deleteUploadRecord,
  deleteSessionFile,
  getSessionFile,
} from '@/lib/store';
import { fmtDate } from '@/lib/helpers';

export default function GuestPage({ params }) {
  const { id } = use(params);
  const showToast = useToast();
  const [event, setEvent] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [myIds, setMyIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionClaimCode, setSessionClaimCode] = useState('');
  const [whoAreYouData, setWhoAreYouData] = useState(null); // { guests: [] }
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [submittingName, setSubmittingName] = useState(false);

  const loadData = useCallback(async () => {
    try {
      let currentName = '';
      let isAuth = false;

      // 1. Check Session
      const sessRes = await fetch(`/api/events/${id}/session`);
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setIsAuthenticated(true);
        isAuth = true;
        setPinUnlocked(true); // If they have a JWT, they bypass PIN
        if (sessData.claimCode) setSessionClaimCode(sessData.claimCode);
        currentName = sessData.name || '';
      }

      const ev = await getEvent(id);
      setEvent(ev);
      
      let needsName = false;

      if (ev) {
        let unlocked = isAuth;
        if (!ev.hasPin && ev.accessMode !== 'pin') {
          setPinUnlocked(true);
          unlocked = true;
        }
        
        // If they are allowed to see the gallery but have no name, prompt for one
        if (unlocked && !currentName) {
          needsName = true;
        }

        const ups = await listUploads(id);
        setUploads(ups);
        const ids = await getMyUploadIds(id);
        setMyIds(ids);
      }
      
      setShowNameModal(needsName);

    } catch (err) {
      console.error('Failed to load event data:', err);
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('claimCode');
    if (code) {
      showToast(`Welcome! Your recovery claim code is ${code}. Save it if you switch devices!`);
      // Clean up URL so they don't accidentally share it
      window.history.replaceState({}, '', `/e/${id}`);
    }
  }, [id, showToast]);

  const handlePinSubmit = async () => {
    if (!pinValue.trim()) return;
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: id, pin: pinValue })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setPinError(data.error || 'Incorrect PIN');
      } else if (data.requireClaim) {
        setPinError('');
        setWhoAreYouData(data); // Move to "Who are you?" step
      }
    } catch (err) {
      setPinError('Failed to verify PIN');
    }
  };

  const handleNameSubmit = async () => {
    if (!guestNameInput.trim()) return;
    setSubmittingName(true);
    try {
      const res = await fetch(isAuthenticated ? `/api/events/${id}/guests/name` : '/api/auth/guest', {
        method: isAuthenticated ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAuthenticated ? { name: guestNameInput.trim() } : { eventId: id, name: guestNameInput.trim() })
      });
      if (res.ok) {
        localStorage.setItem(`vaulty_guest_name_${id}`, guestNameInput.trim());
        setShowNameModal(false);
        // Fully load the session/gallery as we are now in an authenticated state
        loadData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save name');
      }
    } catch (err) {
      showToast('Failed to save name');
    }
    setSubmittingName(false);
  };

  const handleClaimSubmit = async () => {
    if (!selectedGuestId || !claimCode.trim()) {
      setPinError('Select your name and enter the claim code');
      return;
    }
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          eventId: id, 
          pin: pinValue, 
          targetGuestId: selectedGuestId, 
          claimCode: claimCode.trim() 
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setPinError(data.error || 'Incorrect claim code');
      } else {
        setIsAuthenticated(true);
        setPinUnlocked(true);
        setPinError('');
        loadData(); // reload session and uploads
      }
    } catch (err) {
      setPinError('Failed to verify claim code');
    }
  };

  // ... (keep the delete/download functions the same)
  // Re-declare them here for completeness
  const handleDelete = async (uid) => {
    if (!confirm('Delete this upload?')) return;
    await deleteUploadRecord(id, uid);
    deleteSessionFile(uid);
    showToast('Deleted');
    loadData();
  };

  const handleDownload = async (uploadsToDownload) => {
    const JSZip = (await import('jszip')).default;
    if (!uploadsToDownload || !uploadsToDownload.length) {
      showToast('Nothing to download yet');
      return;
    }
    showToast('Building zip…');
    const zip = new JSZip();
    let count = 0;

    for (const u of uploadsToDownload) {
      try {
        const url = u.downloadUrl || u.viewUrl || u.fileUrl;
        if (url) {
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            zip.file(u.filename, blob);
            count++;
            continue;
          }
        }
        const sess = getSessionFile(u.id);
        if (sess && (sess.blob || sess.file)) {
          zip.file(u.filename, sess.blob || sess.file);
          count++;
        }
      } catch {
        /* skip failed files */
      }
    }

    if (!count) {
      showToast('No files available for download');
      return;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vaulty-photos.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Zip downloaded (' + count + ' file' + (count === 1 ? '' : 's') + ')');
  };

  if (!loaded)
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="event-header">
            <div className="skeleton" style={{ width: '120px', height: '16px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ width: '240px', height: '40px', marginBottom: '16px' }}></div>
          </div>
          <div style={{ marginTop: '32px' }}>
             <div className="skeleton" style={{ width: '100%', height: '120px', borderRadius: '16px', marginBottom: '24px' }}></div>
             <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '16px' }}></div>
          </div>
        </div>
      </>
    );

  if (!event || event.status === 'deleting')
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="empty">
            <h3>{event ? 'Event is being deleted' : 'This link doesn\'t lead anywhere'}</h3>
            <p>{event ? 'This event and its photos are currently being permanently removed.' : 'Double-check the code or ask your host to resend it.'}</p>
          </div>
        </div>
      </>
    );

  // PIN / Auth gate
  if ((event.hasPin || event.accessMode === 'pin') && !pinUnlocked) {
    if (whoAreYouData) {
      return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', background: 'var(--ink)' }}>
          <AbsoluteThemeToggle />
          <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '24px', margin: 'auto' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 style={{ fontSize: '28px', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>Who are you?</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '15px', margin: 0 }}>Select your name to link this device.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <select 
                className="pin-input" 
                style={{ width: '100%', height: '56px', fontSize: '16px', padding: '0 16px', appearance: 'none', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                value={selectedGuestId}
                onChange={(e) => setSelectedGuestId(e.target.value)}
              >
                <option value="" disabled>Select your name...</option>
                {whoAreYouData.guests.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              
              {selectedGuestId && (
                <input
                  className="pin-input"
                  maxLength={6}
                  placeholder="6-digit Claim Code"
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleClaimSubmit()}
                  style={{ width: '100%', height: '56px', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}
                />
              )}

              {pinError && (
                <p style={{ color: 'var(--rust)', fontSize: 13, textAlign: 'center', margin: 0 }}>{pinError}</p>
              )}
              <button className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }} onClick={handleClaimSubmit}>
                Restore access
              </button>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', background: 'var(--ink)' }}>
        <AbsoluteThemeToggle />
        <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '24px', margin: 'auto' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/vaulty-dark-128.svg" alt="Vaulty icon" className="logo-dark" style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '16px', objectFit: 'cover' }} />
            <img src="/vaulty-light-128.svg" alt="Vaulty icon" className="logo-light" style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '16px', objectFit: 'cover' }} />
            <h2 style={{ fontSize: '28px', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>{event.name}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '15px', margin: 0 }}>Enter the code your host gave you</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              className="pin-input"
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              style={{ margin: '0 auto', width: '100%' }}
            />
            {pinError && (
              <p style={{ color: 'var(--rust)', fontSize: 13, textAlign: 'center', margin: 0 }}>{pinError}</p>
            )}
            <button className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }} onClick={handlePinSubmit}>
              Unlock gallery
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      {showNameModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--bg)', borderRadius: '24px', padding: '32px',
            width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Welcome!</h2>
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '15px' }}>
                What should we call you in the gallery?
              </p>
            </div>
            <input
              type="text"
              className="pin-input"
              placeholder="Your name"
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              autoFocus
            />
            <button
              className="btn btn-brass btn-block"
              style={{ height: '56px', fontSize: '16px' }}
              onClick={handleNameSubmit}
              disabled={submittingName || !guestNameInput.trim()}
            >
              {submittingName ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      )}
      <div className="wrap">
        <div className="event-header">
          <div className="sub">{fmtDate(event.date)}</div>
          <h1>{event.name}</h1>
          {sessionClaimCode && (
            <div style={{ marginTop: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Recovery Code:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px', color: 'var(--text-main)' }}>{sessionClaimCode}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="wrap section">
        {event.photographerName && (
          <div className="credit-banner">
            Professional photos by <strong>{event.photographerName}</strong> — look for the Pro
            Shots tab.
          </div>
        )}

        <UploadDropzone eventId={id} uploaderType="guest" onUploadComplete={loadData} />

        {event.moderationMode === 'approval' && (
          <p
            style={{
              fontSize: '12.5px',
              color: 'var(--text-dim)',
              marginTop: -6,
              marginBottom: 20,
            }}
          >
            Your photos are reviewed by the host before they appear in the gallery.
          </p>
        )}

        <Gallery
          uploads={uploads}
          myUploadIds={myIds}
          isHost={false}
          showProBadge={true}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      </div>
      <Footer />
    </>
  );
}

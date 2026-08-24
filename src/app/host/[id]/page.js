'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Gallery from '@/components/Gallery';
import { downloadFile } from '@/components/PhotoCard';
import { useToast } from '@/components/Toast';
import {
  getEvent,
  updateEvent,
  listUploads,
  subscribeToUploads,
  deleteSessionFile,
  getSessionFile,
} from '@/lib/store';
import { fmtDate, fmtBytes, PLACEHOLDER_GENERIC } from '@/lib/helpers';

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HostEventPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const showToast = useToast();
  const [event, setEvent] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [isJwtSession, setIsJwtSession] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedGuest, setCopiedGuest] = useState(false);
  const [copiedPro, setCopiedPro] = useState(false);
  const [rawPin, setRawPin] = useState(null);

  // Guest tracking
  const [guests, setGuests] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const ev = await getEvent(id);
      if (!ev) {
        setLoaded(true);
        return;
      }

      // 1. Check Host Profile session
      const sessionRes = await fetch('/api/host/me');
      const sessionData = await sessionRes.json();
      
      let authorized = false;

      if (sessionData.authenticated) {
        if (ev.hostId === sessionData.hostId) {
          authorized = true;
        }
      }
      
      // 2. Check legacy fallback
      if (!authorized) {
        const { getDeviceToken } = await import('@/lib/store');
        const token = await getDeviceToken();
        if (ev.creatorToken === token && !ev.hostId) {
          authorized = true;
        }
      }

      if (!authorized) {
        router.push('/host-login');
        return;
      }

      setEvent(ev);
      const ups = await listUploads(id);
      setUploads(ups);
      setLoaded(true);

    } catch (err) {
      console.error(err);
      setEvent({ _error: err.message || 'Unknown error occurred' });
      setLoaded(true);
    }
  }, [id, router]);

  useEffect(() => {
    loadData();
    let unsubscribe = null;
    let isSubscribed = true;
    
    // Subscribe to real-time upload updates
    subscribeToUploads(id, (newUploads) => {
      if (isSubscribed) {
        setUploads(newUploads);
      }
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(err => console.error('Subscription failed:', err));

    return () => {
      isSubscribed = false;
      if (unsubscribe) unsubscribe();
    };
  }, [loadData, id]);

  // Poll guest roster every 15 seconds
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    const pollGuests = async () => {
      try {
        const res = await fetch(`/api/events/${id}/guests`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setGuests(data.guests || []);
        }
      } catch { /* ignore */ }
    };
    pollGuests();
    const interval = setInterval(pollGuests, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [event, id]);

  const pending = uploads.filter((u) => u.status === 'pending');
  const approved = uploads.filter((u) => u.status === 'approved');
  const pro = approved.filter((u) => u.uploaderType === 'photographer');
  const guestUp = approved.filter((u) => u.uploaderType !== 'photographer');

  const guestLink = typeof window !== 'undefined' && event?.inviteToken
    ? window.location.origin + '/invite/' + event.inviteToken
    : (typeof window !== 'undefined' ? window.location.origin + '/e/' + id : '');
    
  const proLink =
    typeof window !== 'undefined' && event?.collaboratorCode
      ? window.location.origin + '/e/' + id + '/pro/' + event.collaboratorCode
      : '';

  const copyGuestLink = () => {
    navigator.clipboard?.writeText(guestLink).catch(() => {});
    setCopiedGuest(true);
    setTimeout(() => setCopiedGuest(false), 2000);
  };

  const copyProLink = () => {
    navigator.clipboard?.writeText(proLink).catch(() => {});
    setCopiedPro(true);
    setTimeout(() => setCopiedPro(false), 2000);
  };

  const toggleAccess = async () => {
    const isNowPin = event.accessMode !== 'pin';
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessMode: isNowPin ? 'pin' : 'open' })
    });
    if (res.ok) {
      const data = await res.json();
      setEvent({ ...event, accessMode: data.updated.accessMode, hasPin: data.updated.hasPin });
      setRawPin(data.rawPin || null);
    } else {
      showToast('Failed to update access mode');
    }
  };

  const resetPin = async () => {
    if (!confirm('This will invalidate the current PIN. Continue?')) return;
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetPin: true })
    });
    if (res.ok) {
      const data = await res.json();
      setEvent({ ...event, accessMode: 'pin', hasPin: true });
      setRawPin(data.rawPin);
      showToast('New PIN generated');
    }
  };

  const toggleMod = async () => {
    const ev = await getEvent(id);
    ev.moderationMode = ev.moderationMode === 'approval' ? 'auto' : 'approval';
    await updateEvent(ev);
    setEvent({ ...ev });
  };

  const handleApprove = async (uid) => {
    const res = await fetch(`/api/events/${id}/uploads/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadIds: [uid], action: 'approve' })
    });
    if (res.ok) {
      showToast('Approved');
      loadData();
    } else {
      showToast('Failed to approve');
    }
  };

  const handleReject = async (uid) => {
    if (!confirm('Reject and remove this photo?')) return;
    const res = await fetch(`/api/events/${id}/uploads/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadIds: [uid], action: 'reject' })
    });
    if (res.ok) {
      deleteSessionFile(uid);
      showToast('Rejected');
      loadData();
    } else {
      showToast('Failed to reject');
    }
  };

  const handleDelete = async (uid) => {
    if (!confirm('Remove this photo from the gallery?')) return;
    const res = await fetch(`/api/events/${id}/uploads/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadIds: [uid], action: 'delete' })
    });
    if (res.ok) {
      deleteSessionFile(uid);
      showToast('Removed');
      loadData();
    } else {
      showToast('Failed to remove');
    }
  };

  const handleDownload = async (uploadsToDownload) => {
    if (!uploadsToDownload || !uploadsToDownload.length) {
      showToast('Nothing to download yet');
      return;
    }

    // Determine if we are downloading all uploads or a subset
    // Hosts can see pending too, but if they hit "Download all" on the main tab it's usually all approved
    // Actually, Gallery.js passes `approved` if on the main tab.
    const isAll = uploadsToDownload.length === uploads.filter(u => u.status === 'approved').length;
    let url = `/api/v1/events/${id}/download-zip`;
    
    if (isAll) {
      url += '?all=true';
    } else {
      const ids = uploadsToDownload.map((u) => u.id).join(',');
      url += `?ids=${ids}`;
    }

    showToast('Starting download...');
    window.location.href = url;
  };

  if (!loaded)
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="event-header">
            <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '16px' }}></div>
            <div className="skeleton" style={{ width: '240px', height: '40px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ width: '160px', height: '20px', marginBottom: '24px' }}></div>
            <div className="stat-row">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="stat skeleton" style={{ height: '70px', borderRadius: '12px' }}></div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '32px' }}>
             <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '16px' }}></div>
          </div>
        </div>
      </>
    );

  if (!event || event.status === 'deleting' || event._error)
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="empty">
            <h3>{event?._error ? 'Error loading event' : (event ? 'Event is being deleted' : 'Event not found')}</h3>
            <p>{event?._error ? event._error : (event ? 'This event and its photos are currently being permanently removed.' : 'It may have been created in a different browser.')}</p>
            <button className="btn btn-brass" onClick={() => router.push('/host')}>
              Back to dashboard
            </button>
          </div>
        </div>
      </>
    );

  return (
    <>
      <Navbar />

      {showPasswordSetup && (
        <div className="wrap section" style={{ paddingBottom: 0 }}>
          <div className="warn-card">
            <div className="warn-card-header">
              <span className="warn-icon">⚠️</span>
              <h3>Protect your event</h3>
            </div>
            <p>
              You haven&apos;t set a host password for this event. If you clear your browser data or switch devices, you will lose host access permanently.
            </p>
            <form onSubmit={handleSetPassword} className="warn-card-form">
              <div className="warn-input-group">
                <label htmlFor="host-password">Host password</label>
                <input
                  id="host-password"
                  type="password"
                  placeholder="Set a secure password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-brass" disabled={savingPassword}>
                {savingPassword ? 'Saving...' : 'Set password'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {event?.pinUpgraded && (
        <div className="wrap section" style={{ paddingBottom: 0 }}>
          <div className="warn-card" style={{ background: '#fff3cd', border: '1px solid #ffe69c', color: '#664d03' }}>
            <div className="warn-card-header">
              <span className="warn-icon" style={{ filter: 'grayscale(1)' }}>🔒</span>
              <h3 style={{ color: '#664d03' }}>PIN Security Upgraded</h3>
            </div>
            <p style={{ color: '#664d03', marginTop: '8px' }}>
              Your event PIN has been upgraded to a more secure 6-digit hash. Since it cannot be viewed, you must click <b>Reset PIN</b> in the share panel below to generate a new one and share it with your guests.
            </p>
          </div>
        </div>
      )}

      <div className="wrap">
        <div className="event-header">
          <button className="back" onClick={() => router.push('/host')}>
            ← All events
          </button>
          <h1>{event.name}</h1>
          <div className="sub">{fmtDate(event.date)} · hosted by you</div>
          <div className="stat-row">
            <div className="stat">
              <b>{uploads.length}</b>
              <span>Total uploads</span>
            </div>
            <div className="stat">
              <b>{guests.length}</b>
              <span>Guests</span>
            </div>
            <div className="stat">
              <b>{pending.length}</b>
              <span>Awaiting review</span>
            </div>
            <div className="stat">
              <b>{pro.length}</b>
              <span>Pro shots</span>
            </div>
            <div className="stat">
              <b>{guestUp.length}</b>
              <span>Guest uploads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Share panel */}
      <div className="wrap section" style={{ paddingTop: 32 }}>
        <div className="share-panel">
          <div className="qr-seal">
            <div className="qr-inner">
              <QRCodeSVG value={guestLink} size={100} bgColor="#F3EFE4" fgColor="#14171C" />
            </div>
            <div className="qr-label">Scan to join</div>
          </div>
          <div className="share-details">
            {event.code && (
              <div className="field">
                <label>Event Code <span>(Short code)</span></label>
                <div className="share-row">
                  <input type="text" readOnly value={event.code} onClick={(e) => e.target.select()} style={{ letterSpacing: '1px', fontWeight: 'bold' }} />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor="guest-link">Guest link</label>
              <div className="share-row">
                <input id="guest-link" type="text" readOnly value={guestLink} onClick={(e) => e.target.select()} />
                <button className={`btn btn-sm ${copiedGuest ? 'copied' : ''}`} onClick={copyGuestLink}>
                  {copiedGuest ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="pro-link">Collaborator link <span>(photographer, no PIN)</span></label>
              <div className="share-row">
                <input id="pro-link" type="text" readOnly value={proLink} onClick={(e) => e.target.select()} />
                <button className={`btn btn-sm ${copiedPro ? 'copied' : ''}`} onClick={copyProLink}>
                  {copiedPro ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {event.accessMode === 'pin' && (
              <div className="pin-field">
                <label>Guest PIN</label>
                {rawPin ? (
                  <div className="pin-badge" style={{ background: '#e0f7fa', color: '#006064', display: 'flex', flexDirection: 'column' }}>
                    <span>{rawPin.split('').join(' ')}</span>
                    <span style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'normal', letterSpacing: 'normal' }}>
                      Save this! It won't be shown again.
                    </span>
                  </div>
                ) : (
                  <div className="pin-badge" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    ••••••
                    <button className="btn btn-sm" onClick={resetPin}>Reset PIN</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guests */}
      {guests.length > 0 && (
        <div id="guests" className="wrap section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <h2>Guests</h2>
              <p>{guests.length} connected guest{guests.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 520 }}>
            {guests.map(g => {
              const joinedAgo = g.joinedAt ? formatRelativeTime(g.joinedAt) : 'Unknown';
              const lastUpload = g.lastUploadAt ? formatRelativeTime(g.lastUploadAt) : 'Never';
              return (
                <div
                  key={g.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', borderRadius: '12px',
                    background: 'var(--card-bg)', border: '1px solid var(--line)'
                  }}
                >
                  <span style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'var(--brass-soft)', color: 'var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: '15px', flexShrink: 0
                  }}>
                    {g.name.charAt(0).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{g.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                      Joined {joinedAgo}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{g.photoCount}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {g.photoCount === 1 ? 'photo' : 'photos'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings */}
      <div id="settings" className="wrap section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Settings</h2>
          </div>
        </div>
        <div style={{ maxWidth: 520 }}>
          <div className="switch-row">
            <div className="lbl">
              <b>Require a PIN</b>
              <span>Guests must enter the code above before viewing or uploading.</span>
            </div>
            <div
              className={`switch ${event.accessMode === 'pin' ? 'on' : ''}`}
              onClick={toggleAccess}
            ></div>
          </div>
          <div className="switch-row" style={{ marginBottom: '32px' }}>
            <div className="lbl">
              <b>Require approval</b>
              <span>New guest uploads wait in a review queue before they&apos;re visible.</span>
            </div>
            <div
              className={`switch ${event.moderationMode === 'approval' ? 'on' : ''}`}
              onClick={toggleMod}
            ></div>
          </div>
          <div className="card-danger" style={{ marginBottom: 0 }}>
            <h3>Danger Zone</h3>
            <p>
              Permanently delete this event, all photos, and its Google Drive folder. This cannot be undone.
            </p>
            <button 
              className="btn btn-danger" 
              onClick={async () => {
                if (!confirm('Are you absolutely sure you want to permanently delete this event?')) return;
                try {
                  const res = await fetch(`/api/events/${id}/delete`, { method: 'POST' });
                  if (res.ok) {
                    showToast('Event deleted');
                    router.push('/host');
                  } else {
                    const data = await res.json();
                    showToast(data.error || 'Failed to delete event');
                  }
                } catch (err) {
                  showToast('Failed to delete event');
                }
              }}
            >
              Delete Event
            </button>
          </div>
        </div>
      </div>

      {/* Live wall */}
      <div className="wrap section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Open the live wall</h2>
            <p>Cast to a TV — new approved photos appear automatically.</p>
          </div>
          <button className="btn" onClick={() => router.push('/e/' + id + '/tv')}>
            Open live slideshow
          </button>
        </div>
      </div>

      {/* Gallery */}
      <div className="wrap section" style={{ paddingTop: 0 }}>
        <Gallery
          eventId={id}
          uploads={uploads}
          isHost={true}
          showProBadge={true}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onRefresh={loadData}
        />
      </div>

      <Footer />
    </>
  );
}

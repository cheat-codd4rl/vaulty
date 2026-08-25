'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import NewEventModal from '@/components/NewEventModal';
import EventCardMenu from '@/components/EventCardMenu';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { listHostEvents, listLegacyEvents, getDeviceToken, updateEvent, listUploads } from '@/lib/store';
import { fmtDate } from '@/lib/helpers';
import { useToast } from '@/components/Toast';

export default function HostDashboard() {
  const router = useRouter();
  const showToast = useToast();
  const [events, setEvents] = useState([]);
  const [legacyEvents, setLegacyEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [deleteModalEvent, setDeleteModalEvent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState(null);
  const [workingAction, setWorkingAction] = useState(null);

  const handleCardAction = async (action, event) => {
    switch (action) {
      case 'edit':
        router.push('/host/' + event.id + '#settings');
        break;
      case 'copy-link':
        navigator.clipboard.writeText(window.location.origin + '/e/' + event.id);
        showToast('Link copied');
        break;
      case 'toggle-pin':
        router.push('/host/' + event.id + '#settings');
        break;
      case 'toggle-publish':
        setWorkingAction(action);
        await updateEvent({ ...event, moderationMode: event.moderationMode === 'approval' ? 'auto' : 'approval' });
        loadEvents();
        setWorkingAction(null);
        break;
      case 'download-zip':
        setWorkingAction(action);
        await handleZipDownload(event);
        setWorkingAction(null);
        break;
      case 'guest-tracker':
        router.push('/host/' + event.id + '#guests');
        break;
      case 'delete':
        setDeleteModalError(null);
        setDeleteModalEvent(event);
        break;
    }
  };

  const handleZipDownload = async (event) => {
    const JSZip = (await import('jszip')).default;
    const uploadsToDownload = await listUploads(event.id);
    if (!uploadsToDownload || !uploadsToDownload.length) {
      showToast('No photos to download yet');
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
          }
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

  const confirmDelete = async () => {
    if (!deleteModalEvent) return;
    setIsDeleting(true);
    setDeleteModalError(null);
    try {
      const res = await fetch(`/api/events/${deleteModalEvent.id}/delete`, { method: 'POST' });
      if (res.ok) {
        showToast('Event deleted');
        setDeleteModalEvent(null);
        loadEvents();
      } else {
        const data = await res.json();
        setDeleteModalError(data.error || 'Failed to delete event');
      }
    } catch (err) {
      setDeleteModalError('Failed to delete event');
    }
    setIsDeleting(false);
  };

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/host/me');
      if (res.ok) {
        const data = await res.json();
        if (!data.authenticated) {
          setLoaded(true);
          setShowModal(true);
          return;
        }
        
        const evts = await listHostEvents(data.hostId);
        setEvents(evts);
        
        // Check for legacy events on this device
        const legEvts = await listLegacyEvents();
        setLegacyEvents(legEvts);
        
        setLoaded(true);
      } else {
        setLoaded(true);
        setShowModal(true);
      }
    } catch (err) {
      setLoaded(true);
      setShowModal(true);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreated = async (event) => {
    setShowModal(false);
    // Refresh list if the user created a profile
    if (event.isNewHost) {
      // Save the new account to localStorage for the account switcher
      try {
        const meRes = await fetch('/api/host/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated) {
            const { upsertAccount } = await import('@/components/HostProfileMenu');
            upsertAccount({ hostId: meData.hostId, email: meData.email, name: meData.name });
          }
        }
      } catch {
        // Non-critical
      }
      loadEvents();
    } else {
      router.push('/host/' + event.id);
    }
  };

  const handleClaim = async () => {
    if (!legacyEvents.length) return;
    setClaiming(true);
    try {
      const deviceToken = await getDeviceToken();
      const res = await fetch('/api/host/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken })
      });
      if (res.ok) {
        showToast('Events successfully claimed!');
        loadEvents();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to claim events');
      }
    } catch (err) {
      showToast('An error occurred');
    }
    setClaiming(false);
  };

  if (!loaded) {
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="section-head">
            <div>
              <div className="skeleton" style={{ width: '140px', height: '28px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ width: '220px', height: '16px' }}></div>
            </div>
            <div className="skeleton" style={{ width: '110px', height: '40px', borderRadius: '20px' }}></div>
          </div>
          <div className="vault-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="vault-card skeleton" style={{ height: '220px', border: 'none' }}></div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="wrap section">
        
        {legacyEvents.length > 0 && (
          <div style={{ background: 'var(--brass-soft)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--ink)' }}>Claim Your Previous Events</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)' }}>
              We found {legacyEvents.length} event(s) created on this device before Host Profiles were introduced. 
              Would you like to claim them so they are securely attached to your new Host Profile?
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {legacyEvents.map(e => (
                <span key={e.id} style={{ fontSize: '13px', background: 'rgba(0,0,0,0.1)', color: 'var(--ink)', padding: '4px 8px', borderRadius: '16px', fontWeight: 600 }}>
                  {e.name}
                </span>
              ))}
            </div>
            <button 
              onClick={handleClaim} 
              disabled={claiming}
              className="btn btn-ink" 
              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
            >
              {claiming ? 'Claiming...' : 'Claim Events'}
            </button>
          </div>
        )}

        <div className="section-head">
          <div>
            <h2>Your events</h2>
            <p>Manage all your securely hosted Vaulty events.</p>
          </div>
          <button className="btn btn-brass" onClick={() => setShowModal(true)}>
            + New event
          </button>
        </div>

        {events.length > 0 ? (
          <div className="vault-grid">
            {events.map((e) => {
              return (
                <div key={e.id} style={{ position: 'relative' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`vault-card ${e.status === 'deleting' ? 'disabled' : ''}`}
                    style={{ opacity: e.status === 'deleting' ? 0.6 : 1, cursor: e.status === 'deleting' ? 'not-allowed' : 'pointer', width: '100%', textAlign: 'left' }}
                    onClick={() => e.status !== 'deleting' && router.push('/host/' + e.id)}
                    onKeyDown={(evt) => evt.key === 'Enter' && e.status !== 'deleting' && router.push('/host/' + e.id)}
                  >
                    <div className="vault-cover">
                      {e.cover && <img src={e.cover} alt="" onError={(evt) => evt.target.style.display = 'none'} />}
                    </div>
                    {e.status !== 'deleting' && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}>
                        <EventCardMenu onAction={(action) => handleCardAction(action, e)} workingAction={workingAction} />
                      </div>
                    )}
                    <div className="vault-body">
                      <h3>{e.name}</h3>
                      <div className="meta">
                        {e.status === 'deleting' ? 'Deleting...' : fmtDate(e.date)}
                      </div>
                      <div className="vault-badges">
                        {e.status === 'deleting' ? (
                          <span className="pill warn">Deletion in progress</span>
                        ) : (
                          <>
                            <span className={`pill ${e.accessMode === 'pin' ? 'warn' : ''}`}>
                              {e.accessMode === 'pin' ? 'PIN protected' : 'open link'}
                            </span>
                            <span className={`pill ${e.moderationMode === 'approval' ? 'brass' : ''}`}>
                              {e.moderationMode === 'approval' ? 'approval required' : 'auto-publish'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {e.status === 'deleting' && e.deletionRequestedAt && (Date.now() - e.deletionRequestedAt > 10 * 60 * 1000) && (
                    <button 
                      className="btn" 
                      style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none' }}
                      onClick={(evt) => {
                        evt.stopPropagation();
                        if (confirm('Retry event deletion?')) {
                          fetch(`/api/events/${e.id}/delete`, { method: 'POST' })
                            .then(res => res.json())
                            .then(res => {
                               if (res.success) { showToast('Deletion retried/completed'); loadEvents(); }
                               else { showToast(res.error || 'Failed to retry deletion'); }
                            });
                        }
                      }}
                    >
                      Retry Deletion
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <h3>No events yet</h3>
            <p>
              Create one to get a shareable link and a printable QR code — guests can start
              uploading within a minute of scanning it.
            </p>
            <button className="btn btn-brass" onClick={() => setShowModal(true)}>
              + New event
            </button>
          </div>
        )}
      </div>
      <Footer />
      {showModal && <NewEventModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      {deleteModalEvent && (
        <ConfirmDeleteModal
          eventName={deleteModalEvent.name}
          isDeleting={isDeleting}
          error={deleteModalError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleteModalEvent(null);
            setDeleteModalError(null);
          }}
        />
      )}
    </>
  );
}

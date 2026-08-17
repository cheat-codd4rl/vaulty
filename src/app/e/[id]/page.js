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
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');

  const loadData = useCallback(async () => {
    const ev = await getEvent(id);
    setEvent(ev);
    if (ev) {
      const ups = await listUploads(id);
      setUploads(ups);
      const ids = await getMyUploadIds(id);
      setMyIds(ids);
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePinSubmit = () => {
    if (pinValue.trim() === event?.pin) {
      setPinUnlocked(true);
      setPinError('');
    } else {
      setPinError("That code doesn't match — try again.");
    }
  };

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

  if (!event)
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="empty">
            <h3>This link doesn&apos;t lead anywhere</h3>
            <p>Double-check the code or ask your host to resend it.</p>
          </div>
        </div>
      </>
    );

  // PIN gate
  if (event.accessMode === 'pin' && !pinUnlocked) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'var(--ink)' }}>
        <AbsoluteThemeToggle />
        <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/vaulty-dark-128.svg" alt="Vaulty icon" className="logo-dark" style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '16px', objectFit: 'cover' }} />
            <img src="/vaulty-light-128.svg" alt="Vaulty icon" className="logo-light" style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '16px', objectFit: 'cover' }} />
            <h2 style={{ fontSize: '28px', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>{event.name}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '15px', margin: 0 }}>Enter the code your host gave you</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              className="pin-input"
              maxLength={4}
              inputMode="numeric"
              placeholder="••••"
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
      <div className="wrap">
        <div className="event-header">
          <div className="sub">{fmtDate(event.date)}</div>
          <h1>{event.name}</h1>
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

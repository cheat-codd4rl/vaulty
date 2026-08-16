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
  updateUploadRecord,
  deleteUploadRecord,
  deleteSessionFile,
  getSessionFile,
} from '@/lib/store';
import { fmtDate, fmtBytes, PLACEHOLDER_GENERIC } from '@/lib/helpers';

export default function HostEventPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const showToast = useToast();
  const [event, setEvent] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const ev = await getEvent(id);
    if (!ev) {
      setLoaded(true);
      return;
    }
    setEvent(ev);
    const ups = await listUploads(id);
    setUploads(ups);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pending = uploads.filter((u) => u.status === 'pending');
  const approved = uploads.filter((u) => u.status === 'approved');
  const pro = approved.filter((u) => u.uploaderType === 'photographer');
  const guestUp = approved.filter((u) => u.uploaderType !== 'photographer');

  const guestLink = typeof window !== 'undefined' ? window.location.origin + '/e/' + id : '';
  const proLink =
    typeof window !== 'undefined' && event
      ? window.location.origin + '/e/' + id + '/pro/' + event.collaboratorCode
      : '';

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    showToast('Link copied');
  };

  const toggleAccess = async () => {
    const ev = await getEvent(id);
    ev.accessMode = ev.accessMode === 'pin' ? 'open' : 'pin';
    if (ev.accessMode === 'pin' && !ev.pin) {
      ev.pin = String(Math.floor(1000 + Math.random() * 9000));
    }
    await updateEvent(ev);
    setEvent({ ...ev });
  };

  const toggleMod = async () => {
    const ev = await getEvent(id);
    ev.moderationMode = ev.moderationMode === 'approval' ? 'auto' : 'approval';
    await updateEvent(ev);
    setEvent({ ...ev });
  };

  const handleApprove = async (uid) => {
    const u = uploads.find((x) => x.id === uid);
    if (u) {
      u.status = 'approved';
      await updateUploadRecord(u);
      showToast('Approved');
      loadData();
    }
  };

  const handleReject = async (uid) => {
    if (!confirm('Reject and remove this photo?')) return;
    await deleteUploadRecord(id, uid);
    deleteSessionFile(uid);
    showToast('Rejected');
    loadData();
  };

  const handleDelete = async (uid) => {
    if (!confirm('Remove this photo from the gallery?')) return;
    await deleteUploadRecord(id, uid);
    deleteSessionFile(uid);
    showToast('Removed');
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
        // Fall back to in-memory session blobs
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
          <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
        </div>
      </>
    );

  if (!event)
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="empty">
            <h3>Event not found</h3>
            <p>It may have been created in a different browser.</p>
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
              <QRCodeSVG value={guestLink} size={104} bgColor="#F3EFE4" fgColor="#14171C" />
            </div>
          </div>
          <div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Guest link</label>
              <div className="share-row">
                <input type="text" readOnly value={guestLink} />
                <button className="btn btn-sm" onClick={() => copyToClipboard(guestLink)}>
                  Copy
                </button>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Collaborator link (photographer, no PIN needed)</label>
              <div className="share-row">
                <input type="text" readOnly value={proLink} />
                <button className="btn btn-sm" onClick={() => copyToClipboard(proLink)}>
                  Copy
                </button>
              </div>
            </div>
            {event.accessMode === 'pin' && (
              <div style={{ marginTop: 12 }}>
                Guest PIN: <span className="pin-badge">{event.pin}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="wrap section" style={{ paddingTop: 0 }}>
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
          <div className="switch-row">
            <div className="lbl">
              <b>Require approval</b>
              <span>New guest uploads wait in a review queue before they&apos;re visible.</span>
            </div>
            <div
              className={`switch ${event.moderationMode === 'approval' ? 'on' : ''}`}
              onClick={toggleMod}
            ></div>
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

      {/* Review queue */}
      {pending.length > 0 && (
        <div className="wrap section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <h2>Review queue</h2>
              <p>Nothing here goes live until you approve it.</p>
            </div>
          </div>
          <div className="review-list">
            {pending.map((u) => (
              <div className="review-item" key={u.id}>
                <div className="rthumb">
                  <img src={u.thumbnail || PLACEHOLDER_GENERIC} alt="" />
                </div>
                <div className="rmeta">
                  {u.filename}
                  <br />
                  {u.uploaderType === 'photographer' ? 'Photographer' : 'Guest'} · {fmtBytes(u.size)}
                </div>
                <div className="ractions">
                  <button className="btn btn-sm" onClick={() => handleApprove(u.id)}>
                    Approve
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleReject(u.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery */}
      <div className="wrap section" style={{ paddingTop: 0 }}>
        <Gallery
          uploads={uploads}
          isHost={true}
          showProBadge={true}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      </div>

      <Footer />
    </>
  );
}

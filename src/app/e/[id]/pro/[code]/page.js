'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import UploadDropzone from '@/components/UploadDropzone';
import Gallery from '@/components/Gallery';
import { useToast } from '@/components/Toast';
import {
  getEvent,
  updateEvent,
  listUploads,
  getMyUploadIds,
  deleteUploadRecord,
  deleteSessionFile,
  getSessionFile,
} from '@/lib/store';
import { fmtDate } from '@/lib/helpers';

export default function PhotographerPage({ params }) {
  const { id, code } = use(params);
  const showToast = useToast();
  const [event, setEvent] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [myIds, setMyIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [valid, setValid] = useState(false);

  const loadData = useCallback(async () => {
    const ev = await getEvent(id);
    setEvent(ev);
    if (ev && code === ev.collaboratorCode) {
      setValid(true);
      const ups = await listUploads(id);
      setUploads(ups);
      const ids = await getMyUploadIds(id);
      setMyIds(ids);
    }
    setLoaded(true);
  }, [id, code]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreditChange = async (e) => {
    const ev = await getEvent(id);
    ev.photographerName = e.target.value.trim();
    await updateEvent(ev);
    setEvent({ ...ev });
    showToast('Credit updated');
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
            <h3>This link doesn&apos;t lead anywhere</h3>
          </div>
        </div>
      </>
    );

  if (!valid)
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="empty">
            <h3>This collaborator link isn&apos;t valid</h3>
            <p>Ask your host to resend the Pro link from their event dashboard.</p>
          </div>
        </div>
      </>
    );

  return (
    <>
      <Navbar />
      <div className="wrap">
        <div className="event-header">
          <div className="sub">{fmtDate(event.date)} · Collaborator upload</div>
          <h1>{event.name}</h1>
        </div>
      </div>
      <div className="wrap section">
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="proName">Credit name</label>
          <input
            type="text"
            id="proName"
            defaultValue={event.photographerName || ''}
            placeholder="Your name or studio"
            onBlur={handleCreditChange}
          />
        </div>

        <UploadDropzone eventId={id} event={event} uploaderType="photographer" isPro collaboratorCode={code} onUploadComplete={loadData} />

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

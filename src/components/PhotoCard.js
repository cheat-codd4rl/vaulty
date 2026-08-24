'use client';

import { PLACEHOLDER_GENERIC, PLACEHOLDER_VIDEO, PLACEHOLDER_DOCUMENT_VIDEO, fmtBytes } from '@/lib/helpers';
import { getSessionFile } from '@/lib/store';

export default function PhotoCard({
  upload,
  onDownload,
  onDelete,
  showProBadge = false,
  selectable = false,
  selected = false,
  onSelect,
}) {
  const u = upload;
  const badge =
    u.status === 'pending' ? (
      <span className="badge pending">pending</span>
    ) : u.uploaderType === 'photographer' && showProBadge ? (
      <span className="badge pro">pro</span>
    ) : null;

  const playbadge = u.isVideo ? <span className="playbadge">▶</span> : null;

  const handleDownload = (e) => {
    console.log('PhotoCard handleDownload clicked for', u.id);
    e.stopPropagation();
    if (!onDownload) {
      console.log('PhotoCard onDownload is missing!');
      return;
    }
    console.log('PhotoCard calling onDownload...');
    onDownload(u);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!onDelete) return;
    onDelete(u.id);
  };

  return (
    <div className={`photo ${selectable ? 'selectable-card' : ''} ${selected ? 'selected' : ''}`}>
      <div className="corner tl"></div>
      <div className="corner br"></div>
      {badge}
      <img src={u.thumbnail || (u.isVideo ? PLACEHOLDER_DOCUMENT_VIDEO : PLACEHOLDER_GENERIC)} alt={u.filename} />
      {playbadge && !u.thumbnail ? null : playbadge}
      
      {!selectable && (
        <div className="actions">
          <button onClick={handleDownload} title="Download" aria-label="Download">
            ⬇
          </button>
          {onDelete && (
            <button onClick={handleDelete} title="Remove" aria-label="Remove">
              ✕
            </button>
          )}
        </div>
      )}

      {selectable && (
        <>
          <button
            type="button"
            className="selection-overlay"
            onClick={() => onSelect(u.id)}
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select ${u.filename}`}
          ></button>
          <div className={`check-circle ${selected ? 'checked' : ''}`}>
            {selected && <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5 7.5 5.5 10.5 11.5 3.5" /></svg>}
          </div>
        </>
      )}

      <div className="cap">
        <span className="fn">{u.filename}</span>
        <span>{u.isVideo ? 'video' : ''}</span>
      </div>
    </div>
  );
}

export function downloadFile(upload) {
  const a = document.createElement('a');

  // Prefer Drive's download URL (forces download rather than inline view)
  if (upload.downloadUrl) {
    a.href = upload.downloadUrl;
  } else if (upload.viewUrl) {
    a.href = upload.viewUrl;
  } else if (upload.fileUrl) {
    // Legacy GCS field, if any records remain
    a.href = upload.fileUrl;
  } else {
    // Fall back to in-memory session blobs (localStorage mode)
    const sess = getSessionFile(upload.id);
    if (sess && sess.blob) {
      a.href = URL.createObjectURL(sess.blob);
    } else if (sess && sess.file) {
      a.href = URL.createObjectURL(sess.file);
    } else {
      a.href = upload.thumbnail || PLACEHOLDER_GENERIC;
    }
  }

  a.download = upload.filename || 'photo.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
}



'use client';

import { useState } from 'react';
import PhotoCard, { downloadFile } from './PhotoCard';

export default function Gallery({
  uploads,
  myUploadIds = [],
  showTabs = true,
  showProBadge = true,
  isHost = false,
  onDelete,
  onDownload,
}) {
  const [tab, setTab] = useState('all');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const approved = uploads.filter((u) => u.status === 'approved');
  const pro = approved.filter((u) => u.uploaderType === 'photographer');
  const guestUp = approved.filter((u) => u.uploaderType !== 'photographer');
  const mine = uploads.filter((u) => myUploadIds.includes(u.id));

  let shown;
  switch (tab) {
    case 'pro':
      shown = pro;
      break;
    case 'guest':
      shown = guestUp;
      break;
    case 'mine':
      shown = mine;
      break;
    default:
      shown = approved;
  }

  const handleTabSwitch = (newTab) => {
    setTab(newTab);
    setIsSelecting(false);
    setSelectedIds([]);
  };

  const handleSelectToggle = () => {
    if (isSelecting) {
      setIsSelecting(false);
      setSelectedIds([]);
    } else {
      setIsSelecting(true);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === shown.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(shown.map((u) => u.id));
    }
  };

  const handleCardSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleDownloadAction = () => {
    if (!onDownload) return;
    if (isSelecting && selectedIds.length > 0) {
      const selectedUploads = shown.filter((u) => selectedIds.includes(u.id));
      onDownload(selectedUploads);
      setIsSelecting(false);
      setSelectedIds([]);
    } else {
      onDownload(approved);
    }
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Gallery</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onDownload && shown.length > 0 && !isSelecting && (
            <button className="btn btn-sm btn-ghost" onClick={handleSelectToggle}>
              Select
            </button>
          )}
          {isSelecting && (
            <>
              <button className="btn btn-sm btn-ghost" onClick={handleSelectAll}>
                {selectedIds.length === shown.length ? 'Clear' : 'Select all'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={handleSelectToggle}>
                Cancel
              </button>
            </>
          )}
          {onDownload && (
            <button
              className="btn btn-sm"
              onClick={handleDownloadAction}
              disabled={isSelecting && selectedIds.length === 0}
            >
              {isSelecting
                ? `Download ${selectedIds.length} ${selectedIds.length === 1 ? 'photo' : 'photos'}`
                : 'Download all (.zip)'}
            </button>
          )}
        </div>
      </div>

      {showTabs && (
        <div className="tabs">
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => handleTabSwitch('all')}>
            All ({approved.length})
          </button>
          <button className={`tab ${tab === 'pro' ? 'active' : ''}`} onClick={() => handleTabSwitch('pro')}>
            Pro Shots ({pro.length})
          </button>
          <button className={`tab ${tab === 'guest' ? 'active' : ''}`} onClick={() => handleTabSwitch('guest')}>
            Guest Uploads ({guestUp.length})
          </button>
          {!isHost && (
            <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => handleTabSwitch('mine')}>
              My uploads ({mine.length})
            </button>
          )}
        </div>
      )}

      {shown.length > 0 ? (
        <div className="gallery">
          {shown.map((u) => (
            <PhotoCard
              key={u.id}
              upload={u}
              showProBadge={showProBadge}
              selectable={isSelecting}
              selected={selectedIds.includes(u.id)}
              onSelect={handleCardSelect}
              onDownload={downloadFile}
              onDelete={
                (isHost || myUploadIds.includes(u.id)) && onDelete
                  ? onDelete
                  : null
              }
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>{tab === 'mine' ? "You haven't uploaded anything yet" : 'No photos in this tab yet'}</h3>
          <p>
            {tab === 'mine'
              ? 'Photos you add will show up here, even while awaiting review.'
              : isHost
                ? 'Share the link above to start collecting.'
                : 'Be the first to add one above.'}
          </p>
        </div>
      )}
    </>
  );
}

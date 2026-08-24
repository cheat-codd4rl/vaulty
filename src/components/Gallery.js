'use client';

import { useState } from 'react';
import PhotoCard, { downloadFile } from './PhotoCard';
import { useToast } from './Toast';

export default function Gallery({
  eventId,
  uploads,
  myUploadIds = [],
  showTabs = true,
  showProBadge = true,
  isHost = false,
  onDelete,
  onDownload,
  onRefresh,
}) {
  const showToast = useToast();
  const [tab, setTab] = useState('all');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [processing, setProcessing] = useState(false);

  const approved = uploads.filter((u) => u.status === 'approved');
  const pending = uploads.filter((u) => u.status === 'pending');
  const pro = approved.filter((u) => u.uploaderType === 'photographer');
  const guestUp = approved.filter((u) => u.uploaderType !== 'photographer');
  const mine = uploads.filter((u) => myUploadIds.includes(u.id));

  let shown;
  switch (tab) {
    case 'review':
      shown = pending;
      break;
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

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0 || !eventId) return;
    
    if (action === 'delete' || action === 'reject') {
      if (!confirm(`Are you sure you want to ${action} ${selectedIds.length} item(s)?`)) return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/uploads/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadIds: selectedIds, action })
      });

      if (res.ok) {
        const data = await res.json();
        if (res.status === 207) {
          showToast(`Processed ${data.successful?.length || 0} items. Failed: ${data.failed?.length || 0}`);
        } else {
          showToast(`Successfully processed ${selectedIds.length} items`);
        }
        setSelectedIds([]);
        setIsSelecting(false);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to process items');
      }
    } catch (err) {
      showToast('An error occurred');
    }
    setProcessing(false);
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Gallery</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isHost && tab === 'review' && shown.length > 0 && !isSelecting && (
             <button className="btn btn-sm btn-brass" onClick={handleSelectToggle}>
               Review Items
             </button>
          )}
          {shown.length > 0 && !isSelecting && (
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
          {onDownload && !isSelecting && (
            <button className="btn btn-sm" onClick={handleDownloadAction}>
              Download all (.zip)
            </button>
          )}
        </div>
      </div>

      {showTabs && (
        <div className="tabs">
          {isHost && (
            <button className={`tab ${tab === 'review' ? 'active' : ''}`} onClick={() => handleTabSwitch('review')}>
              Needs Review {pending.length > 0 && <span style={{ background: 'var(--rust)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', marginLeft: '6px' }}>{pending.length}</span>}
            </button>
          )}
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
              onDownload={onDownload}
              onDelete={
                (isHost || myUploadIds.includes(u.id)) && onDelete && tab !== 'review'
                  ? onDelete
                  : null
              }
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>
            {tab === 'review' ? 'Review queue is empty' : tab === 'mine' ? "You haven't uploaded anything yet" : 'No photos in this tab yet'}
          </h3>
          <p>
            {tab === 'mine'
              ? 'Photos you add will show up here, even while awaiting review.'
              : isHost
                ? tab === 'review' ? 'Any new uploads that require approval will appear here.' : 'Share the link above to start collecting.'
                : 'Be the first to add one above.'}
          </p>
        </div>
      )}

      {isSelecting && selectedIds.length > 0 && (
        <div className="floating-bar">
          <span style={{ fontWeight: 600, marginRight: '8px' }}>{selectedIds.length} selected</span>
          
          {isHost && tab === 'review' ? (
            <>
              <button 
                className="btn btn-sm btn-brass" 
                onClick={() => handleBulkAction('approve')}
                disabled={processing}
              >
                Approve
              </button>
              <button 
                className="btn btn-sm btn-danger" 
                onClick={() => handleBulkAction('reject')}
                disabled={processing}
              >
                Reject
              </button>
            </>
          ) : (
            <>
              {onDownload && (
                <button 
                  className="btn btn-sm" 
                  onClick={handleDownloadAction}
                >
                  Download
                </button>
              )}
              {isHost && (
                <button 
                  className="btn btn-sm btn-danger" 
                  onClick={() => handleBulkAction('delete')}
                  disabled={processing}
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

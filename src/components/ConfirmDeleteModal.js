'use client';

export default function ConfirmDeleteModal({ eventName, onConfirm, onCancel, isDeleting, error }) {
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--ink)' }}>Delete Event</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.5 }}>
            Are you absolutely sure you want to delete <strong>{eventName}</strong>? This will permanently remove all photos and its Google Drive folder. This cannot be undone.
          </p>
        </div>
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255, 50, 50, 0.1)', border: '1px solid rgba(255, 50, 50, 0.3)', borderRadius: '8px', color: '#ff6b6b', fontSize: '14px', lineHeight: 1.4 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            className="btn" 
            onClick={onCancel} 
            disabled={isDeleting}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--ink)' }}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={onConfirm} 
            disabled={isDeleting}
            style={{ background: 'rgba(255,50,50,0.9)', color: '#fff', border: 'none' }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

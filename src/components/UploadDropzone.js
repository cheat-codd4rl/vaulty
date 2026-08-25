'use client';

import { useRef, useState, useCallback } from 'react';
import { upload } from '@vercel/blob/client';
import { useToast } from '@/components/Toast';
import { genId, sleep, PLACEHOLDER_HEIC, PLACEHOLDER_VIDEO, PLACEHOLDER_GENERIC, PLACEHOLDER_DOCUMENT_VIDEO } from '@/lib/helpers';
import { isHeic, isVideoFile, processImageFile, processVideoFile } from '@/lib/fileProcessing';
import { addUploadRecord, getEvent, getDeviceToken, setSessionFile, saveMyUploadId } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';

/**
 * Two-step upload: browser → Vercel Blob (direct, no function in the path),
 * then small JSON → /api/upload (streams Blob → Drive, writes Firestore).
 *
 * Real onUploadProgress from @vercel/blob/client replaces the old
 * simulated/XHR progress bar. The file's bytes never pass through a
 * Vercel Function, so the 4.5MB body limit doesn't apply.
 */
async function uploadFile(file, { eventId, uploaderType, deviceToken, collaboratorCode, thumbnail, onProgress }) {
  const clientPayload = JSON.stringify({ eventId, uploaderType, collaboratorCode });

  // Step 1: browser uploads directly to Vercel Blob.
  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/upload/blob-token',
    clientPayload,
    onUploadProgress: (progressEvent) => {
      onProgress?.(progressEvent.percentage); // 0–100
    },
  });

  // Step 2: tell the server the file is staged. This request is tiny —
  // just the blob URL and metadata — nowhere near the 4.5MB limit.
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blobUrl: blob.url,
      filename: file.name,
      mimeType: file.type,
      eventId,
      uploaderType,
      deviceToken,
      collaboratorCode,
      thumbnail,
    }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || 'Upload failed');
  }
  return res.json();
}

export default function UploadDropzone({
  eventId,
  event,
  uploaderType,
  onUploadComplete,
  isPro = false,
  collaboratorCode = null,
}) {
  const inputRef = useRef(null);
  const processedFilesRef = useRef(new Set());
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState([]);
  const showToast = useToast();

  // "Cloud not configured" (no env vars, local dev) vs "cloud is configured"
  // are different situations. We decide this once at mount, not per-request.
  const useCloud = isFirebaseConfigured();

  const handleFiles = useCallback(
    async (fileList) => {
      const DOCUMENT_MODE_THRESHOLD = 200 * 1024 * 1024;
      const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024;

      const validFiles = [];
      let skippedCount = 0;
      
      for (const file of Array.from(fileList)) {
        if (file.size > MAX_FILE_SIZE) {
          showToast(`${file.name} exceeds the 1.5 GB limit`, 'error');
          continue;
        }
        
        // Prevent duplicate uploads in the same session
        const signature = `${file.name}-${file.size}-${file.lastModified || 0}`;
        if (processedFilesRef.current.has(signature)) {
          skippedCount++;
          continue;
        }
        
        processedFilesRef.current.add(signature);
        validFiles.push(file);
      }
      
      if (skippedCount > 0) {
        showToast(`Skipped ${skippedCount} duplicate file${skippedCount > 1 ? 's' : ''}`);
      }
      
      if (validFiles.length === 0) return;
      
      // Step 1: Immediately populate visual queue before ANY async operations
      const initialItems = validFiles.map(file => {
        const id = genId('up_');
        return {
          id,
          file,
          heic: isHeic(file),
          video: isVideoFile(file),
          documentMode: isVideoFile(file) && file.size > DOCUMENT_MODE_THRESHOLD,
          qItem: { id, filename: file.name, progress: 0, state: 'processing', thumbnail: null }
        };
      });

      setQueue((prev) => [...initialItems.map(i => i.qItem), ...prev]);

      // Step 2: Fetch prerequisites
      const ev = event || await getEvent(eventId);
      if (!ev) return;
      const deviceToken = await getDeviceToken();

      // Helper function to process and upload a single item
      const processItem = async (item) => {
        const { id, file, heic, video, documentMode } = item;
        try {
          /* ── Process file (thumbnail, resize) ── */
          setQueue((prev) =>
            prev.map((q) =>
              q.id === id
                ? { ...q, state: documentMode ? 'preparing' : video ? 'reading frame' : heic ? 'converting' : 'processing' }
                : q
            )
          );

          let processedBlob = file;
          let thumbnail = null;
          let duration = 0;
          try {
            if (documentMode) {
              thumbnail = PLACEHOLDER_DOCUMENT_VIDEO; // Skip client-side processing for huge videos
            } else if (heic) {
              thumbnail = PLACEHOLDER_HEIC;
            } else if (video) {
              const res = await processVideoFile(file);
              thumbnail = res.thumbDataUrl || PLACEHOLDER_VIDEO;
              duration = res.duration;
            } else {
              const res = await processImageFile(file);
              thumbnail = res.thumbDataUrl;
              processedBlob = file; // Upload original bytes
              setSessionFile(id, { file, blob: res.blob }); // UI preview can use resized blob
            }
          } catch (e) {
            thumbnail = video ? PLACEHOLDER_VIDEO : PLACEHOLDER_GENERIC;
          }

          /* ── Upload via Blob relay (if cloud is configured) ── */
          if (useCloud) {
            try {
              console.log('Setting state to uploading for', id);
              setQueue((prev) =>
                prev.map((q) => (q.id === id ? { ...q, state: 'uploading', progress: 0 } : q))
              );

              const uploadDoc = await uploadFile(processedBlob, {
                eventId,
                uploaderType,
                deviceToken,
                collaboratorCode,
                thumbnail,
                onProgress: (pct) => {
                  setQueue((prev) =>
                    prev.map((q) => (q.id === id ? { ...q, progress: pct } : q))
                  );
                },
              });

              console.log('Upload to server finished:', uploadDoc);
              // Success — update queue with server-determined status
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === id
                    ? {
                        ...q,
                        progress: 100,
                        thumbnail: thumbnail,
                        state: uploadDoc.status === 'pending' ? 'awaiting review' : 'done',
                      }
                    : q
                )
              );
              
              saveMyUploadId(eventId, uploadDoc.id, uploadDoc.deleteToken);
            } catch (err) {
              console.error('Upload failed with error:', err);
              showToast(err.message || 'Upload failed', 'error');
              if (err.message && err.message.includes('Service Configuration Error')) {
                setQueue((prev) =>
                  prev.map((q) =>
                    q.id === id ? { ...q, progress: 0, state: 'temporarily unavailable' } : q
                  )
                );
              } else {
                setQueue((prev) =>
                  prev.map((q) =>
                    q.id === id ? { ...q, progress: 0, state: 'failed — tap to retry' } : q
                  )
                );
              }
              await sleep(4000);
              setQueue((prev) => prev.filter((q) => q.id !== id));
              return; // End this item's processing here
            }
          } else {
            /* ── Local-only mode (no cloud config): simulate progress ── */
            const record = {
              id,
              eventId,
              uploaderType,
              deviceToken,
              filename: file.name,
              size: file.size,
              isVideo: video,
              isHeic: heic,
              thumbnail,
              fileUrl: null,
              exifStripped: !heic && !video,
              duration,
              status: uploaderType === 'photographer' ? 'approved' : event.moderationMode === 'approval' ? 'pending' : 'approved',
              createdAt: Date.now(),
            };

            setSessionFile(id, { file, blob: processedBlob !== file ? processedBlob : null });

            const steps = 9;
            const stepTime = Math.min(160, Math.max(35, file.size / 60000));
            for (let s = 1; s <= steps; s++) {
              await sleep(stepTime);
              setQueue((prev) =>
                prev.map((q) => (q.id === id ? { ...q, progress: Math.round((s / steps) * 100) } : q))
              );
            }
            await addUploadRecord(record);

            setQueue((prev) =>
              prev.map((q) =>
                q.id === id
                  ? { ...q, progress: 100, thumbnail, state: record.status === 'pending' ? 'awaiting review' : 'done' }
                  : q
              )
            );
          }

          await sleep(220);
          setQueue((prev) => prev.filter((q) => q.id !== id));
        } catch (e) {
          console.error('Unhandled item processing error:', e);
          setQueue((prev) =>
            prev.map((q) => (q.id === id ? { ...q, progress: 0, state: 'failed' } : q))
          );
          await sleep(4000);
          setQueue((prev) => prev.filter((q) => q.id !== id));
        }
      };

      // Define our pool runner logic
      const runPool = async (items, workerCount) => {
        let index = 0;
        const worker = async () => {
          while (true) {
            const currentIndex = index++;
            if (currentIndex >= items.length) return;
            await processItem(items[currentIndex]);
          }
        };
        await Promise.allSettled(
          Array.from({ length: Math.min(workerCount, items.length) }, () => worker())
        );
      };

      const images = initialItems.filter(i => !i.video);
      const videos = initialItems.filter(i => i.video);

      // Step 3: Run dual-pool execution
      await Promise.all([
        runPool(images, 3),
        runPool(videos, 1)
      ]);

      if (onUploadComplete) onUploadComplete();
    },
    [eventId, event, uploaderType, onUploadComplete, useCloud, collaboratorCode]
  );

  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <>
      <label
        className={`dropzone ${dragging ? 'drag' : ''}`}
        style={{ display: 'block', cursor: 'pointer' }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="icon">＋</div>
        <h3>{isPro ? 'Add your edited photos' : 'Add photos or a short video'}</h3>
        <p>
          {isPro
            ? 'Drop hundreds at once — they upload in the background as Pro Shots.'
            : 'Drag files here, or tap to choose from your camera roll. HEIC and MOV are welcome.'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime"
          multiple
          style={{
            // DO NOT use display:none — iOS Safari won't fire the change event
            // when a display:none input is triggered via .click(). Use accessible
            // visually-hidden instead: keeps it in the layout/render tree.
            opacity: 0,
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            zIndex: -1,
          }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length) {
              handleFiles(files);
              // Clear input value after files are read to allow re-uploading the same file
              // Doing this in onChange instead of onClick avoids the Android "ghost file" bug
              e.target.value = '';
            }
          }}
        />
      </label>
      {queue.length > 0 && (
        <div className="queue">
          {queue.map((q) => (
            <div className="qitem" key={q.id}>
              <div className="qthumb">
                {q.thumbnail && <img src={q.thumbnail} alt="" />}
              </div>
              <div className="qmeta">
                <div className="qname">{q.filename}</div>
                <div className="qbar">
                  <i style={{ width: q.progress + '%' }}></i>
                </div>
              </div>
              <div className="qstate mono">{q.state}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

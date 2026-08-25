/* File processing utilities — ported from prototype */

import { PLACEHOLDER_HEIC, PLACEHOLDER_VIDEO, PLACEHOLDER_GENERIC } from './helpers';

export async function computeFileHash(file) {
  try {
    // Hash a sample of the file to be extremely fast even on 1GB+ videos
    // We sample 100KB from the start, middle, and end, plus the file size
    const CHUNK_SIZE = 100 * 1024;
    const size = file.size;
    
    const mid = Math.floor(size / 2);
    const slices = [
      file.slice(0, Math.min(CHUNK_SIZE, size)),
      file.slice(Math.max(0, mid - CHUNK_SIZE / 2), Math.min(size, mid + CHUNK_SIZE / 2)),
      file.slice(Math.max(0, size - CHUNK_SIZE), size)
    ];
    
    // Fallback for older browsers (iOS 13-) that don't support Blob.arrayBuffer()
    if (typeof slices[0].arrayBuffer !== 'function') {
      return `fallback-${file.name}-${file.size}-${file.lastModified}`;
    }

    const buffers = await Promise.all(slices.map(slice => slice.arrayBuffer()));
    
    // Total byte size of our sampled buffer
    const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0);
    const combined = new Uint8Array(totalLength + 8); // +8 for the size metadata
    
    // Write the size as a 64-bit float at the beginning
    new DataView(combined.buffer).setFloat64(0, size, true);
    
    // Write the file samples
    let offset = 8;
    for (const buffer of buffers) {
      combined.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    
    // Fallback for insecure contexts or older browsers (like iOS 13-) where crypto is missing.
    // Note: This pseudo-hash (`name-size-lastModified`) is not cryptographically secure and is not content-based.
    // It carries a negligible but theoretical risk of false-positive collision if two users upload 
    // different photos that magically share the exact same filename, exact byte size, and exact millisecond timestamp.
    // However, it prevents upload failure on legacy devices while preserving dedup for the vast majority.
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return `fallback-${file.name}-${file.size}-${file.lastModified}`;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error("File hash failed, using fallback:", err);
    return `fallback-${file.name}-${file.size}-${file.lastModified}`;
  }
}

export function isHeic(file) {
  return /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
}

export function isVideoFile(file) {
  return /^video\//.test(file.type) || /\.(mp4|mov|m4v)$/i.test(file.name);
}

export function processImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    // Safety timeout in case image never loads or errors
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      img.src = '';
      reject(new Error('Image processing timed out'));
    }, 15000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const maxDim = 2200;
        let w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        ctx.drawImage(img, 0, 0, w, h);
        
        // Free image memory immediately after drawing
        img.onerror = null;
        img.src = '';
        
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('encode failed'));
              canvas.width = 0; canvas.height = 0;
              return;
            }
            try {
              const tW = 480,
                tH = Math.max(1, Math.round(h * (tW / w)));
              const tCanvas = document.createElement('canvas');
              tCanvas.width = tW;
              tCanvas.height = tH;
              const tCtx = tCanvas.getContext('2d');
              if (tCtx) tCtx.drawImage(canvas, 0, 0, tW, tH);
              const thumbDataUrl = tCanvas.toDataURL('image/jpeg', 0.62);
              
              canvas.width = 0; canvas.height = 0;
              tCanvas.width = 0; tCanvas.height = 0;
              
              resolve({ blob, thumbDataUrl, width: w, height: h });
            } catch (err) {
              reject(err);
              canvas.width = 0; canvas.height = 0;
            }
          },
          'image/jpeg',
          0.88
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        img.src = '';
        reject(err);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      img.src = '';
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

export function processVideoFile(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    let done = false;
    function finish(thumb, duration) {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve({ thumbDataUrl: thumb, duration: duration || 0 });
    }
    video.addEventListener('loadeddata', () => {
      try {
        video.currentTime = Math.min(0.4, (video.duration || 0.8) / 2);
      } catch (e) {
        finish(null, video.duration);
      }
    });
    video.addEventListener('seeked', () => {
      try {
        const c = document.createElement('canvas');
        c.width = video.videoWidth || 480;
        c.height = video.videoHeight || 270;
        const ctx = c.getContext('2d');
        if (ctx) ctx.drawImage(video, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/jpeg', 0.6);
        c.width = 0;
        c.height = 0;
        finish(dataUrl, video.duration);
      } catch (e) {
        finish(null, video.duration);
      }
    });
    video.addEventListener('error', () => finish(null, 0));
    setTimeout(() => finish(null, video.duration || 0), 4500);
    video.src = url;
  });
}

export function getPlaceholder(file) {
  if (isHeic(file)) return PLACEHOLDER_HEIC;
  if (isVideoFile(file)) return PLACEHOLDER_VIDEO;
  return PLACEHOLDER_GENERIC;
}

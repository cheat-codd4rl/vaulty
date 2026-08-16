/* File processing utilities — ported from prototype */

import { PLACEHOLDER_HEIC, PLACEHOLDER_VIDEO, PLACEHOLDER_GENERIC } from './helpers';

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
    img.onload = () => {
      const maxDim = 2200;
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('encode failed'));
            return;
          }
          const tW = 480,
            tH = Math.max(1, Math.round(h * (tW / w)));
          const tCanvas = document.createElement('canvas');
          tCanvas.width = tW;
          tCanvas.height = tH;
          tCanvas.getContext('2d').drawImage(canvas, 0, 0, tW, tH);
          resolve({ blob, thumbDataUrl: tCanvas.toDataURL('image/jpeg', 0.62), width: w, height: h });
        },
        'image/jpeg',
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
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
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        finish(c.toDataURL('image/jpeg', 0.6), video.duration);
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

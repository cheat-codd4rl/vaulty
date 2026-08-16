'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { getEvent, listUploads } from '@/lib/store';

export default function SlideshowPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);
  const idxRef = useRef(0);

  const refresh = useCallback(async () => {
    const uploads = await listUploads(id);
    const approved = uploads.filter((u) => u.status === 'approved' && u.thumbnail);
    setPhotos(approved);
  }, [id]);

  useEffect(() => {
    (async () => {
      const ev = await getEvent(id);
      setEvent(ev);
      await refresh();
      setLoaded(true);
    })();
  }, [id, refresh]);

  useEffect(() => {
    if (!loaded) return;

    const tick = async () => {
      await refresh();
      setCurrentIdx((prev) => {
        // We use a functional update to avoid stale closures
        return prev;
      });
    };

    // Advance slide every 5 seconds
    timerRef.current = setInterval(() => {
      setPhotos((currentPhotos) => {
        if (currentPhotos.length > 0) {
          setCurrentIdx((prev) => (prev + 1) % currentPhotos.length);
        }
        return currentPhotos;
      });
    }, 5000);

    // Refresh data every 10 seconds
    const dataTimer = setInterval(tick, 10000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(dataTimer);
    };
  }, [loaded, refresh]);

  if (!loaded)
    return (
      <div className="slideshow">
        <p className="empty-note">Loading…</p>
      </div>
    );

  if (!event)
    return (
      <div className="slideshow">
        <p className="empty-note">Event not found</p>
      </div>
    );

  const currentPhoto = photos[currentIdx % Math.max(1, photos.length)];

  return (
    <div className="slideshow">
      <div className="label">{event.name} · live</div>
      <button className="btn exit" onClick={() => router.push('/host/' + id)}>
        Exit
      </button>
      <div className="stage">
        {photos.length === 0 ? (
          <p className="empty-note">Waiting for the first photo…</p>
        ) : currentPhoto ? (
          <img className="show" src={currentPhoto.thumbnail} alt={currentPhoto.filename} />
        ) : null}
      </div>
    </div>
  );
}

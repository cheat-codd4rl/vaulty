'use client';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <p>
          Vaulty — your photos are processed locally and stored in your browser.
          Connect Firebase to enable permanent cloud storage and real-time sync.
        </p>
        <details>
          <summary>Architecture notes</summary>
          <ul>
            <li>EXIF/location stripping, thumbnailing, and zip downloads all run client-side.</li>
            <li>Connect a Firebase project to enable permanent storage, real-time live wall updates, and cross-device access.</li>
            <li>Resumable uploads (tus protocol) can be added for unreliable venue Wi-Fi.</li>
            <li>HEIC→JPEG conversion runs server-side once Firebase is connected.</li>
          </ul>
        </details>
      </div>
    </footer>
  );
}

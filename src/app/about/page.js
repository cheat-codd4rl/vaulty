'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useToast } from '@/components/Toast';

export default function LandingPage() {
  const router = useRouter();
  const showToast = useToast();

  const handleJoin = () => {
    const v = prompt('Paste the event link or code you were sent:');
    if (!v) return;
    // Try to extract event ID from a full URL
    const hashMatch = v.match(/#\/e\/([A-Za-z0-9_]+)/);
    if (hashMatch) {
      router.push('/e/' + hashMatch[1]);
      return;
    }
    // Try direct route match
    const routeMatch = v.match(/\/e\/([A-Za-z0-9_]+)/);
    if (routeMatch) {
      router.push('/e/' + routeMatch[1]);
      return;
    }
    // Try raw event ID
    const idGuess = v.trim();
    if (/^evt_/.test(idGuess)) {
      router.push('/e/' + idGuess);
      return;
    }
    showToast("Couldn't read that — check the link and try again");
  };

  return (
    <>
      <Navbar />
      <div className="wrap">
        <section className="hero">
          <div className="rail"></div>
          <div className="hero-eyebrow">Photo collection for live events</div>
          <h1>
            Every photo from the night,
            <br />
            <em>in one vault.</em>
          </h1>
          <p className="lede">
            Guests scan a code and upload straight from their camera roll — full resolution, no app,
            no account. You get one gallery instead of forty WhatsApp threads.
          </p>
          <div className="path-cards">
            <button className="path-card" onClick={() => router.push('/host')}>
              <span className="num">01</span>
              <h3>Host an event</h3>
              <p>Create a gallery, get a link and a printable QR code in under a minute.</p>
            </button>
            <button className="path-card" onClick={handleJoin}>
              <span className="num">02</span>
              <h3>I have an invite</h3>
              <p>Paste the link or code someone shared with you.</p>
            </button>
          </div>
          <div className="steps">
            <div className="step">
              <span className="n">Create</span>
              <h4>Name the event</h4>
              <p>Set access and whether photos need approval before they&apos;re visible.</p>
            </div>
            <div className="step">
              <span className="n">Share</span>
              <h4>Print or send the code</h4>
              <p>One QR code covers every guest — no signup on their end.</p>
            </div>
            <div className="step">
              <span className="n">Collect</span>
              <h4>Watch the gallery fill in</h4>
              <p>Download originals any time, individually or as one archive.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

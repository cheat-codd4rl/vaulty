'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/Toast';

export default function HostProfile() {
  const router = useRouter();
  const showToast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/host/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setHost(data);
          } else {
            router.push('/host-login');
          }
        } else {
          router.push('/host-login');
        }
      } catch (err) {
        router.push('/host-login');
      }
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/host/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        showToast('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update password');
      }
    } catch (err) {
      showToast('An error occurred');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <p style={{ color: 'var(--text-dim)' }}>Loading profile...</p>
        </div>
      </>
    );
  }

  if (!host) return null;

  return (
    <>
      <Navbar />
      <div className="wrap section">
        <div className="section-head">
          <button className="back" onClick={() => router.push('/host')} style={{ marginBottom: '16px', display: 'inline-block' }}>
            ← Back to Dashboard
          </button>
          <h2>Profile & Security</h2>
          <p>Manage your Host Profile settings.</p>
        </div>
        
        <div style={{ maxWidth: 520 }}>
          <div className="card">
            <h3>Account Details</h3>
            <div className="field">
              <label>Name</label>
              <input type="text" value={host.name} disabled readOnly />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="text" value={host.email} disabled readOnly />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Change Password</h3>
            <form onSubmit={handleChangePassword}>
              <div className="field">
                <label htmlFor="currentPassword">Current Password</label>
                <input 
                  type="password" 
                  id="currentPassword" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  required 
                />
              </div>
              <div className="field">
                <label htmlFor="newPassword">New Password</label>
                <input 
                  type="password" 
                  id="newPassword" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn btn-brass" disabled={saving}>
                {saving ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

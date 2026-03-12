'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, Phone } from 'lucide-react';
import { setAgentSession, getAgentSession } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAgentSession();
    if (session) router.replace('/armada');
  }, [router]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !phone.trim()) {
      setError('Semua kolom harus diisi');
      return;
    }
    // Validasi sederhana: no WA minimal 10 digit
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('No WhatsApp tidak valid (minimal 10 digit)');
      return;
    }
    setLoading(true);
    try {
      // Sync ke tabel agents
      await supabase.from('agents').upsert({
        phone: cleaned,
        name: name.trim(),
        location: location.trim(),
        last_login: new Date().toISOString()
      }, { onConflict: 'phone' });

      setAgentSession(name.trim(), location.trim(), cleaned);
      router.push('/armada');
    } catch (err) {
      console.error('Login sync error:', err);
      // Tetap lanjutkan login meskipun sync gagal
      setAgentSession(name.trim(), location.trim(), cleaned);
      router.push('/armada');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1A0505 0%, #8B1A1A 45%, #C0392B 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ width: 76, height: 76, background: 'rgba(255,255,255,0.15)', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Bus size={38} color="white" />
        </div>
        <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Tiket Bus</h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>Sistem Operasional Agen</p>
      </div>

      {/* Card */}
      <div style={{ background: 'white', borderRadius: 22, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#1A1A1A' }}>Masuk sebagai Agen</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Gunakan no WhatsApp Anda sebagai identitas</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Nama Agen / Toko
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="Contoh: Agen Gajah"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Lokasi Toko
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="Contoh: Demak, Jawa Tengah"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
              No WhatsApp (sebagai identitas)
            </label>
            <input
              className="input-field"
              type="tel"
              placeholder="Contoh: 08123456789"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>
              📌 No WA ini digunakan sebagai kode keamanan Anda
            </p>
          </div>

          {error && <p style={{ color: '#C62828', fontSize: 13 }}>⚠️ {error}</p>}

          <button className="btn-primary" type="submit" disabled={loading || !name || !location || !phone} style={{ marginTop: 4 }}>
            {loading ? 'Memproses...' : 'Masuk →'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}
          >
            🔒 Login sebagai Admin
          </button>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24 }}>v1.0 — PWA Operasional Bus</p>
    </div>
  );
}

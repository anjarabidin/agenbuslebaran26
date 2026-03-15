'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, Phone, User, MapPin } from 'lucide-react';
import { setAgentSession, getAgentSession } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAgentSession();
    if (session) router.replace('/armada');
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !phone.trim()) {
      setError('Semua kolom harus diisi');
      return;
    }

    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('No WhatsApp tidak valid (minimal 10 digit)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Cek apakah nomor HP sudah terdaftar
      const { data: existingAgent, error: fetchErr } = await supabase
        .from('agents')
        .select('*')
        .eq('phone', cleaned)
        .maybeSingle();

      let finalName = name.trim();
      let finalLocation = location.trim();

      if (existingAgent) {
        // Jika sudah ada, gunakan data LAMA dari database (agar nama & lokasi tidak berubah-ubah)
        finalName = existingAgent.name;
        finalLocation = existingAgent.location;
        
        // Update waktu login terakhir saja
        await supabase.from('agents').update({
          last_login: new Date().toISOString()
        }).eq('phone', cleaned);
      } else {
        // Jika belum ada, baru simpan data BARU
        await supabase.from('agents').insert({
          phone: cleaned,
          name: finalName,
          location: finalLocation,
          last_login: new Date().toISOString()
        });
      }

      setAgentSession(finalName, finalLocation, cleaned);
      router.push('/armada');
    } catch (err) {
      console.error('Login error:', err);
      setError('Gagal masuk. Silakan coba lagi.');
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
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Lengkapi info berikut untuk mulai mengelola tiket</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <User size={11} style={{ display: 'inline', marginRight: 4 }} />
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
              <MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />
              Lokasi Toko
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="Contoh: Demak"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
            <p style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>📍 Lokasi ini akan tampil sebagai titik asal di tiket rute Anda.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
              No WhatsApp
            </label>
            <input
              className="input-field"
              type="tel"
              placeholder="Contoh: 08123456789"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {error && <p style={{ color: '#C62828', fontSize: 13 }}>⚠️ {error}</p>}

          <button className="btn-primary" type="submit" disabled={loading || !name || !location || !phone} style={{ marginTop: 4 }}>
            {loading ? 'Memproses...' : 'Masuk ke Sistem →'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 16 }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}
          >
            🔒 Login sebagai Admin
          </button>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24 }}>v1.2 — PWA Operasional Bus</p>
    </div>
  );
}

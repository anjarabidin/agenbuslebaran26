'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, Phone, User, MapPin } from 'lucide-react';
import { setAgentSession, getAgentSession } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAgentSession();
    if (session) router.replace('/armada');
  }, [router]);

  async function handleCheckPhone(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('No WhatsApp tidak valid (minimal 10 digit)');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { data, error: fetchErr } = await supabase
        .from('agents')
        .select('name, location')
        .eq('phone', cleaned)
        .maybeSingle();

      if (data) {
        // Phone already registered, login immediately
        await supabase.from('agents').update({ last_login: new Date().toISOString() }).eq('phone', cleaned);
        setAgentSession(data.name, data.location, cleaned);
        router.push('/armada');
      } else {
        // Phone not found, proceed to step 2 for registration
        setStep(2);
        setLoading(false);
      }
    } catch (err) {
      console.error('Check phone error:', err);
      setError('Terjadi kesalahan jaringan.');
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setError('Nama dan Lokasi harus diisi');
      return;
    }

    const cleaned = phone.replace(/\D/g, '');
    setLoading(true);
    setError('');

    try {
      await supabase.from('agents').insert({
        phone: cleaned,
        name: name.trim(),
        location: location.trim(),
        last_login: new Date().toISOString()
      });

      setAgentSession(name.trim(), location.trim(), cleaned);
      router.push('/armada');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Gagal menyimpan pendaftaran.');
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
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#1A1A1A' }}>
          {step === 1 ? 'Masuk sebagai Agen' : 'Lengkapi Profil Agen'}
        </h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          {step === 1 ? 'Gunakan no WhatsApp Anda sebagai identitas' : 'Nomor HP belum terdaftar, mohon lengkapi info ini'}
        </p>

        {step === 1 ? (
          <form onSubmit={handleCheckPhone} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                No WhatsApp Terdaftar
              </label>
              <input
                className="input-field"
                type="tel"
                placeholder="Contoh: 08123456789"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoFocus
              />
            </div>

            {error && <p style={{ color: '#C62828', fontSize: 13 }}>⚠️ {error}</p>}

            <button className="btn-primary" type="submit" disabled={loading || !phone} style={{ marginTop: 4 }}>
              {loading ? 'Memeriksa...' : 'Lanjutkan →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                placeholder="Contoh: Demak, Jawa Tengah"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            {error && <p style={{ color: '#C62828', fontSize: 13 }}>⚠️ {error}</p>}

            <button className="btn-primary" type="submit" disabled={loading || !name || !location} style={{ marginTop: 4 }}>
              {loading ? 'Mendaftar...' : 'Daftar & Masuk →'}
            </button>
            <button type="button" onClick={() => { setStep(1); setError(''); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
              ← Kembali
            </button>
          </form>
        )}

        {step === 1 && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={() => router.push('/admin')}
              style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}
            >
              🔒 Login sebagai Admin
            </button>
          </div>
        )}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24 }}>v1.1 — PWA Operasional Bus</p>
    </div>
  );
}

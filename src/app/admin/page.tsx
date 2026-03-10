'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Bus } from 'lucide-react';

export default function AdminLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('admin_auth') === 'true') {
            router.replace('/admin/dashboard');
        }
    }, [router]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem('admin_auth', 'true');
                router.push('/admin/dashboard');
            } else {
                setError('Password salah');
            }
        } catch {
            setError('Gagal terhubung. Coba lagi.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #1A0505 0%, #8B1A1A 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <div style={{ width: 70, height: 70, background: 'rgba(255,255,255,0.15)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', backdropFilter: 'blur(10px)' }}>
                    <Lock size={34} color="white" />
                </div>
                <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800 }}>Admin Panel</h1>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 6 }}>Sistem Operasional Tiket Bus</p>
            </div>

            <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Masuk sebagai Admin</h2>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <input
                        className="input-field"
                        type="password"
                        placeholder="Password Admin"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoFocus
                        required
                    />
                    {error && <p style={{ color: '#C62828', fontSize: 13 }}>⚠️ {error}</p>}
                    <button className="btn-primary" type="submit" disabled={loading || !password}>
                        {loading ? 'Memverifikasi...' : 'Masuk'}
                    </button>
                </form>
                <button
                    onClick={() => router.push('/')}
                    style={{ marginTop: 16, width: '100%', background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}
                >
                    ← Kembali ke halaman agen
                </button>
            </div>
        </div>
    );
}

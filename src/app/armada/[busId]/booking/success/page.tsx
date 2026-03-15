'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, MessageCircle, ArrowLeft, Printer, Download, Share2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

import { QRCodeSVG } from 'qrcode.react';

export default function BookingSuccessPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Memuat tiket...</div>}>
            <SuccessPageContent />
        </Suspense>
    );
}

function SuccessPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Data dari booking page
    const bookingId = searchParams.get('bookingId') || '';
    const nomor = searchParams.get('nomor') || '';
    const tujuan = searchParams.get('tujuan') || '';
    const passenger = searchParams.get('passenger') || '';
    const phone = searchParams.get('phone') || '';
    const harga = parseInt(searchParams.get('harga') || '0');
    // Bus & route data (untuk WA message yang lengkap)
    const busKode = searchParams.get('busKode') || '';
    const busArah = searchParams.get('busArah') || '';
    const busNama = searchParams.get('busNama') || '';
    const jamBerangkat = searchParams.get('jamBerangkat') || '';
    const kotaAsal = searchParams.get('kotaAsal') || '';
    const kotaTujuan = searchParams.get('kotaTujuan') || '';
    const agentName = searchParams.get('agentName') || '';
    const agentLocation = searchParams.get('agentLocation') || '';

    function handleSendWA() {
        const cleaned = phone.replace(/\D/g, '').replace(/^0/, '62');
        const tgl = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });
        const hargaFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga);

        const message =
            `🎫 *TIKET BUS - OPERASIONAL*\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🚌 *Bus:* ${busKode} (${busArah})\n` +
            `📍 *Rute:* ${agentLocation} → ${tujuan}\n` +
            `📅 *Tgl:* ${tgl} | ${jamBerangkat}\n` +
            `💺 *Kursi:* No. ${nomor}\n` +
            `👤 *Penumpang:* ${passenger}\n` +
            `📞 *No HP:* ${phone}\n` +
            `📌 *Tujuan:* ${tujuan}\n` +
            `💰 *Harga:* ${hargaFormatted}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🏪 *Agen:* ${agentName}\n` +
            `📍 *Lokasi:* ${agentLocation}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `Terima kasih telah memesan! 🙏\n` +
            `_Mohon simpan tiket ini sebagai bukti pemesanan._`;

        const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }

    const [sharing, setSharing] = useState(false);

    async function handleShareImage() {
        const ticket = document.getElementById('print-area');
        if (!ticket) return;

        setSharing(true);
        try {
            const blob = await toBlob(ticket, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
            });

            if (blob && navigator.share) {
                const file = new File([blob], `tiket_${nomor}_${passenger}.png`, { type: 'image/png' });
                await navigator.share({
                    files: [file],
                    title: 'Tiket Bus Jadwal bus',
                    text: `Tiket Bus untuk ${passenger} (Kursi ${nomor})`
                });
            } else {
                // Fallback: Download image if share not supported
                const url = window.URL.createObjectURL(blob!);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tiket_${nomor}.png`;
                a.click();
            }
        } catch (err) {
            console.error('Error sharing ticket:', err);
            alert('Gagal membagikan tiket sebagai gambar.');
        } finally {
            setSharing(false);
        }
    }

    function handlePrint() {
        window.print();
    }

    if (!mounted) return null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 100px' }}>

            {/* Inject Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                }
            ` }} />

            {/* Success icon */}
            <div className="no-print" style={{ marginBottom: 24, textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, background: '#E8F5E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle2 size={48} color="#27AE60" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>Tiket Berhasil Dipesan!</h2>
                <p style={{ fontSize: 14, color: '#888', marginTop: 6 }}>Booking telah dikonfirmasi</p>
            </div>

            {/* Ticket card (Visible & Printable) */}
            <div id="print-area" style={{ background: 'white', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', marginBottom: 24, position: 'relative', overflow: 'hidden', border: '1px solid #eee' }}>
                {/* Decorative top strip */}
                <div className="no-print" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--maroon), #C0392B)' }} />

                {/* Header for print */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#8B1A1A', margin: 0 }}>E-TICKET BUS</h3>
                    <p style={{ fontSize: 10, color: '#888', margin: '4px 0 0' }}>ID: {bookingId}</p>
                </div>

                {/* Bus info */}
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed #e0e0e0' }}>
                    <p style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{busArah} / {busKode}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{busNama.replace(/^[^-]+/, agentLocation)}</p>
                    <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{agentLocation} → {tujuan}</p>
                </div>

                {/* Ticket details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div>
                        <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>No Kursi</p>
                        <p style={{ fontSize: 24, fontWeight: 800, color: '#8B1A1A' }}>{nomor}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Harga</p>
                        <p style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(harga)}</p>
                    </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Penumpang</p>
                        <p style={{ fontSize: 14, fontWeight: 600 }}>{passenger}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>No HP</p>
                        <p style={{ fontSize: 14, fontWeight: 600 }}>{phone}</p>
                    </div>
                </div>

                {/* QR Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', borderTop: '1px dashed #e0e0e0', borderBottom: '1px dashed #e0e0e0', marginBottom: 20 }}>
                    <QRCodeSVG value={bookingId} size={180} level="H" includeMargin />
                    <p style={{ fontSize: 10, color: '#AAA', marginTop: 10 }}>Scan QR untuk validasi tiket</p>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>AGEN: {agentName}</p>
                    <p style={{ fontSize: 10, color: '#888' }}>{agentLocation}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="no-print" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                    style={{ background: '#4527A0', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(69,39,160,0.3)' }}
                    onClick={handleShareImage}
                    disabled={sharing}
                >
                    <Share2 size={20} />
                    {sharing ? 'Menyiapkan...' : 'Bagikan Tiket (Gambar / File)'}
                </button>

                <button
                    style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.9 }}
                    onClick={handleSendWA}
                >
                    <MessageCircle size={20} />
                    Kirim via WhatsApp (Teks Only)
                </button>

                <button
                    style={{ background: '#1A1A1A', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={handlePrint}
                >
                    <Download size={20} />
                    Cetak / Simpan Tiket
                </button>

                <button
                    className="btn-secondary"
                    onClick={() => router.push('/armada')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                    <ArrowLeft size={16} />
                    Kembali ke Armada
                </button>
            </div>
        </div>
    );
}

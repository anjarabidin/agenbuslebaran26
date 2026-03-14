import { supabase } from './supabase';
import type { Bus, Route, RoutePrice, Seat, Booking } from '@/types';

// ==================== BUSES ====================
export async function getBuses(date: string, arah?: string) {
    let query = supabase
        .from('buses')
        .select('*, routes(*)')
        .eq('aktif', true)
        .order('jam_berangkat');

    if (arah && arah !== 'ALL') {
        query = query.eq('arah', arah);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Bus[];
}

export async function getBusById(id: string) {
    const { data, error } = await supabase
        .from('buses')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data as Bus;
}

// ==================== ROUTES ====================
export async function getRoutesByBus(busId: string, date: string) {
    const { data, error } = await supabase
        .from('routes')
        .select('*, route_prices(*)')
        .eq('bus_id', busId)
        .eq('tanggal_berangkat', date);
    if (error) throw error;
    return data as (Route & { route_prices: RoutePrice[] })[];
}

export async function getRoutePrices(routeId: string) {
    const { data, error } = await supabase
        .from('route_prices')
        .select('*')
        .eq('route_id', routeId)
        .order('tujuan');
    if (error) throw error;
    return data as RoutePrice[];
}

// ==================== SEATS ====================
export async function getSeats(busId: string, routeId: string) {
    const { data, error } = await supabase
        .from('seats')
        .select('*')
        .eq('bus_id', busId)
        .eq('route_id', routeId)
        .order('nomor_kursi');
    if (error) throw error;
    return data as Seat[];
}

export async function lockSeat(
    seatId: string,
    agentName: string
): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('lock_seat', {
        p_seat_id: seatId,
        p_agent_name: agentName,
    });
    if (error) return { success: false, message: error.message };
    return data as { success: boolean; message: string };
}

export async function releaseSeat(seatId: string) {
    const { error } = await supabase
        .from('seats')
        .update({ status: 'available', locked_by_agent: null, locked_at: null })
        .eq('id', seatId)
        .eq('status', 'locked');
    if (error) throw error;
}

// ==================== BOOKINGS ====================
export async function createBooking(payload: {
    seat_id: string;
    route_id: string;
    bus_id: string;
    nomor_kursi: number;
    agent_name: string;
    agent_location: string;
    agent_phone: string;  // No WA agen
    passenger_name: string;
    passenger_phone: string;
    tujuan: string;
    harga: number;
    catatan: string;
}): Promise<{ success: boolean; booking?: Booking; message: string }> {
    const { data, error } = await supabase.rpc('create_booking', {
        p_seat_id: payload.seat_id,
        p_route_id: payload.route_id,
        p_bus_id: payload.bus_id,
        p_nomor_kursi: payload.nomor_kursi,
        p_agent_name: payload.agent_name,
        p_agent_location: payload.agent_location,
        p_agent_phone: payload.agent_phone,
        p_passenger_name: payload.passenger_name,
        p_passenger_phone: payload.passenger_phone,
        p_tujuan: payload.tujuan,
        p_harga: payload.harga,
        p_catatan: payload.catatan,
    });
    if (error) return { success: false, message: error.message };
    
    // Konversi hasil dari RPC menjadi bentuk yang diharapkan TypeScript (booking.id)
    return {
        success: data.success,
        message: data.message,
        booking: data.booking_id ? { id: data.booking_id } : undefined
    } as any;
}

export async function getAllBookings(filters?: {
    busId?: string;
    date?: string;
    agentName?: string;
    status?: string;
}) {
    let query = supabase
        .from('bookings')
        .select('*, buses(kode, nama, arah), routes(kota_asal, kota_tujuan, via_stops)')
        .order('created_at', { ascending: false });

    if (filters?.busId) query = query.eq('bus_id', filters.busId);
    if (filters?.agentName) query = query.ilike('agent_name', `%${filters.agentName}%`);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.date) {
        const start = `${filters.date}T00:00:00`;
        const end = `${filters.date}T23:59:59`;
        query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as (Booking & { buses: Bus; routes: Route })[];
}

export async function cancelBooking(bookingId: string) {
    const { data, error } = await supabase.rpc('cancel_booking', {
        p_booking_id: bookingId,
    });
    if (error) throw error;
    return data;
}

export async function moveBooking(
    bookingId: string,
    newSeatId: string,
    agentPhone: string   // No WA agen untuk verifikasi identitas
): Promise<{ success: boolean; message: string; nomor_kursi_baru?: number }> {
    // Verifikasi dulu: apakah booking ini milik agen ini?
    const { data: booking } = await supabase
        .from('bookings')
        .select('agent_phone')
        .eq('id', bookingId)
        .single();
    if (!booking) return { success: false, message: 'Booking tidak ditemukan' };
    if (booking.agent_phone && booking.agent_phone !== agentPhone) {
        return { success: false, message: 'No WA Anda tidak sesuai. Hanya agen yang memesan bisa pindahkan kursi ini.' };
    }

    const { data, error } = await supabase.rpc('move_booking', {
        p_booking_id: bookingId,
        p_new_seat_id: newSeatId,
        p_agent_phone: agentPhone,
    });
    if (error) return { success: false, message: error.message };
    return data as { success: boolean; message: string; nomor_kursi_baru?: number };
}


// ==================== ADMIN CRUD ====================
export async function createBus(payload: Omit<Bus, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('buses').insert(payload).select().single();
    if (error) throw error;
    return data as Bus;
}

export async function updateBus(id: string, payload: Partial<Bus>) {
    const { data, error } = await supabase.from('buses').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Bus;
}

export async function deleteBus(id: string) {
    const { error } = await supabase.from('buses').delete().eq('id', id);
    if (error) throw error;
}

export async function createRoute(payload: Omit<Route, 'id'>) {
    const { data, error } = await supabase.from('routes').insert(payload).select().single();
    if (error) throw error;
    return data as Route;
}

export async function updateRoute(id: string, payload: Partial<Route>) {
    const { data, error } = await supabase.from('routes').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Route;
}

export async function deleteRoute(id: string) {
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) throw error;
}

export async function upsertRoutePrices(routeId: string, prices: { tujuan: string; harga: number }[]) {
    // Delete old prices, insert new ones
    await supabase.from('route_prices').delete().eq('route_id', routeId);
    const payload = prices.map((p) => ({ route_id: routeId, ...p }));
    const { error } = await supabase.from('route_prices').insert(payload);
    if (error) throw error;
}

// Initialize seats for a bus+route combo
export async function initSeats(busId: string, routeId: string, kapasitas: number) {
    const seats = Array.from({ length: kapasitas }, (_, i) => ({
        bus_id: busId,
        route_id: routeId,
        nomor_kursi: i + 1,
        status: 'available' as const,
        locked_by_agent: null,
        locked_at: null,
        booking_id: null,
    }));
    const { error } = await supabase.from('seats').upsert(seats, {
        onConflict: 'bus_id,route_id,nomor_kursi',
        ignoreDuplicates: true,
    });
    if (error) throw error;
}

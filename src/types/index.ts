export interface Bus {
    id: string;
    kode: string;
    nama: string;
    kapasitas: number;
    arah: 'TIMUR' | 'BARAT';
    jam_berangkat: string; // HH:mm
    tanggal: string; // YYYY-MM-DD
    aktif: boolean;
    created_at: string;
}

export interface Route {
    id: string;
    bus_id: string;
    kota_asal: string;
    kota_tujuan: string;
    via_stops: string[]; // array of city names
    tanggal_berangkat: string; // YYYY-MM-DD
    bus?: Bus;
}

export interface RoutePrice {
    id: string;
    route_id: string;
    tujuan: string;
    harga: number;
}

export interface Seat {
    id: string;
    bus_id: string;
    route_id: string;
    nomor_kursi: number;
    status: 'available' | 'locked' | 'booked';
    locked_by_agent: string | null;
    locked_at: string | null;
    booking_id: string | null;
}

export interface Booking {
    id: string;
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
    status: 'confirmed' | 'cancelled';
    created_at: string;
    route?: Route;
    bus?: Bus;
}

export interface AgentSession {
    name: string;
    location: string;
    phone: string;  // No WA agen sebagai identitas
}

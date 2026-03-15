import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function resetLockedSeats() {
    const { data, error } = await supabase
        .from('seats')
        .update({ status: 'available', locked_by_agent: null, locked_at: null })
        .eq('status', 'locked');
        
    if (error) {
        console.error('Error resetting seats:', error);
    } else {
        console.log('Successfully reset locked seats.');
    }
}

resetLockedSeats();

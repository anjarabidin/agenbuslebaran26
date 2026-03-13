import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkAgents() {
    const { data, error } = await supabase.from('agents').select('*');
    if (error) {
        console.error('Error fetching agents:', error);
    } else {
        console.log('Agents count:', data.length);
        console.log('Agents data:', data);
    }
}

checkAgents();

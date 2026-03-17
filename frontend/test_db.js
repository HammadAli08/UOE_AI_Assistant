import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: '4f877340-1e7c-4c13-b69d-93f490eef707',
      role: 'user',
      content: 'Hello',
      sources: [],
      enhanced_query: null,
      agentic_info: null,
      run_id: null,
    })
    .select();
  console.log(error || data);
}
test();

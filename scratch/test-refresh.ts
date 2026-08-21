
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { createClient } from '@supabase/supabase-js';
import { GmailProvider } from '../lib/email/gmail-provider';

async function test() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(url, key);
  
  console.log('URL:', url, 'Key len:', key.length);
  
  const provider = new GmailProvider('07e1fbbe-159f-4893-9cee-3308a10b1bd5', supabase);
  console.log('Testing refresh...');
  const authed = await provider.refreshAuthentication();
  console.log('Refresh result:', authed);
}
test().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});


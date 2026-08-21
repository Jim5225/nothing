
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { createClient } from '@supabase/supabase-js';
import { GmailProvider } from '../lib/email/gmail-provider';

async function test() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(url, key);
  
  const provider = new GmailProvider('07e1fbbe-159f-4893-9cee-3308a10b1bd5', supabase);
  console.log('Sending test email...');
  const res = await provider.sendEmail({
    to: 'jimjayedalafroz@gmail.com',
    subject: 'MIME Format Test ' + Date.now(),
    body: 'Hi Jim,\n\nThis is a **test email** to check if multipart/alternative works properly.\n\nBest,\nTest Script',
    fromName: 'Veltrix System'
  });
  console.log('Result:', res);
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });


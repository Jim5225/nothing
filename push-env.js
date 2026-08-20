const { execSync } = require('child_process');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const lines = envFile.split('\n');

for (const line of lines) {
  if (line.trim() && !line.startsWith('#') && line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim().replace(/^"|"$/g, '');
    
    // Vercel CLI needs the value piped via stdin to avoid interactive prompts
    try {
      console.log(`Setting ${key}...`);
      execSync(`npx vercel env add ${key} production`, {
        input: value,
        stdio: ['pipe', 'inherit', 'inherit']
      });
    } catch (e) {
      console.log(`Failed to set ${key}, might already exist.`);
    }
  }
}

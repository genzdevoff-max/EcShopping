import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

async function getFtpPassword() {
  const transcriptPath = 'C:/Users/syedm/.gemini/antigravity-cli/brain/555f9bc9-3237-44a3-beac-d00feaeae35e/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.includes('FTP password:')) {
      const match = line.match(/FTP password:\s*([^\s\r\n\\\"']+)/);
      if (match) {
        const raw = match[1];
        return raw.endsWith('.') ? raw.slice(0, -1) : raw;
      }
    }
  }
  return null;
}

function getFiles(dir, base = '') {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results = results.concat(getFiles(full, rel));
    } else {
      results.push({ full, rel, size: fs.statSync(full).size });
    }
  }
  return results;
}

async function uploadFile(pw, localFile, remoteRelPath) {
  return new Promise((resolve, reject) => {
    // Normalizing forward slashes for FTP URL
    const ftpUrl = `ftp://195.35.44.99:21/${remoteRelPath.replace(/\\/g, '/')}`;
    const args = [
      '--ssl-reqd',
      '--insecure',
      '--ftp-create-dirs',
      '--config', '-',
      '-T', localFile,
      ftpUrl
    ];

    const child = spawn('curl.exe', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`Failed to upload ${remoteRelPath}: exit code ${code}\n${stderr}`));
    });

    child.stdin.write(`user = "u525835209.ecshopping.in:${pw}"\n`);
    child.stdin.end();
  });
}

async function run() {
  const pw = await getFtpPassword();
  if (!pw) {
    console.error('ERROR: Could not retrieve FTP password.');
    process.exit(1);
  }

  const distDir = path.resolve('client/dist');
  if (!fs.existsSync(distDir)) {
    console.error('ERROR: client/dist directory does not exist.');
    process.exit(1);
  }

  const files = getFiles(distDir);
  console.log(`Starting FTPS upload of ${files.length} files to Hostinger public_html...`);

  let totalBytes = 0;
  for (const f of files) totalBytes += f.size;
  console.log(`Total payload size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  let uploadedBytes = 0;
  let count = 0;
  for (const file of files) {
    count++;
    process.stdout.write(`[${count}/${files.length}] Uploading ${file.rel} (${(file.size / 1024).toFixed(1)} KB)... `);
    const start = Date.now();
    await uploadFile(pw, file.full, file.rel);
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    uploadedBytes += file.size;
    console.log(`Done (${duration}s)`);
  }

  console.log('\n✅ All files successfully uploaded to Hostinger via FTPS!');
}

run().catch(err => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});

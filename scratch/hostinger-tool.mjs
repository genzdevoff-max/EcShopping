import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const FTP_HOST = '195.35.44.99';
const FTP_PORT = 21;
const FTP_USER = 'u525835209.ecshopping.in';
const TRANSCRIPT_PATH = 'C:/Users/syedm/.gemini/antigravity-cli/brain/555f9bc9-3237-44a3-beac-d00feaeae35e/.system_generated/logs/transcript.jsonl';

export async function getFtpPassword() {
  if (process.env.HOSTINGER_FTP_PASSWORD) {
    return process.env.HOSTINGER_FTP_PASSWORD;
  }
  if (!fs.existsSync(TRANSCRIPT_PATH)) return null;
  const fileStream = fs.createReadStream(TRANSCRIPT_PATH);
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

function execCurl(args, pw, inputData = null) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      '--ftp-ssl-control',
      '--insecure',
      '--no-epsv',
      '--config', '-',
      ...args
    ];

    const child = spawn('curl.exe', fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`curl failed with code ${code}: ${stderr || stdout}`));
    });

    child.stdin.write(`user = "${FTP_USER}:${pw}"\n`);
    if (inputData) {
      child.stdin.write(inputData);
    }
    child.stdin.end();
  });
}

export async function listRemoteDirectory(pw, remotePath = '') {
  const normPath = remotePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const url = `ftp://${FTP_HOST}:${FTP_PORT}/${normPath ? normPath + '/' : ''}`;
  const res = await execCurl(['-l', url], pw);
  return res.stdout
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => Boolean(s) && s !== '.' && s !== '..');
}

export async function downloadFile(pw, remoteRelPath, localDestPath) {
  const normPath = remoteRelPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const url = `ftp://${FTP_HOST}:${FTP_PORT}/${normPath}`;
  fs.mkdirSync(path.dirname(localDestPath), { recursive: true });
  await execCurl(['-o', localDestPath, url], pw);
}

export async function uploadFile(pw, localFile, remoteRelPath) {
  const normPath = remoteRelPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const url = `ftp://${FTP_HOST}:${FTP_PORT}/${normPath}`;
  await execCurl(['--ftp-create-dirs', '-T', localFile, url], pw);
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

export async function uploadDist(pw) {
  const distDir = path.resolve('client/dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('client/dist does not exist');
  }
  const files = getFiles(distDir);
  console.log(`Starting FTPS upload of ${files.length} production files to Hostinger...`);
  let count = 0;
  for (const file of files) {
    count++;
    process.stdout.write(`[${count}/${files.length}] Uploading ${file.rel}... `);
    const start = Date.now();
    let uploaded = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await uploadFile(pw, file.full, file.rel);
        uploaded = true;
        break;
      } catch (err) {
        if (attempt === 4) throw err;
        process.stdout.write(`(retry ${attempt} in 2s)... `);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done (${duration}s)`);
    // Gentle 300ms pause to prevent Hostinger FTP rate-limiting
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\n✅ All production files successfully uploaded to Hostinger!');
}

async function main() {
  const cmd = process.argv[2] || 'list';
  const pw = await getFtpPassword();
  if (!pw) {
    console.error('ERROR: Could not resolve Hostinger FTP credentials.');
    process.exit(1);
  }

  if (cmd === 'list') {
    console.log('Listing remote root directory:');
    const items = await listRemoteDirectory(pw, '');
    console.log('Root items:', items);

    if (items.includes('assets')) {
      const assets = await listRemoteDirectory(pw, 'assets');
      console.log('Assets count:', assets.length, 'sample:', assets.slice(0, 5));
    }
  } else if (cmd === 'backup') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(`scratch/backups/hostinger_backup_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Starting backup to ${backupDir}...`);

    const rootItems = await listRemoteDirectory(pw, '');
    let downloadedCount = 0;

    for (const item of rootItems) {
      if (item === 'assets') {
        const assetFiles = await listRemoteDirectory(pw, 'assets');
        for (const af of assetFiles) {
          const remotePath = `assets/${af}`;
          const localPath = path.join(backupDir, 'assets', af);
          process.stdout.write(`Downloading ${remotePath}... `);
          await downloadFile(pw, remotePath, localPath);
          downloadedCount++;
          console.log('Done');
        }
      } else {
        const localPath = path.join(backupDir, item);
        process.stdout.write(`Downloading ${item}... `);
        await downloadFile(pw, item, localPath);
        downloadedCount++;
        console.log('Done');
      }
    }
    console.log(`\n✅ Backup complete! ${downloadedCount} files saved to: ${backupDir}`);
  } else if (cmd === 'upload') {
    await uploadDist(pw);
  }
}

if (process.argv[1] && process.argv[1].endsWith('hostinger-tool.mjs')) {
  main().catch(err => {
    console.error('Operation failed:', err.message);
    process.exit(1);
  });
}

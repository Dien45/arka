// Arka command-exec backend (standalone Node.js, zero deps)
// Jalankan:  npm run server   (default port 3399)
// Dipakai oleh Arka Chat -> run_command  =>  POST /exec  { command: string }
// Cross-platform: Windows, Linux, macOS, Termux, proot (cukup punya Node.js).
//
// Env vars:
//   ARKA_EXEC_PORT      default 3399
//   ARKA_EXEC_TIMEOUT   default 15000 (ms)
//   ARKA_EXEC_MAX_OUT   default 200000 (bytes)
//   ARKA_EXEC_ALLOW     allowlist prefix dipisah koma; kosong = izinkan semua

import http from 'http';
import { exec } from 'child_process';

const PORT = parseInt(process.env.ARKA_EXEC_PORT || '3399', 10);
const TIMEOUT_MS = parseInt(process.env.ARKA_EXEC_TIMEOUT || '15000', 10);
const MAX_BYTES = parseInt(process.env.ARKA_EXEC_MAX_OUT || '200000', 10);

const ALLOWED = (process.env.ARKA_EXEC_ALLOW || '').split(',').map(s => s.trim()).filter(Boolean);

function isAllowed(cmd) {
  if (ALLOWED.length === 0) return true;
  return ALLOWED.some(prefix => cmd.trim().startsWith(prefix));
}

function send(res, status, obj) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, {});
  }
  if (req.method !== 'POST' || req.url !== '/exec') {
    return send(res, 404, { error: 'not found' });
  }
  if (!(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { error: 'content-type must be application/json' });
  }

  let body = '';
  req.on('data', c => {
    body += c.toString();
    if (body.length > MAX_BYTES) {
      send(res, 413, { error: 'request too large' });
      req.destroy();
    }
  });
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return send(res, 400, { error: 'invalid json' });
    }
    const command = payload && payload.command;
    if (typeof command !== 'string' || !command.trim()) {
      return send(res, 400, { error: 'command required' });
    }
    if (!isAllowed(command)) {
      return send(res, 403, { error: 'command not in allowlist' });
    }

    const child = exec(
      command,
      { cwd: process.cwd(), timeout: TIMEOUT_MS, maxBuffer: MAX_BYTES },
      (err, out, errOut) => {
        send(res, 200, {
          stdout: out ? out.toString() : '',
          stderr: errOut ? errOut.toString() : '',
          exitCode: err ? (err.code === undefined || typeof err.code !== 'number' ? 1 : err.code) : 0,
          timedOut: !!(err && err.killed),
        });
      }
    );
    child.on('error', e => {
      send(res, 500, { error: e.message });
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Arka exec server listening on http://localhost:${PORT}/exec`);
  console.log(`  ARKA_EXEC_ALLOW="${process.env.ARKA_EXEC_ALLOW || '(empty = allow all)'}"`);
  console.log(`  timeout=${TIMEOUT_MS}ms maxOut=${MAX_BYTES}B`);
});

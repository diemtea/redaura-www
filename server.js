import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let reqPath = decodeURIComponent(urlPath);

  // CORS preflight for API routes
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  // API Route: Pilot Signup
  if (req.method === 'POST' && reqPath === '/api/pilot-signup') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      try {
        let parsed;
        try {
          parsed = JSON.parse(body || '{}');
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
          return;
        }

        const { name, org, email } = parsed;

        if (!org || !org.trim() || !email || !email.includes('@')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Please provide a valid organization and work email.' }));
          return;
        }

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || apiKey === 'your_resend_api_key_here') {
          console.error('[Pilot Signup Error] RESEND_API_KEY is missing or unconfigured in .env');
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Server configuration issue: RESEND_API_KEY is not set in .env file.'
          }));
          return;
        }

        const resend = new Resend(apiKey);
        const toEmail = process.env.TO_EMAIL || 'hello@redaura.app';
        const fromEmail = process.env.FROM_EMAIL || 'Redaura Pilot <onboarding@resend.dev>';

        const emailResult = await resend.emails.send({
          from: fromEmail,
          to: [toEmail],
          subject: `New Pilot Access Request: ${org.trim()}${name && name.trim() ? ` (${name.trim()})` : ''}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 600px; padding: 20px;">
              <h2 style="color: #c93b2b; margin-top: 0;">New Pilot Access Request</h2>
              <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                ${name && name.trim() ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 120px;">Name:</td>
                  <td style="padding: 8px 0;">${escapeHtml(name.trim())}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 120px;">Organization:</td>
                  <td style="padding: 8px 0;">${escapeHtml(org.trim())}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Work Email:</td>
                  <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email.trim())}" style="color: #c93b2b;">${escapeHtml(email.trim())}</a></td>
                </tr>
              </table>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
              <p style="font-size: 13px; color: #666; margin: 0;">Sent automatically from Redaura website pilot signup form.</p>
            </div>
          `,
          text: `New Pilot Access Request\n\n${name && name.trim() ? `Name: ${name.trim()}\n` : ''}Organization: ${org.trim()}\nWork Email: ${email.trim()}`
        });

        if (emailResult.error) {
          console.error('[Pilot Signup Error] Resend returned error:', emailResult.error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: emailResult.error.message || 'Failed to send notification email.' }));
          return;
        }

        console.log(`[Pilot Signup Success] Email sent to ${toEmail} for org: "${org.trim()}" (${email.trim()})`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Pilot access request received.' }));
      } catch (err) {
        console.error('[Pilot Signup Error] Exception:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Server error processing signup request.' }));
      }
    });
    return;
  }

  // Redirect root / to /landing/ so relative paths in landing/index.html resolve correctly
  if (reqPath === '/') {
    res.statusCode = 302;
    res.setHeader('Location', '/landing/');
    res.end();
    console.log(`[302 Redirect] ${req.url} -> /landing/`);
    return;
  }

  let filePath = path.normalize(path.join(__dirname, reqPath));

  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('403 Forbidden');
    console.log(`[403 Forbidden] ${req.url} -> ${filePath}`);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      console.log(`[404 Not Found] ${req.url} -> ${filePath}`);
      return;
    }

    if (stats.isDirectory()) {
      if (!urlPath.endsWith('/')) {
        res.statusCode = 302;
        res.setHeader('Location', urlPath + '/');
        res.end();
        console.log(`[302 Redirect] ${req.url} -> ${urlPath}/`);
        return;
      }
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      console.log(`[404 Stream Error] ${req.url} -> ${filePath}`, streamErr);
    });
    stream.pipe(res);
    console.log(`[200 OK] ${req.url} (${contentType})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Redaura dev server running at http://localhost:${PORT}/ and http://127.0.0.1:${PORT}/`);
});

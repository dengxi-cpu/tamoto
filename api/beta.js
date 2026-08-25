const fs = require('fs');
const path = require('path');

let betaHtml = '';

function renderBetaHtml() {
  if (betaHtml) return betaHtml;
  const indexPath = path.join(process.cwd(), 'index.html');
  betaHtml = fs.readFileSync(indexPath, 'utf8').replace(
    '<link id="appManifest" rel="manifest" href="/manifest.webmanifest">',
    '<link id="appManifest" rel="manifest" href="/manifest-beta.webmanifest">'
  );
  return betaHtml;
}

function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(renderBetaHtml());
}

module.exports = { default: handler, handler };

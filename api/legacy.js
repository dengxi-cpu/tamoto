const handlers = {
  auth: require('../server/auth.js'),
  sync: require('../server/sync.js'),
  vision: require('../server/vision.js'),
  events: require('../server/events.js').handler,
};

async function handler(req, res) {
  const endpoint = String(req.query?.endpoint || '');
  const target = handlers[endpoint];
  if (!target) return res.status(404).json({ success: false, error: 'Unknown endpoint' });
  return target(req, res);
}

module.exports = { default: handler, handler };

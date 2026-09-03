const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ELEVENLABS_API_KEY = 'eleven-test-key';

const { handler } = require('../api/tts-stream');
const { getCompanionSystemPrompts } = require('../lib/companion-pipeline');

function responseMock() {
  return {
    headers: {}, chunks: [], headersSent: false, statusCode: 0,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    flushHeaders() { this.headersSent = true; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); return true; },
    end() { this.ended = true; return this; },
    once(_event, callback) { callback(); }
  };
}

test('ElevenLabs voices always call the eleven_v3 model and preserve audio tags', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url:String(url), body:JSON.parse(options.body) });
    return {
      ok:true,
      status:200,
      body:new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } })
    };
  };
  try {
    const req = {
      method:'POST',
      body:{
        text:'[sighs] ...Again?', voiceProvider:'elevenlabs', voiceId:'3b4ekg3VkQNcDNdIvGEo',
        speechLanguage:'en', epoch:1, turnId:1, speechType:'visual', performance:{ intensity:0.4, pace:'slow' }
      }
    };
    const res = responseMock();
    await handler(req, res);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.model_id, 'eleven_v3');
    assert.equal(requests[0].body.text, '[sighs] ...Again?');
    assert.equal(requests[0].body.language_code, 'en');
    assert.equal(Buffer.concat(res.chunks).length, 3);
    assert.equal(res.ended, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Actor prompt is written for short v3 spoken performance without fixed stages', () => {
  const actor = getCompanionSystemPrompts().actor;
  assert.match(actor, /Do not write dialogue\. React\./);
  assert.match(actor, /\[sighs\]/);
  assert.match(actor, /话痨.*不等于每次开口都很长/);
  assert.match(actor, /不是固定阶段或状态机/);
  assert.match(actor, /一个情绪准确的五词反应/);
});

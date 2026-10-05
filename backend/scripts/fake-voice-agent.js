#!/usr/bin/env node
/**
 * DEV ONLY. A stand-in for Ringio's voice agent service (mock-external-service), to test the
 * Ordely side without a phone, a call server or a Gemini key.
 *
 * It speaks the same contract as Ringio: Ordely's dispatcher POSTs a task to
 * /api/task/start; the "call" is then played back to Ordely's callbacks
 * (/internal/voice/events, /transcript, /recordings, /result) like the real agent would.
 *
 *   node scripts/fake-voice-agent.js                   # every call: the customer confirms
 *   FAKE_SCENARIO=no node scripts/fake-voice-agent.js  # yes | no | unclear | no_answer | random
 *
 * Settings use Ringio's names, read from the environment or ../.env (same values as Ordely):
 *   AGENT_SERVICE_TOKEN    = Ordely's VOICE_AGENT_TOKEN
 *   ORDELY_CALLBACK_SECRET = Ordely's VOICE_CALLBACK_SECRET
 *   ORDELY_CALLBACK_URL    = Ordely's API (default http://localhost:3001/api)
 *   PORT                   = 4200, like Ringio
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Fill missing settings from the project's root .env (Ordely's names).
const rootEnv = path.join(__dirname, '..', '..', '.env');
const fromFile = {};
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) fromFile[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const setting = (name, fallbackName, fallback) =>
  process.env[name] || fromFile[name] || fromFile[fallbackName] || fallback;

const PORT = Number(process.env.PORT || 4200);
const TOKEN = setting('AGENT_SERVICE_TOKEN', 'VOICE_AGENT_TOKEN', '');
const SECRET = setting('ORDELY_CALLBACK_SECRET', 'VOICE_CALLBACK_SECRET', '');
const CALLBACK_URL = (process.env.ORDELY_CALLBACK_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const SCENARIO = process.env.FAKE_SCENARIO || 'yes';
const SPEED = Number(process.env.FAKE_SPEED || 1);

if (!TOKEN || !SECRET) {
  console.error('Set VOICE_AGENT_TOKEN and VOICE_CALLBACK_SECRET in the root .env (see .env.example).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));
let busy = false;

async function callback(route, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${CALLBACK_URL}/internal/voice/${route}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET}`,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${route} → ${res.status} ${text}`);
  return text;
}

/** One second of silence as a real WAV (16-bit mono PCM). */
function silentWav(sampleRate = 16000) {
  const data = Buffer.alloc(sampleRate * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function script(task, scenario) {
  const name = String(task.order?.customerName ?? '').split(' ')[0] || 'Madame, Monsieur';
  const items = (task.order?.items ?? []).map((i) => `${i.quantity} × ${i.name}`).join(', ') || 'votre commande';
  const total = task.order?.total ?? '?';
  const shop = task.shop?.name ?? 'la boutique';
  const greet = `عسلامة ${name}، معاك المساعدة متاع ${shop}. نحبّو نأكدو الكوموند متاعك: ${items}، المجموع ${total} دينار. تأكدها؟`;
  switch (scenario) {
    case 'yes':
      return { lines: [['agent', greet], ['customer', 'إيه، نكونفيرمي.'], ['agent', 'يعيشك، الكوموند متاعك مأكدة. نهارك زين!']], intent: 'CONFIRMED', confidence: 0.96, language: 'TUNISIAN_ARABIC' };
    case 'no':
      return { lines: [['agent', greet], ['customer', 'لا، ما عادش نحب عليها، annulez svp.'], ['agent', 'باهي، الكوموند تلغات. يعيشك.']], intent: 'CANCELLED', confidence: 0.93, language: 'MIXED' };
    case 'unclear':
      return { lines: [['agent', greet], ['customer', 'Euh… شكون معايا؟ rappelez-moi plus tard.'], ['agent', 'باهي، نعاودو نكلموك. يعيشك.']], intent: 'UNCLEAR', confidence: 0.35, language: 'MIXED' };
    default:
      return null;
  }
}

async function playCall(task) {
  const taskId = task.taskId;
  const providerCallId = `fake-${Date.now()}`;
  const scenario =
    SCENARIO === 'random' ? ['yes', 'yes', 'no', 'unclear', 'no_answer'][Math.floor(Math.random() * 5)] : SCENARIO;
  console.log(`▶ ${taskId}: order ${task.order?.id} → ${task.destination} (scenario: ${scenario})`);
  try {
    await callback('events', { taskId, phase: 'ringing', providerCallId });
    await sleep(1500);
    const s = script(task, scenario);
    if (!s) {
      await callback('events', { taskId, phase: 'rejected', providerCallId });
      console.log(`  ${await callback('result', { taskId, providerCallId, disposition: 'no_answer', durationSeconds: 0 })}`);
      return;
    }
    await callback('events', { taskId, phase: 'live', providerCallId });
    let sequence = 0;
    const started = Date.now();
    for (const [speaker, text] of s.lines) {
      // Speech recognition streams words: send each line in a few fragments.
      for (const word of text.split(/(?<= )/)) {
        await callback('transcript', { taskId, sequence: ++sequence, speaker, text: word, timestamp: new Date().toISOString() });
      }
      await sleep(1200);
    }
    for (const speaker of ['customer', 'agent']) {
      const form = new FormData();
      form.append('taskId', taskId);
      form.append('speaker', speaker);
      form.append('durationMs', '1000');
      form.append('file', new Blob([silentWav()], { type: 'audio/wav' }), `${speaker}.wav`);
      await callback('recordings', form);
    }
    const result = await callback('result', {
      taskId,
      providerCallId,
      disposition: 'completed',
      intent: s.intent,
      confidence: s.confidence,
      language: s.language,
      durationSeconds: Math.max(1, Math.round((Date.now() - started) / 1000) * SPEED),
    });
    console.log(`  Ordely answered: ${result}`);
  } catch (err) {
    console.error(`  ✖ ${err.message}`);
  } finally {
    busy = false;
  }
}

http
  .createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/api/health') return send(200, { status: 'ok', fake: true });
    if (req.method !== 'POST' || req.url !== '/api/task/start') return send(404, { error: 'Not found' });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'Unauthorized.' });
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let task;
      try {
        task = JSON.parse(raw);
      } catch {
        return send(400, { error: 'Invalid JSON.' });
      }
      if (!task?.taskId || !task?.destination) return send(400, { error: 'taskId and destination are required.' });
      // Like Ringio: one call at a time.
      if (busy) return send(409, { error: 'An agent call is already running.' });
      busy = true;
      send(202, { phase: 'starting', taskId: task.taskId });
      void playCall(task);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Fake voice agent on http://127.0.0.1:${PORT} (scenario: ${SCENARIO}), reporting to ${CALLBACK_URL}`);
  });

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanMorphoDebt } from '../src/services/liveScan.js';
import { reviewedTop1Demo } from '../src/services/publicDemo.js';
import { top1Quote } from '../src/services/seed.js';
import type { PublicEvent, PublicScanResponse } from '../src/services/publicTypes.js';

const port = Number(process.env.DEBT_SAVER_PORT ?? 4174);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const localEvents = new Set<string>();

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4_096) throw new Error('Request too large.');
  }
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function record(event: PublicEvent, scope: 'live' | 'demo', sessionId: unknown) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{16,64}$/i.test(sessionId)) return;
  localEvents.add(`${scope}:${event}:${sessionId}`);
}

async function api(req: IncomingMessage, res: ServerResponse, path: string) {
  if (req.method === 'GET' && path === '/api/health') {
    return json(res, 200, {
      status: 'ok',
      mode: 'public-read-only-test',
      writes: false,
      walletConnection: false,
      calldata: false,
      signing: false,
      broadcast: false,
      mainnetDeployment: false,
      gasSpend: false,
      analytics: 'local-memory-only',
      quoteSource: 'unavailable-fail-closed',
    });
  }
  if (req.method === 'POST' && path === '/api/event') {
    const input = await body(req);
    record(String(input.event) as PublicEvent, input.scope === 'demo' ? 'demo' : 'live', input.sessionId);
    return json(res, 202, { accepted: true, mode: 'local-memory-only' });
  }
  if (req.method === 'POST' && path === '/api/evaluate') {
    const input = await body(req);
    const scope = input.demo === 'top1' ? 'demo' : 'live';
    record('ADDRESS_SUBMITTED', scope, input.sessionId);
    if (scope === 'demo') {
      record('DEBT_FOUND', 'demo', input.sessionId);
      record('QUOTE_READY', 'demo', input.sessionId);
      return json(res, 200, reviewedTop1Demo());
    }
    if (typeof input.wallet !== 'string') return json(res, 400, { error: 'wallet is required' });
    const positions = await scanMorphoDebt(input.wallet);
    if (positions.length) record('DEBT_FOUND', 'live', input.sessionId);
    const response: PublicScanResponse = positions.length ? {
      mode: 'live-read-only',
      status: 'DEBT_FOUND_NO_QUOTE',
      scannedAt: new Date().toISOString(),
      indexedBlock: null,
      positions,
      quote: null,
      simulation: null,
      explanation: 'Active Morpho Blue debt was found from the live public index.',
      limitation: 'The reviewed public Aave comparison source is not configured. Debt Saver failed closed and did not create QUOTE_READY, savings claims, simulation, review calldata, or any transaction data.',
      quoteReady: false,
      broadcastable: false,
    } : {
      mode: 'live-read-only',
      status: 'NO_DEBT_FOUND',
      scannedAt: new Date().toISOString(),
      indexedBlock: null,
      positions: [],
      quote: null,
      simulation: null,
      explanation: 'No active Ethereum Morpho Blue borrow position was returned by the public index. Other protocols and chains are outside this test.',
      limitation: 'No supported debt means no quote.',
      quoteReady: false,
      broadcastable: false,
    };
    return json(res, 200, response);
  }
  if (req.method === 'POST' && path === '/api/review') {
    const input = await body(req);
    if (input.quoteId !== top1Quote.id) return json(res, 400, { error: 'Only the reviewed snapshot has a preview.' });
    record('REVIEW_REQUESTED', 'demo', input.sessionId);
    return json(res, 200, {
      mode: 'read-only-preview',
      broadcastable: false,
      calldata: null,
      signerRequest: null,
      transaction: null,
    });
  }
  if (req.method === 'GET' && path === '/api/funnel') {
    const funnel = { live: {} as Record<string, number>, demo: {} as Record<string, number> };
    for (const key of localEvents) {
      const [scope, event] = key.split(':');
      const target = scope === 'demo' ? funnel.demo : funnel.live;
      target[event] = (target[event] ?? 0) + 1;
    }
    return json(res, 200, { generatedAt: new Date().toISOString(), mode: 'local-memory-only', funnel });
  }
  return json(res, 404, { error: 'Not found' });
}

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

async function staticFile(res: ServerResponse, path: string) {
  const requested = path === '/' ? 'index.html' : path.replace(/^\//, '');
  const candidate = resolve(dist, requested);
  if (!candidate.startsWith(dist)) return json(res, 403, { error: 'Forbidden' });
  let file = candidate;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
    else if (!info.isFile()) file = join(dist, 'index.html');
  } catch {
    file = join(dist, 'index.html');
  }
  const content = await readFile(file);
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(content);
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
  try {
    if (path.startsWith('/api/')) await api(req, res, path);
    else await staticFile(res, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    json(res, /valid EVM/.test(message) ? 400 : 503, { error: message, failClosed: true, quoteCreated: false });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Debt Saver public-test preview: http://127.0.0.1:${port}`);
});

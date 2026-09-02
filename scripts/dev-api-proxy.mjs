/**
 * Dev-only CORS proxy in front of the hosted API.
 *
 * ## Why this exists
 *
 * The hosted backend answers with no `Access-Control-Allow-Origin` header: its
 * `Cors:AllowedOrigins` list is empty in the Production profile, and an empty list fails
 * closed. Native builds are unaffected — they send no `Origin` header, so CORS never applies
 * to them — but `expo start --web` runs on `http://localhost:8081`, and the browser refuses
 * every request to a host that will not name that origin.
 *
 * Rather than open the live server up, this puts a proxy on the developer's own machine:
 * the web bundle points `EXPO_PUBLIC_API_BASE_URL` at `http://localhost:8787`, this process
 * forwards each request upstream over TLS and attaches the CORS headers to the reply. The
 * upstream never learns the difference (the browser-only `Origin`/`Referer` headers are
 * stripped), and nothing about the deployment changes.
 *
 * Delete this the day the server lists the dev origin — it is scaffolding, not architecture.
 *
 * ## What it forwards
 *
 * Every method, header and body verbatim, plus WebSocket upgrades: the app opens SignalR
 * connections to /hubs/notifications, /hubs/chat and /hubs/location, and a proxy that handled
 * only plain requests would leave live chat and tracking silently dead.
 *
 * Usage:  npm run dev:proxy          (PROXY_PORT / PROXY_TARGET override the defaults)
 */
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const TARGET = new URL(process.env.PROXY_TARGET ?? 'https://169.58.199.63.sslip.io');
const PORT = Number(process.env.PROXY_PORT ?? 8787);

/** Headers the upstream must not see: they only mean something to a browser. */
const STRIP_FROM_REQUEST = ['origin', 'referer'];

/**
 * The upstream sends no CORS headers today, but if it ever starts, forwarding its copy
 * alongside ours would produce two `Access-Control-Allow-Origin` values — which browsers
 * reject outright, exactly like having none. Ours wins; drop anything it sends.
 */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    Vary: 'Origin',
  };
}

function upstreamOptions(req) {
  const headers = { ...req.headers, host: TARGET.host };
  for (const name of STRIP_FROM_REQUEST) delete headers[name];
  return {
    protocol: TARGET.protocol,
    hostname: TARGET.hostname,
    port: TARGET.port || (TARGET.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: req.url,
    headers,
  };
}

const agent = new https.Agent({ keepAlive: true });

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;

  // Answer the preflight here. Forwarding it would only earn a 204 with no CORS headers,
  // which is precisely the failure this proxy exists to remove.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...corsHeaders(origin),
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? '*',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  const proxyReq = https.request({ ...upstreamOptions(req), agent }, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase().startsWith('access-control-')) delete headers[name];
    }
    console.log(`${req.method} ${req.url} -> ${proxyRes.statusCode}`);
    res.writeHead(proxyRes.statusCode ?? 502, { ...headers, ...corsHeaders(origin) });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error(`${req.method} ${req.url} -> proxy error: ${error.message}`);
    if (!res.headersSent)
      res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(
      JSON.stringify({ error: `Dev proxy could not reach ${TARGET.origin}: ${error.message}` })
    );
  });

  req.pipe(proxyReq);
});

// SignalR: hand the upgrade through and then get out of the way, byte for byte.
server.on('upgrade', (req, clientSocket, head) => {
  const proxyReq = https.request(upstreamOptions(req));

  proxyReq.on('upgrade', (proxyRes, upstreamSocket, upstreamHead) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`;
    const headerLines = Object.entries(proxyRes.headers)
      .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`)
      .join('');
    clientSocket.write(`${statusLine}${headerLines}\r\n`);
    if (upstreamHead?.length) clientSocket.write(upstreamHead);
    if (head?.length) upstreamSocket.write(head);
    console.log(`WS ${req.url} -> ${proxyRes.statusCode}`);
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
    upstreamSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstreamSocket.destroy());
  });

  proxyReq.on('response', (proxyRes) => {
    // Upstream declined the upgrade (a 401 from an unauthenticated negotiate, typically).
    clientSocket.end(`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n\r\n`);
  });
  proxyReq.on('error', () => clientSocket.destroy());
  proxyReq.end();
});

server.listen(PORT, () => {
  console.log(`Dev API proxy: http://localhost:${PORT} -> ${TARGET.origin}`);
  console.log('Point EXPO_PUBLIC_API_BASE_URL at the localhost address for web dev.');
});

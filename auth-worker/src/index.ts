interface Env {
  AUTH_FLOW: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_CONFIG: string;
  APP_SCOPES: string;
  /** Native apps: app ID -> exact custom-scheme redirect URIs, e.g. {"juice": ["juice://oauth"]}. */
  APP_REDIRECTS?: string;
}

interface FlowRecord {
  app: string;
  origin: string;
  /** Set for native apps, which receive the grant by redirect instead of postMessage. */
  redirect?: string;
  /** PKCE S256 challenge; native grants can only be redeemed with the matching verifier. */
  challenge?: string;
}

interface GrantRecord extends FlowRecord {
  token: string;
  login: string;
}

const COMPLETE_MESSAGE = 'gist-oauth:complete';

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function appOrigins(env: Env, app: string): string[] {
  try {
    const config = JSON.parse(env.APP_CONFIG) as Record<string, unknown>;
    const origins = config[app];
    return Array.isArray(origins) && origins.every((origin) => typeof origin === 'string')
      ? origins
      : [];
  } catch {
    return [];
  }
}

function appScopes(env: Env, app: string): string[] {
  try {
    const config = JSON.parse(env.APP_SCOPES) as Record<string, unknown>;
    const scopes = config[app];
    return Array.isArray(scopes) && scopes.every((scope) => typeof scope === 'string')
      ? scopes
      : ['gist'];
  } catch {
    return ['gist'];
  }
}

function allowedRedirect(env: Env, app: string, redirect: string): boolean {
  try {
    const config = JSON.parse(env.APP_REDIRECTS ?? '{}') as Record<string, unknown>;
    const redirects = config[app];
    // Only custom schemes: web apps use the origin/postMessage flow.
    return Array.isArray(redirects)
      && redirects.includes(redirect)
      && !/^https?:/i.test(redirect);
  } catch {
    return false;
  }
}

function base64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkceMatches(verifier: string, challenge: string): Promise<boolean> {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))) === challenge;
}

function nativeRedirect(redirect: string, params: Record<string, string>): Response {
  const target = new URL(redirect);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

function allowedOrigin(env: Env, app: string, origin: string): boolean {
  try {
    return new URL(origin).origin === origin && appOrigins(env, app).includes(origin);
  } catch {
    return false;
  }
}

function knownOrigin(env: Env, origin: string): boolean {
  try {
    const config = JSON.parse(env.APP_CONFIG) as Record<string, unknown>;
    return Object.keys(config).some((app) => allowedOrigin(env, app, origin));
  } catch {
    return false;
  }
}

function cors(env: Env, origin: string): HeadersInit {
  return knownOrigin(env, origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}

function callbackPage(origin: string, message: { code?: string; error?: string }): Response {
  const target = JSON.stringify(origin).replaceAll('<', '\\u003c');
  const payload = JSON.stringify({ type: COMPLETE_MESSAGE, ...message }).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<meta charset="utf-8">
<title>GitHub sign-in</title>
<p id="status">Finishing GitHub sign-in…</p>
<script>
  if (window.opener) window.opener.postMessage(${payload}, ${target});
  document.getElementById('status').textContent = ${message.error ? JSON.stringify(message.error) : JSON.stringify('GitHub connected. You can close this window.')};
  // Opener closes this window after receiving message.
</script>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function start(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const app = url.searchParams.get('app') ?? '';
  const origin = url.searchParams.get('origin') ?? '';
  const redirect = url.searchParams.get('redirect_uri') ?? '';
  let flow: FlowRecord;

  if (redirect) {
    // Native app flow: requires an allowlisted custom-scheme redirect and a PKCE challenge.
    const challenge = url.searchParams.get('code_challenge') ?? '';
    if (!allowedRedirect(env, app, redirect)) return new Response('Unknown app or redirect', { status: 400 });
    if (url.searchParams.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      return new Response('PKCE S256 code_challenge required', { status: 400 });
    }
    flow = { app, origin: '', redirect, challenge };
  } else {
    if (!allowedOrigin(env, app, origin)) return new Response('Unknown app or origin', { status: 400 });
    flow = { app, origin };
  }

  const state = crypto.randomUUID() + crypto.randomUUID();
  await env.AUTH_FLOW.put(`state:${state}`, JSON.stringify(flow satisfies FlowRecord), {
    expirationTtl: 600,
  });

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/auth/github/callback`);
  authorize.searchParams.set('scope', appScopes(env, app).join(' '));
  authorize.searchParams.set('state', state);
  return Response.redirect(authorize.toString(), 302);
}

async function callback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const stateKey = `state:${state}`;
  const flow = await env.AUTH_FLOW.get<FlowRecord>(stateKey, 'json');
  const flowAllowed = flow && (flow.redirect
    ? allowedRedirect(env, flow.app, flow.redirect)
    : allowedOrigin(env, flow.app, flow.origin));
  if (!flow || !flowAllowed) {
    return new Response('Invalid or expired OAuth state', { status: 400 });
  }
  await env.AUTH_FLOW.delete(stateKey);

  const finish = (message: { code?: string; error?: string }) => flow.redirect
    ? nativeRedirect(flow.redirect, message.code ? { code: message.code } : { error: message.error ?? 'Sign-in failed' })
    : callbackPage(flow.origin, message);

  const denied = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (denied || !code) return finish({ error: 'GitHub authorization was cancelled' });

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/auth/github/callback`,
    }),
  });
  const tokenResult = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenResult.access_token) {
    return finish({ error: tokenResult.error_description ?? 'GitHub token exchange failed' });
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenResult.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gist-oauth-broker',
    },
  });
  const user = await userResponse.json() as { login?: string };
  if (!userResponse.ok || !user.login) {
    return finish({ error: 'Could not load GitHub account' });
  }

  const grant = crypto.randomUUID() + crypto.randomUUID();
  await env.AUTH_FLOW.put(`grant:${grant}`, JSON.stringify({
    ...flow,
    token: tokenResult.access_token,
    login: user.login,
  } satisfies GrantRecord), { expirationTtl: 60 });

  return finish({ code: grant });
}

async function redeem(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  let code = '';
  let verifier = '';
  try {
    const body = await request.json() as { code?: unknown; code_verifier?: unknown };
    if (typeof body.code === 'string') code = body.code;
    if (typeof body.code_verifier === 'string') verifier = body.code_verifier;
  } catch {
    return json({ error: 'Invalid request' }, 400, cors(env, origin));
  }

  const key = `grant:${code}`;
  const grant = await env.AUTH_FLOW.get<GrantRecord>(key, 'json');
  if (grant?.redirect) {
    // Native grant: no browser origin; the PKCE verifier proves this is the app that started sign-in.
    if (!grant.challenge || !allowedRedirect(env, grant.app, grant.redirect) || !(await pkceMatches(verifier, grant.challenge))) {
      return json({ error: 'Invalid or expired sign-in code' }, 400);
    }
    await env.AUTH_FLOW.delete(key);
    return json({ token: grant.token, login: grant.login }, 200, { 'Cache-Control': 'no-store' });
  }
  if (!grant || origin !== grant.origin || !allowedOrigin(env, grant.app, origin)) {
    return json({ error: 'Invalid or expired sign-in code' }, 400, cors(env, origin));
  }
  await env.AUTH_FLOW.delete(key);

  return json(
    { token: grant.token, login: grant.login },
    200,
    { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Cache-Control': 'no-store' },
  );
}

const MAX_ICS_BYTES = 5 * 1024 * 1024;

function looksLikeICalendar(body: ArrayBuffer): boolean {
  const head = new TextDecoder().decode(body.slice(0, 64)).replace(/^\uFEFF/, '').trimStart();
  return /^BEGIN:VCALENDAR/i.test(head);
}

/**
 * Fetches a public/secret-link .ics calendar for an allowed app origin. Many
 * calendar hosts (Google, iCloud, Outlook) don't send CORS headers, so the
 * static app can't read the feed directly from the browser.
 */
async function icsProxy(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  if (!knownOrigin(env, origin)) return new Response('Forbidden', { status: 403 });
  const headers = { ...cors(env, origin), 'Cache-Control': 'no-store' };

  const raw = new URL(request.url).searchParams.get('url') ?? '';
  let target: URL;
  try {
    target = new URL(raw.replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    return new Response('Invalid calendar URL.', { status: 400, headers });
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return new Response('Calendar URL must use http or https.', { status: 400, headers });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { Accept: 'text/calendar, */*;q=0.5', 'User-Agent': 'Juice calendar fetch' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return new Response("Couldn't reach the calendar server.", { status: 502, headers });
  }
  if (!upstream.ok) {
    return new Response(`The calendar server responded with ${upstream.status}.`, { status: 502, headers });
  }
  const declared = Number(upstream.headers.get('Content-Length') ?? 0);
  if (declared > MAX_ICS_BYTES) return new Response('Calendar is too large.', { status: 413, headers });
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_ICS_BYTES) return new Response('Calendar is too large.', { status: 413, headers });
  // Only relay real iCalendar data so the Origin check (which non-browser
  // clients can fake) isn't all that stops this being a general fetch proxy.
  if (!looksLikeICalendar(body)) {
    return new Response("That URL didn't return a calendar (.ics) feed.", { status: 415, headers });
  }

  return new Response(body, {
    headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname === '/auth/redeem') {
      const origin = request.headers.get('Origin') ?? '';
      if (!knownOrigin(env, origin)) return new Response(null, { status: 403 });
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      } });
    }
    if (request.method === 'GET' && url.pathname === '/auth/github/start') return start(request, env);
    if (request.method === 'GET' && url.pathname === '/auth/github/callback') return callback(request, env);
    if (request.method === 'POST' && url.pathname === '/auth/redeem') return redeem(request, env);
    if (request.method === 'GET' && url.pathname === '/ics') return icsProxy(request, env);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

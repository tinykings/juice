interface Env {
  AUTH_FLOW: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_CONFIG: string;
  APP_SCOPES: string;
}

interface FlowRecord {
  app: string;
  origin: string;
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
  if (!allowedOrigin(env, app, origin)) return new Response('Unknown app or origin', { status: 400 });

  const state = crypto.randomUUID() + crypto.randomUUID();
  await env.AUTH_FLOW.put(`state:${state}`, JSON.stringify({ app, origin } satisfies FlowRecord), {
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
  if (!flow || !allowedOrigin(env, flow.app, flow.origin)) {
    return new Response('Invalid or expired OAuth state', { status: 400 });
  }
  await env.AUTH_FLOW.delete(stateKey);

  const denied = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (denied || !code) return callbackPage(flow.origin, { error: 'GitHub authorization was cancelled' });

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
    return callbackPage(flow.origin, { error: tokenResult.error_description ?? 'GitHub token exchange failed' });
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
    return callbackPage(flow.origin, { error: 'Could not load GitHub account' });
  }

  const grant = crypto.randomUUID() + crypto.randomUUID();
  await env.AUTH_FLOW.put(`grant:${grant}`, JSON.stringify({
    ...flow,
    token: tokenResult.access_token,
    login: user.login,
  } satisfies GrantRecord), { expirationTtl: 60 });

  return callbackPage(flow.origin, { code: grant });
}

async function redeem(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  let code = '';
  try {
    const body = await request.json() as { code?: unknown };
    if (typeof body.code === 'string') code = body.code;
  } catch {
    return json({ error: 'Invalid request' }, 400, cors(env, origin));
  }

  const key = `grant:${code}`;
  const grant = await env.AUTH_FLOW.get<GrantRecord>(key, 'json');
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
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

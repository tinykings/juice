const AUTH_BASE_URL = (process.env.NEXT_PUBLIC_GIST_AUTH_URL ?? '').replace(/\/$/, '');
const APP_ID = 'juice';
const COMPLETE_MESSAGE = 'gist-oauth:complete';

interface OAuthMessage {
  type: typeof COMPLETE_MESSAGE;
  code?: string;
  error?: string;
}

export interface GitHubAuthorization {
  token: string;
  login: string;
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(AUTH_BASE_URL);
}

export async function authorizeWithGitHub(): Promise<GitHubAuthorization> {
  if (!AUTH_BASE_URL) {
    throw new Error('GitHub sign-in is not configured');
  }

  const authOrigin = new URL(AUTH_BASE_URL).origin;
  const startUrl = new URL(`${AUTH_BASE_URL}/auth/github/start`);
  startUrl.searchParams.set('app', APP_ID);
  startUrl.searchParams.set('origin', window.location.origin);

  const popup = window.open(
    startUrl.toString(),
    'juice-github-oauth',
    'popup,width=620,height=760'
  );
  if (!popup) throw new Error('Allow pop-ups to connect GitHub');

  const grantCode = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error('GitHub sign-in timed out')), 5 * 60_000);
    const closedCheck = window.setInterval(() => {
      if (popup.closed) finish(new Error('GitHub sign-in was cancelled'));
    }, 500);

    const finish = (error?: Error, code?: string) => {
      window.clearTimeout(timeout);
      window.clearInterval(closedCheck);
      window.removeEventListener('message', onMessage);
      if (error) reject(error);
      else if (code) resolve(code);
    };

    const onMessage = (event: MessageEvent<OAuthMessage>) => {
      if (event.origin !== authOrigin || event.source !== popup || event.data?.type !== COMPLETE_MESSAGE) return;
      popup.close();
      if (event.data.error) finish(new Error(event.data.error));
      else if (event.data.code) finish(undefined, event.data.code);
    };

    window.addEventListener('message', onMessage);
  });

  const response = await fetch(`${AUTH_BASE_URL}/auth/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: grantCode }),
  });
  const result = await response.json() as Partial<GitHubAuthorization> & { error?: string };
  if (!response.ok || !result.token || !result.login) {
    throw new Error(result.error ?? 'Could not finish GitHub sign-in');
  }

  return { token: result.token, login: result.login };
}

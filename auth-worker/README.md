# Shared Gist OAuth broker

One Cloudflare Worker can authorize multiple static apps through one GitHub OAuth App. Each client receives its own GitHub token and manages its own app-specific Gist.

## Deploy

1. Create a GitHub OAuth App at <https://github.com/settings/developers>.
   - Homepage URL: any public landing page
   - Authorization callback URL: `https://YOUR-WORKER/auth/github/callback`
2. Install dependencies and create KV namespace:

   ```bash
   cd auth-worker
   npm install
   npx wrangler login
   npx wrangler kv namespace create AUTH_FLOW
   ```

3. Put returned namespace ID in `wrangler.toml`.
4. Update `APP_CONFIG` in `wrangler.toml`. Keys are app IDs; values are exact allowed origins. Paths are intentionally excluded because browsers report only origin during CORS and `postMessage` checks.
5. Add GitHub credentials as Worker secrets:

   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npm run deploy
   ```

6. Set Juice GitHub Actions repository variable `GIST_AUTH_URL` to Worker URL, then redeploy Pages.

## Add another app

Add origin under new app ID:

```toml
APP_CONFIG = '''
{
  "juice": ["https://tinykings.github.io"],
  "another-app": ["https://example.com"]
}
'''
```

Client starts popup at:

```text
https://YOUR-WORKER/auth/github/start?app=another-app&origin=https%3A%2F%2Fexample.com
```

Callback sends short-lived redemption code to opener using `postMessage`. Client POSTs `{ "code": "..." }` to `/auth/redeem`. Broker validates configured app origin before returning token.

## Security notes

- GitHub client secret exists only in Worker secrets.
- OAuth state expires after 10 minutes; redemption grants expire after 60 seconds.
- Allowed origins prevent arbitrary sites using broker OAuth app.
- Tokens still reach each app and should be protected like current personal access tokens. Juice stores token in local storage.
- Cloudflare KV deletion is not atomic. For high-risk/public multi-tenant use, replace KV grants with Durable Object or D1 atomic redemption.
- GitHub `gist` scope grants access to all account Gists. GitHub secret Gists are unlisted, not access-controlled private storage.

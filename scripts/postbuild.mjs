// Finishes the static export in out/:
//  - adds a Content-Security-Policy to each page. Next's inline scripts change
//    with every build, so their hashes can only be computed here.
//  - tells the service worker which built files to precache, so the app works
//    offline from the first visit, and names its cache after this build.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'out';
const PRECACHE_EXTENSIONS = new Set(['.js', '.css', '.woff2']);

const sha256 = (content) => createHash('sha256').update(content).digest('base64');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return files.flat();
}

function connectSources() {
  const authUrl = process.env.NEXT_PUBLIC_GIST_AUTH_URL;
  const sources = ["'self'", 'https://api.github.com', 'https://gist.githubusercontent.com'];
  // Calendar feeds go through the auth worker when browsers can't read them
  // directly. Without one, the browser has to be free to fetch any feed itself.
  sources.push(authUrl ? new URL(authUrl).origin : 'https:');
  return sources.join(' ');
}

function contentSecurityPolicy(html) {
  const inlineScripts = html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g);
  const scriptHashes = Array.from(inlineScripts, (match) => `'sha256-${sha256(match[1])}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(scriptHashes)].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSources()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

const files = await listFiles(OUT);

const pages = files.filter((file) => file.endsWith('.html'));
for (const page of pages) {
  const html = await readFile(page, 'utf8');
  if (!html.includes('<head>')) throw new Error(`No <head> in ${page}`);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(html)}"/>`;
  await writeFile(page, html.replace('<head>', `<head>${meta}`));
}

const assets = files
  .filter((file) => file.startsWith(path.join(OUT, '_next', 'static')) && PRECACHE_EXTENSIONS.has(path.extname(file)))
  .map((file) => `./${path.relative(OUT, file).split(path.sep).join('/')}`)
  .sort();

const buildHash = createHash('sha256');
buildHash.update(assets.join('\n'));
buildHash.update(await readFile(path.join(OUT, 'index.html')));
const buildId = buildHash.digest('hex').slice(0, 12);

const workerPath = path.join(OUT, 'sw.js');
const worker = await readFile(workerPath, 'utf8');
const finished = worker
  .replace("const BUILD_ID = 'dev';", `const BUILD_ID = '${buildId}';`)
  .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets)};`);
if (finished === worker) throw new Error('sw.js placeholders not found');
await writeFile(workerPath, finished);

console.log(`postbuild: CSP on ${pages.length} pages, ${assets.length} assets precached, build ${buildId}`);

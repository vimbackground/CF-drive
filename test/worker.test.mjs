import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { __testables } from '../worker.js';

const {
  assertVirtualPath,
  constantTimeEqual,
  isWebDavEnabled,
  normalizeVirtualPath,
  rebaseVirtualPath,
  shareTargetsPath,
  webDavEtagMatches,
  webDavLockTokensFromHeader,
  webDavPreconditionsPass
} = __testables;

test('constantTimeEqual only accepts exactly equal values', () => {
  assert.equal(constantTimeEqual('same-value', 'same-value'), true);
  assert.equal(constantTimeEqual('same-value', 'same-valuE'), false);
  assert.equal(constantTimeEqual('same-value', 'same-value-more'), false);
});

test('virtual paths are canonicalized and traversal is rejected', () => {
  assert.equal(normalizeVirtualPath('\\docs//plans/'), 'docs/plans');
  assert.equal(assertVirtualPath('/docs/plans/'), 'docs/plans');
  assert.throws(() => assertVirtualPath('../private'), /invalid path/);
  assert.throws(() => assertVirtualPath('docs/../private'), /invalid path/);
  assert.throws(() => assertVirtualPath(''), /invalid path/);
});

test('share path matching and rebasing retain path boundaries', () => {
  assert.equal(shareTargetsPath({ path: 'docs/a.txt' }, 'docs'), true);
  assert.equal(shareTargetsPath({ path: 'docs2/a.txt' }, 'docs'), false);
  assert.equal(rebaseVirtualPath('docs/a.txt', 'docs', 'archive/docs'), 'archive/docs/a.txt');
  assert.throws(() => rebaseVirtualPath('docs2/a.txt', 'docs', 'archive/docs'), /does not belong/);
});

test('WebDAV is enabled only by the explicit true value', () => {
  assert.equal(isWebDavEnabled({ WEBDAV_ENABLED: 'true' }), true);
  assert.equal(isWebDavEnabled({ WEBDAV_ENABLED: ' TRUE ' }), true);
  assert.equal(isWebDavEnabled({ WEBDAV_ENABLED: 'false' }), false);
  assert.equal(isWebDavEnabled({ WEBDAV_ENABLED: '1' }), false);
  assert.equal(isWebDavEnabled({}), false);
});

test('uninitialized application fails closed until an owner public key is configured', async () => {
  const env = webDavEnvironment();
  delete env.ACCESS_PASSWORD;
  const response = await worker.fetch(new Request('https://drive.example/'), env, { waitUntil() {} });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /BOOTSTRAP_OWNER_PUBLIC_KEY/);
});

test('owner-signed setup stores configuration in D1 and enables password login', async () => {
  const env = webDavEnvironment();
  delete env.ACCESS_PASSWORD;
  delete env.SHARE_SECRET;
  const owner = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', owner.publicKey);
  env.BOOTSTRAP_OWNER_PUBLIC_KEY = Buffer.from(JSON.stringify(publicJwk)).toString('base64url');
  const ctx = { waitUntil() {} };

  const challengeResponse = await worker.fetch(new Request('https://drive.example/api/setup/challenge'), env, ctx);
  assert.equal(challengeResponse.status, 200);
  const challenge = await challengeResponse.json();
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, owner.privateKey, new TextEncoder().encode(challenge.message));
  const claim = await worker.fetch(new Request('https://drive.example/api/setup/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nonce: challenge.nonce,
      signature: Buffer.from(signature).toString('base64url'),
      password: 'admin123',
      siteTitle: 'My CF-drive'
    })
  }), env, ctx);
  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).ok, true);

  const login = await worker.fetch(apiRequest('POST', '/api/login', { password: 'admin123' }), env, ctx);
  assert.equal(login.status, 200);
  const cookie = login.headers.get('Set-Cookie').split(';', 1)[0];
  const drive = await worker.fetch(new Request('https://drive.example/', { headers: { Cookie: cookie } }), env, ctx);
  const driveHtml = await drive.text();
  assert.equal(drive.status, 200);
  assert.doesNotMatch(driveHtml, /jsdelivr/);
  assert.match(driveHtml, /网盘设置/);
  assert.match(driveHtml, /使用指南/);
  assert.match(driveHtml, /viewMode = localStorage\.getItem\('viewMode'\) \|\| 'list'/);
  const guide = await worker.fetch(new Request('https://drive.example/guide', { headers: { Cookie: cookie } }), env, ctx);
  assert.equal(guide.status, 200);
  const guideHtml = await guide.text();
  assert.match(guideHtml, /WebDAV 使用/);
  assert.match(guideHtml, /返回文件管理/);
  assert.match(guideHtml, /网盘设置/);
  const settingsPage = await worker.fetch(new Request('https://drive.example/settings', { headers: { Cookie: cookie } }), env, ctx);
  assert.equal(settingsPage.status, 200);
  assert.match(await settingsPage.text(), /utility-panel/);  assert.match(driveHtml, /id="shareWorkspace"/);
  const shares = await worker.fetch(new Request('https://drive.example/shares', { headers: { Cookie: cookie } }), env, ctx);
  assert.equal(shares.status, 302);
  assert.equal(shares.headers.get('Location'), 'https://drive.example/');
  const settings = await worker.fetch(apiRequest('GET', '/api/settings', undefined, cookie), env, ctx);
  assert.equal(settings.status, 200);
  assert.equal((await settings.json()).settings.siteTitle, 'My CF-drive');

  const updated = await worker.fetch(apiRequest('PUT', '/api/settings', {
    siteTitle: 'Configured CF-drive',
    webdav: { enabled: true, username: 'configured-dav', password: 'davpass8', maxUploadBytes: 104857600 }
  }, cookie), env, ctx);
  assert.equal(updated.status, 200);
  const dav = await worker.fetch(new Request('https://drive.example/dav/', {
    method: 'OPTIONS', headers: { Authorization: `Basic ${btoa('configured-dav:davpass8')}` }
  }), env, ctx);
  assert.equal(dav.status, 204);
});

test('HTML responses use the centralized security and no-cache policy', async () => {
  const env = webDavEnvironment();
  const response = await worker.fetch(new Request('https://drive.example/login'), env, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'same-origin');
});

test('storage-node API requires its own token and never reuses the admin password', async () => {
  const env = webDavEnvironment();
  const ctx = { waitUntil() {} };
  const unconfigured = await worker.fetch(new Request('https://drive.example/api/node/ping'), env, ctx);
  assert.equal(unconfigured.status, 503);

  env.STORAGE_NODE_TOKEN = 'node-only-token';
  const adminPassword = await worker.fetch(new Request('https://drive.example/api/node/ping', {
    headers: { Authorization: `Bearer ${env.ACCESS_PASSWORD}` }
  }), env, ctx);
  assert.equal(adminPassword.status, 401);

  const authorized = await worker.fetch(new Request('https://drive.example/api/node/ping', {
    headers: { Authorization: 'Bearer node-only-token' }
  }), env, ctx);
  assert.equal(authorized.status, 200);
});

test('legacy public shared-folder routes do not bypass managed shares', async () => {
  const env = webDavEnvironment();
  const ctx = { waitUntil() {} };
  const page = await worker.fetch(new Request('https://drive.example/shared'), env, ctx);
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('Location'), 'https://drive.example/login');
  const api = await worker.fetch(new Request('https://drive.example/api/shared-list'), env, ctx);
  assert.equal(api.status, 401);
});

test('WebDAV ETag and conditional request semantics work for common cases', () => {
  assert.equal(webDavEtagMatches('"etag-a", W/"etag-b"', '"etag-b"'), true);
  assert.equal(webDavEtagMatches('*', '"etag-a"'), true);
  assert.equal(webDavEtagMatches('"etag-b"', '"etag-a"'), false);

  const matching = new Request('https://drive.example/dav/a.txt', { headers: { 'If-Match': '"etag-a"' } });
  const stale = new Request('https://drive.example/dav/a.txt', { headers: { 'If-None-Match': '"etag-a"' } });
  assert.equal(webDavPreconditionsPass(matching, { etag: '"etag-a"' }), true);
  assert.equal(webDavPreconditionsPass(stale, { etag: '"etag-a"' }), false);
});

test('WebDAV can read multiple presented lock tokens', () => {
  const tokens = webDavLockTokensFromHeader('(<opaquelocktoken:first-123>) (<opaquelocktoken:second-456>)');
  assert.deepEqual(tokens, ['opaquelocktoken:first-123', 'opaquelocktoken:second-456']);
});

function memoryD1() {
  const rows = new Map();
  const normalizeSql = sql => String(sql).replace(/\s+/g, ' ').trim();
  const liveRow = (key, now = Math.floor(Date.now() / 1000)) => {
    const row = rows.get(key);
    return row && (!row.expires_at || row.expires_at > now) ? row : null;
  };

  function prepare(sql) {
    const query = normalizeSql(sql);
    let values = [];
    const statement = {
      bind(...args) { values = args; return statement; },
      async first() {
        if (/^SELECT "value"(?:, expires_at)? FROM r2drive_kv WHERE "key" = \?/.test(query)) {
          const row = liveRow(values[0], Number(values[1]) || undefined);
          return row ? { value: row.value, expires_at: row.expires_at } : null;
        }
        if (/^SELECT 1 FROM r2drive_kv/.test(query)) {
          const [lower, upper, storageKey, now] = values;
          for (const [key, row] of rows) {
            if (key < lower || key >= upper || (row.expires_at && row.expires_at <= now)) continue;
            try { if (JSON.parse(row.value).storageKey === storageKey) return { 1: 1 }; } catch {}
          }
          return null;
        }
        throw new Error(`Unsupported D1 first(): ${query}`);
      },
      async all() {
        if (/SELECT "key" AS name FROM r2drive_kv/.test(query)) {
          const [lower, upper, now, limit, offset] = values;
          const keys = [...rows.entries()]
            .filter(([key, row]) => key >= lower && key < upper && (!row.expires_at || row.expires_at > now))
            .map(([key]) => key)
            .sort()
            .slice(Number(offset), Number(offset) + Number(limit));
          return { results: keys.map(name => ({ name })) };
        }
        if (/^SELECT "value", expires_at FROM r2drive_kv WHERE "key" = \?/.test(query)) {
          const row = liveRow(values[0], Number(values[1]) || undefined);
          return { results: row ? [{ value: row.value, expires_at: row.expires_at }] : [] };
        }
        if (/^SELECT "key" FROM r2drive_kv/.test(query)) {
          const [lower, upper, storageKey, now] = values;
          const results = [];
          for (const [key, row] of rows) {
            if (key < lower || key >= upper || (row.expires_at && row.expires_at <= now)) continue;
            try { if (JSON.parse(row.value).storageKey === storageKey) results.push({ key }); } catch {}
          }
          return { results };
        }
        if (/^SELECT 1 FROM r2drive_kv/.test(query)) {
          const [lower, upper, storageKey, now] = values;
          for (const [key, row] of rows) {
            if (key < lower || key >= upper || (row.expires_at && row.expires_at <= now)) continue;
            try { if (JSON.parse(row.value).storageKey === storageKey) return { results: [{ 1: 1 }] }; } catch {}
          }
          return { results: [] };
        }
        throw new Error(`Unsupported D1 all(): ${query}`);
      },
      async run() {
        if (/^CREATE (?:TABLE|INDEX)/.test(query)) return { success: true, meta: { changes: 0 } };
        if (/^INSERT INTO r2drive_kv/.test(query)) {
          const [key, value, expiresAt = null] = values;
          const exists = rows.has(key);
          if (/DO NOTHING/.test(query)) {
            if (!exists) rows.set(key, { value: String(value), expires_at: expiresAt });
            return { success: true, meta: { changes: exists ? 0 : 1 } };
          }
          if (/DO UPDATE SET/.test(query)) {
            rows.set(key, { value: String(value), expires_at: expiresAt });
            return { success: true, meta: { changes: 1 } };
          }
          if (exists) throw new Error('UNIQUE constraint failed: r2drive_kv.key');
          rows.set(key, { value: String(value), expires_at: expiresAt });
          return { success: true, meta: { changes: 1 } };
        }
        if (/^DELETE FROM r2drive_kv WHERE "key" = \?/.test(query)) {
          const changed = rows.delete(values[0]);
          return { success: true, meta: { changes: changed ? 1 : 0 } };
        }
        if (/^UPDATE r2drive_kv SET "value" = \? WHERE "key" = \? AND "value" = \?/.test(query)) {
          const [next, key, previous] = values;
          const row = rows.get(key);
          if (!row || row.value !== previous) return { success: true, meta: { changes: 0 } };
          rows.set(key, { ...row, value: String(next) });
          return { success: true, meta: { changes: 1 } };
        }
        if (/^UPDATE r2drive_kv SET "value" = json_set/.test(query)) {
          const key = values[0];
          const row = rows.get(key);
          if (!row) return { success: true, meta: { changes: 0 } };
          const share = JSON.parse(row.value);
          if (share.type !== 'share' || (share.maxAccesses && share.accessCount >= share.maxAccesses)) {
            return { success: true, meta: { changes: 0 } };
          }
          share.accessCount = Number(share.accessCount || 0) + 1;
          rows.set(key, { ...row, value: JSON.stringify(share) });
          return { success: true, meta: { changes: 1 } };
        }
        throw new Error(`Unsupported D1 run(): ${query}`);
      }
    };
    statement.runForBatch = () => query.startsWith('SELECT ') ? statement.all() : statement.run();
    return statement;
  }

  return {
    prepare,
    async batch(statements) { return Promise.all(statements.map(statement => statement.runForBatch())); }
  };
}

function memoryR2() {
  const objects = new Map();
  let revision = 0;
  const cloneMeta = entry => ({
    size: entry.bytes.byteLength,
    etag: entry.etag,
    uploaded: entry.uploaded,
    httpMetadata: { ...entry.httpMetadata },
    customMetadata: { ...entry.customMetadata }
  });
  return {
    async head(key) {
      const entry = objects.get(key);
      return entry ? cloneMeta(entry) : null;
    },
    async put(key, body, options = {}) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      const entry = {
        bytes,
        etag: `"memory-${++revision}"`,
        uploaded: new Date().toISOString(),
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {}
      };
      objects.set(key, entry);
      return cloneMeta(entry);
    },
    async get(key, options = {}) {
      const entry = objects.get(key);
      if (!entry) return null;
      const offset = Number(options?.range?.offset || 0);
      const length = options?.range?.length;
      const bytes = length === undefined ? entry.bytes : entry.bytes.slice(offset, offset + Number(length));
      return {
        ...cloneMeta(entry),
        body: new Blob([bytes]).stream(),
        async arrayBuffer() { return bytes.slice().buffer; }
      };
    },
    async delete(key) { objects.delete(key); }
  };
}

function webDavEnvironment() {
  return {
    R2_BUCKET: memoryR2(),
    DB: memoryD1(),
    ACCESS_PASSWORD: 'admin-password',
    SHARE_SECRET: 'test-only-share-secret',
    WEBDAV_ENABLED: 'true',
    WEBDAV_USERNAME: 'dav-user',
    WEBDAV_PASSWORD: 'dav-password'
  };
}

function webDavRequest(method, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Basic ${btoa('dav-user:dav-password')}`);
  return new Request(`https://drive.example${path}`, { ...init, method, headers });
}

function apiRequest(method, path, body = undefined, cookie = '') {
  const headers = new Headers({ 'X-R2Drive-CSRF': 'same-origin' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  return new Request(`https://drive.example${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function adminCookie(env, ctx) {
  const response = await worker.fetch(apiRequest('POST', '/api/login', { password: env.ACCESS_PASSWORD }), env, ctx);
  assert.equal(response.status, 200);
  assert.equal((await response.clone().json()).ok, true);
  return response.headers.get('Set-Cookie').split(';', 1)[0];
}

test('WebDAV request flow authenticates and manages a simple file lifecycle', async () => {
  const env = webDavEnvironment();
  const ctx = { waitUntil() {} };

  const unauthorized = await worker.fetch(new Request('https://drive.example/dav/', { method: 'OPTIONS' }), env, ctx);
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get('WWW-Authenticate'), /Basic/i);

  const options = await worker.fetch(webDavRequest('OPTIONS', '/dav/'), env, ctx);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('DAV'), '1');

  const collection = await worker.fetch(webDavRequest('MKCOL', '/dav/docs'), env, ctx);
  assert.equal(collection.status, 201);

  const upload = await worker.fetch(webDavRequest('PUT', '/dav/docs/hello.txt', { body: 'hello WebDAV', headers: { 'Content-Type': 'text/plain' } }), env, ctx);
  assert.equal(upload.status, 201);

  const listing = await worker.fetch(webDavRequest('PROPFIND', '/dav/docs', { headers: { Depth: '1' } }), env, ctx);
  assert.equal(listing.status, 207);
  assert.match(await listing.text(), /hello\.txt/);

  const download = await worker.fetch(webDavRequest('GET', '/dav/docs/hello.txt'), env, ctx);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'hello WebDAV');

  const deleted = await worker.fetch(webDavRequest('DELETE', '/dav/docs/hello.txt'), env, ctx);
  assert.equal(deleted.status, 204);
  const missing = await worker.fetch(webDavRequest('GET', '/dav/docs/hello.txt'), env, ctx);
  assert.equal(missing.status, 404);
});

test('WebDAV authentication throttles repeated failed Basic credentials', async () => {
  const env = webDavEnvironment();
  const ctx = { waitUntil() {} };
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await worker.fetch(new Request('https://drive.example/dav/', { method: 'OPTIONS' }), env, ctx);
    assert.equal(response.status, 401);
  }
  const locked = await worker.fetch(new Request('https://drive.example/dav/', { method: 'OPTIONS' }), env, ctx);
  assert.equal(locked.status, 429);
  assert.equal(locked.headers.get('Retry-After'), '900');
});

test('a capped share counts one download session, not every Range retry', async () => {
  const env = webDavEnvironment();
  const ctx = { waitUntil() {} };
  const sessionCookie = await adminCookie(env, ctx);
  await worker.fetch(webDavRequest('MKCOL', '/dav/share-test'), env, ctx);
  await worker.fetch(webDavRequest('PUT', '/dav/share-test/asset.txt', { body: 'share asset' }), env, ctx);

  const created = await worker.fetch(apiRequest('POST', '/api/shares', {
    path: 'share-test/asset.txt', suffix: 'one-download', maxAccesses: 1
  }, sessionCookie), env, ctx);
  assert.equal(created.status, 200);
  assert.equal((await created.json()).ok, true);

  const first = await worker.fetch(new Request('https://drive.example/api/share-download?id=one-download'), env, ctx);
  assert.equal(first.status, 200);
  assert.equal(await first.text(), 'share asset');
  const leaseCookie = first.headers.get('Set-Cookie').split(';', 1)[0];
  assert.match(leaseCookie, /^r2drive_share_download_one-download=/);

  const retry = await worker.fetch(new Request('https://drive.example/api/share-download?id=one-download', {
    headers: { Cookie: leaseCookie, Range: 'bytes=0-4' }
  }), env, ctx);
  assert.equal(retry.status, 206);
  assert.equal(await retry.text(), 'share');

  const exhausted = await worker.fetch(new Request('https://drive.example/api/share-download?id=one-download'), env, ctx);
  assert.equal(exhausted.status, 410);
});

test('changing a share password invalidates earlier share authorization cookies', async () => {
  const env = webDavEnvironment();
  const ctx = { waitUntil() {} };
  const sessionCookie = await adminCookie(env, ctx);
  await worker.fetch(webDavRequest('MKCOL', '/dav/private-share'), env, ctx);
  await worker.fetch(webDavRequest('PUT', '/dav/private-share/secret.txt', { body: 'private asset' }), env, ctx);
  const created = await worker.fetch(apiRequest('POST', '/api/shares', {
    path: 'private-share/secret.txt', suffix: 'password-change', password: 'old-password'
  }, sessionCookie), env, ctx);
  const createdBody = await created.json();
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.share.hasPassword, true);
  assert.equal(createdBody.share.downloadUrl, '');

  const beforeUnlock = await worker.fetch(new Request('https://drive.example/api/share-download?id=password-change'), env, ctx);
  assert.equal(beforeUnlock.status, 403);
  const rejected = await worker.fetch(apiRequest('POST', '/api/share-access', { id: 'password-change', password: 'wrong-password' }), env, ctx);
  assert.equal(rejected.status, 403);
  const unlocked = await worker.fetch(apiRequest('POST', '/api/share-access', { id: 'password-change', password: 'old-password' }), env, ctx);
  assert.equal(unlocked.status, 200);
  const authCookie = unlocked.headers.get('Set-Cookie').split(';', 1)[0];

  const authorized = await worker.fetch(new Request('https://drive.example/api/share-download?id=password-change', { headers: { Cookie: authCookie } }), env, ctx);
  assert.equal(authorized.status, 200);

  const changed = await worker.fetch(apiRequest('PUT', '/api/shares', {
    id: 'password-change', passwordMode: 'set', password: 'new-password'
  }, sessionCookie), env, ctx);
  assert.equal((await changed.json()).ok, true);

  const staleAuthorization = await worker.fetch(new Request('https://drive.example/api/share-download?id=password-change', { headers: { Cookie: authCookie } }), env, ctx);
  assert.equal(staleAuthorization.status, 403);
  const newlyUnlocked = await worker.fetch(apiRequest('POST', '/api/share-access', { id: 'password-change', password: 'new-password' }), env, ctx);
  const newCookie = newlyUnlocked.headers.get('Set-Cookie').split(';', 1)[0];
  const newlyAuthorized = await worker.fetch(new Request('https://drive.example/api/share-download?id=password-change', { headers: { Cookie: newCookie } }), env, ctx);
  assert.equal(newlyAuthorized.status, 200);
});

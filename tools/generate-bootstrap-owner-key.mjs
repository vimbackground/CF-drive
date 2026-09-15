import { webcrypto } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const privateKeyPath = resolve('.cf-drive/bootstrap-owner-private.jwk');
const keyPair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);
const [publicJwk, privateJwk] = await Promise.all([
  webcrypto.subtle.exportKey('jwk', keyPair.publicKey),
  webcrypto.subtle.exportKey('jwk', keyPair.privateKey)
]);

await mkdir(dirname(privateKeyPath), { recursive: true });
try {
  const handle = await open(privateKeyPath, 'wx', 0o600);
  await handle.close();
} catch (error) {
  if (error?.code === 'EEXIST') throw new Error(`${privateKeyPath} already exists; keep it safe or remove it deliberately before generating a replacement.`);
  throw error;
}
await writeFile(privateKeyPath, JSON.stringify(privateJwk, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });

const publicKey = Buffer.from(JSON.stringify(publicJwk)).toString('base64url');
console.log(`Private key saved locally (Git ignored): ${privateKeyPath}`);
console.log('Copy this line into [vars] in wrangler.toml, then commit and deploy:');
console.log(`BOOTSTRAP_OWNER_PUBLIC_KEY = "${publicKey}"`);

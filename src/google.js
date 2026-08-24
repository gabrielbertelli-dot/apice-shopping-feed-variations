// Google OAuth2 (service account, JWT bearer flow) shared by merchant.ts and sheets.ts.
// Uses Web Crypto (RS256) since Cloudflare Workers has no Node crypto module.

import { fetchWithRetry } from './http';

let cachedToken = null; // { accessToken, expiresAt, scope }
let inFlight = null;    // Promise<string> currently fetching a fresh token, or null

function base64url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromString(str) {
  return base64url(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(serviceAccount, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const signingInput = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

// scope: space-separated list, e.g. "https://www.googleapis.com/auth/content https://www.googleapis.com/auth/spreadsheets"
//
// Callers should pass SCOPES.BOTH rather than a single narrower scope when they can (see
// merchant.js/sheets.js) — cachedToken is a single slot keyed by the exact scope string, so
// two call sites requesting different scopes (CONTENT vs SHEETS) used to invalidate each
// other's cache entry every time they alternated, which became a real cost once runDiscovery
// started processing brands concurrently (near-simultaneous CONTENT and SHEETS calls).
export async function getGoogleAccessToken(env, scope) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não está configurado.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt - 60 > now) {
    return cachedToken.accessToken;
  }
  // Several brands can miss the cache at the same moment right after it expires (or on
  // first use) now that runDiscovery runs them concurrently — dedupe into one in-flight
  // fetch instead of each kicking off its own JWT sign + token request.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const assertion = await signJwt(serviceAccount, scope);

      const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Falha ao obter token do Google (${response.status}): ${text}`);
      }

      const data = await response.json();
      cachedToken = { accessToken: data.access_token, expiresAt: now + (data.expires_in || 3600), scope };
      return data.access_token;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export const SCOPES = {
  CONTENT: 'https://www.googleapis.com/auth/content',
  SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  BOTH: 'https://www.googleapis.com/auth/content https://www.googleapis.com/auth/spreadsheets'
};

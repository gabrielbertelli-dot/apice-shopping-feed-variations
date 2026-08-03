// Google OAuth login (Authorization Code flow), restricted to the company's Workspace
// domains — replaces Basic Auth as the only way into the dashboard. Session state is a
// signed cookie (HMAC-SHA256 over Web Crypto, same approach as google.js's JWT signing);
// there's no server-side session store since the app is stateless between requests.

export const ALLOWED_EMAIL_DOMAINS = ['gocase.com', 'gobeaute.com.br'];
export const SESSION_COOKIE = 'gb_session';
export const STATE_COOKIE = 'gb_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return bytesToBase64Url(new Uint8Array(sig));
}

export function isAllowedEmail(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

export async function createSessionToken(secret, email) {
  const payload = JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(payload));
  const sig = await hmac(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySessionToken(secret, token) {
  if (!token) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expectedSig = await hmac(secret, payloadB64);
  if (expectedSig !== sig) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!isAllowedEmail(payload.email)) return null;
  return payload;
}

export function googleAuthUrl(env, state, redirectUri) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForToken(env, code, redirectUri) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  if (!response.ok) {
    throw new Error(`Falha ao trocar code por token (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

export async function fetchGoogleUserinfo(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar userinfo (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

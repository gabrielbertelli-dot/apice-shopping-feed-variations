// Google OAuth2 (service account, JWT bearer flow) shared by merchant.ts and sheets.ts.
// Uses Web Crypto (RS256) since Cloudflare Workers has no Node crypto module.

let cachedToken = null; // { accessToken, expiresAt, scope }

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
export async function getGoogleAccessToken(env, scope) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não está configurado.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt - 60 > now) {
    return cachedToken.accessToken;
  }

  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const assertion = await signJwt(serviceAccount, scope);

  const response = await fetch('https://oauth2.googleapis.com/token', {
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
}

export const SCOPES = {
  CONTENT: 'https://www.googleapis.com/auth/content',
  SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  BOTH: 'https://www.googleapis.com/auth/content https://www.googleapis.com/auth/spreadsheets'
};

// Shared retry/backoff wrapper for every external API call this app makes (Metabase,
// Content API, Reports API, Sheets API, AI proxy, PiApp, Google's OAuth token endpoint).
// None of them had any retry before — a transient 429/5xx was a hard failure with no
// automatic recovery, even though several of these are read-only calls where a retry is
// obviously safe.
//
// Returns a Response either way (even a non-ok one after exhausting retries), so every
// existing call site's `if (!response.ok) { ...build error from status/text... }` block
// keeps working completely unchanged — only the raw `fetch(...)` call itself gets swapped
// for `fetchWithRetry(...)`.

function defaultRetryOn(status) {
  return status === 429 || status >= 500;
}

export async function fetchWithRetry(url, opts = {}, { retries = 3, baseDelayMs = 300, retryOn = defaultRetryOn } = {}) {
  let lastResponse = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, opts);
      if (response.ok || attempt === retries || !retryOn(response.status)) return response;
      lastResponse = response;
    } catch (err) {
      if (attempt === retries) throw err;
    }
    const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
    await new Promise((r) => setTimeout(r, delay));
  }
  return lastResponse;
}

// By decision, costed/generation calls (AI copy via ai.js's callAI, PiApp image generation
// via piapp.js's callTool) also retry on 429/5xx here with the same default policy as
// everything else — not just network-level failures — accepting a small risk of a
// duplicate generation/charge on a flaky-but-actually-successful call, in exchange for not
// making the human manually hit "tentar de novo" for ordinary transient blips.
//
// Not applied to auth.js's exchangeCodeForToken/fetchGoogleUserinfo (the interactive login
// flow) — that's low-volume and the user can just retry the login link, so it stays as a
// plain fetch().

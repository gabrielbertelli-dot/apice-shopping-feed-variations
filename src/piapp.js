// Client for PiApp's image generation, called directly over its MCP HTTP transport
// (confirmed by hand: stateless, no session handshake needed — a plain tools/call per
// request works). Responses come back as a single SSE "message" event whose data is a
// JSON-RPC envelope; the actual tool payload is JSON-encoded again inside
// result.content[0].text.

const PIAPP_MCP_URL = 'https://piapp-v2.vercel.app/api/ai/mcp';

function parseSseJsonRpc(text) {
  const dataLines = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
  if (!dataLines.length) throw new Error(`Resposta inesperada do PiApp (sem evento SSE): ${text.slice(0, 200)}`);
  return JSON.parse(dataLines[dataLines.length - 1]);
}

async function callTool(env, name, args) {
  if (!env.PIAPP_API_KEY) throw new Error('PIAPP_API_KEY não configurado.');

  const response = await fetch(PIAPP_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PIAPP_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao chamar o PiApp (${response.status}): ${text}`);
  }

  const envelope = parseSseJsonRpc(await response.text());
  if (envelope.error) throw new Error(`PiApp retornou erro: ${envelope.error.message || JSON.stringify(envelope.error)}`);

  const payloadText = envelope.result?.content?.[0]?.text;
  if (!payloadText) throw new Error(`Resposta do PiApp sem conteúdo: ${JSON.stringify(envelope)}`);
  return JSON.parse(payloadText);
}

// The Storage URL returned by check_jobs is a signed link that expires (~1h) — useless for
// a feed Google needs to keep re-fetching. The same object is also reachable at a
// permanent public path (confirmed via list_gallery); this rewrites sign -> public.
function toPermanentUrl(signedUrl) {
  if (!signedUrl) return signedUrl;
  return signedUrl.replace('/storage/v1/object/sign/', '/storage/v1/object/public/').split('?')[0];
}

export async function submitImageJob(env, { prompt, aspectRatio = '1:1', quality = 'standard', referenceImageUrls }) {
  const args = { prompt, aspect_ratio: aspectRatio, quality };
  if (referenceImageUrls?.length) args.reference_image_urls = referenceImageUrls;
  const result = await callTool(env, 'generate_image', args);
  return { jobId: result.job_id, status: result.status, estimatedTime: result.estimated_time };
}

// jobIds: array of up to 20 ids (PiApp's own limit on check_jobs).
export async function checkJobs(env, jobIds) {
  const result = await callTool(env, 'check_jobs', { job_ids: jobIds });
  return (result.jobs || []).map((j) => ({
    jobId: j.job_id,
    status: j.status,
    progress: j.progress,
    outputUrl: j.status === 'completed' ? toPermanentUrl(j.output_url) : null,
    error: j.error || null
  }));
}

// Bakes in Merchant Center's image rules (see docs/google-shopping-feed-guidelines.md §4)
// directly into the generation prompt — framing, background, no overlays — so compliance
// is the default output, not something caught only during human review.
export function buildImagePrompt(product, perspectiveText) {
  const productName = product.productTitle || product.title || 'beauty product';
  const brand = product.brand || '';
  return `${brand} ${productName}, styled to highlight: ${perspectiveText}. Clean e-commerce product ` +
    'photography, soft diffused studio lighting from a side angle creating gentle shadows, centered ' +
    'hero-shot composition on a seamless solid white or neutral background, the product filling ' +
    'roughly 75-90% of the frame, shallow depth of field, editorial beauty photography style, elegant ' +
    'and clean mood. No overlaid text of any kind, no call-to-action text or badges (e.g. "buy now", ' +
    '"sale", "% off"), no logo/watermark stamped on the image, no borders, no price or promotional ' +
    'adjectives — the product itself is the only subject.';
}

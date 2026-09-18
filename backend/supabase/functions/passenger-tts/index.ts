import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function publishableKey() {
  try {
    const named = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    const first = Object.values(named).find((v) => typeof v === 'string' && v.length > 10)
    if (first) return String(first)
  } catch (_) {}
  return Deno.env.get('SUPABASE_ANON_KEY') || ''
}

async function authenticated(req: Request) {
  const auth = req.headers.get('Authorization') || ''
  if (!/^Bearer\s+\S+/i.test(auth)) return false
  const token = auth.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = publishableKey()
  if (!url || !key) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: key },
    })
    return res.ok
  } catch (_) {
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(await authenticated(req))) return json({ error: 'unauthorized' }, 401)

  const apiKey = Deno.env.get('OPENAI_API_KEY') || ''
  if (!apiKey) return json({ error: 'tts_not_configured' }, 503)

  let body: { text?: unknown; voice?: unknown }
  try {
    body = await req.json()
  } catch (_) {
    return json({ error: 'invalid_json' }, 400)
  }

  const text = String(body.text || '').replace(/\s+/g, ' ').trim()
  const profile = body.voice === 'male' ? 'male' : 'female'
  if (!text) return json({ error: 'text_required' }, 400)
  if (text.length > 500) return json({ error: 'text_too_long' }, 413)

  const voice = profile === 'male' ? 'cedar' : 'marin'
  const instructions = profile === 'male'
    ? 'Parle en français de France. Voix d’homme adulte, clairement masculine, registre grave naturel, calme et professionnel, comme une annonce voyageurs dans un autobus. Diction très nette, rythme modéré, intonation sobre et rassurante. Ne chante pas et ne caricature pas la voix grave.'
    : 'Parle en français de France. Voix de femme adulte, clairement féminine, naturelle, calme et professionnelle, comme une annonce voyageurs dans un autobus. Diction très nette, rythme modéré, intonation sobre et rassurante. Ne chante pas.'

  try {
    const openai = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input: text,
        instructions,
        response_format: 'mp3',
      }),
    })

    if (!openai.ok) {
      console.error('[passenger-tts] OpenAI error', openai.status, await openai.text())
      return json({ error: 'tts_provider_error' }, 502)
    }

    return new Response(openai.body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=604800',
        'X-Mon-SAEIV-Voice': profile,
        'X-Mon-SAEIV-AI-Voice': 'true',
      },
    })
  } catch (error) {
    console.error('[passenger-tts] failure', error)
    return json({ error: 'tts_unavailable' }, 502)
  }
})

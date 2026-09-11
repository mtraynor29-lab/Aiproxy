# HCNSEC AI Proxy

Production Cloudflare Worker that exposes an OpenAI-compatible `POST /v1/chat/completions` endpoint and proxies requests to:

`https://api.hcnsec.cn/v1/chat/completions`

The Worker injects the upstream API key from a Cloudflare Secret. Clients never need the upstream key.

```text
Client / AI application
        |
        |  Bearer PROXY_API_KEY  (optional)
        v
Cloudflare Worker
        |
        |  Bearer HCNSEC_API_KEY  (server-side secret)
        v
https://api.hcnsec.cn/v1/chat/completions
```

## 1. Project structure

```text
.
├── package.json
├── wrangler.toml
├── tsconfig.json
├── .gitignore
├── .dev.vars.example
├── README.md
└── src
    └── index.ts
```

## 2. Source code

The Worker lives in `src/index.ts`. It:

- Accepts `POST /v1/chat/completions`
- Forwards the original JSON body without rewriting fields
- Adds `Authorization: Bearer ${env.HCNSEC_API_KEY}`
- Ignores any client `Authorization` header when talking to upstream
- Streams SSE responses by passing `upstreamResponse.body` through directly
- Proxies only the hardcoded upstream URL (no user-controlled target)

## 3. Wrangler configuration

`wrangler.toml` sets the Worker name, entrypoint, and `CORS_ORIGIN`.

Do not put secrets in `wrangler.toml`. Use Cloudflare Secrets.

To restrict CORS later:

```toml
[vars]
CORS_ORIGIN = "https://app.example.com"
```

## 4. package.json

Scripts:

- `npm run dev` — local development
- `npm run deploy` — deploy
- `npm run tail` — live logs

## 5. Secret configuration

Never hardcode keys in source, GitHub, frontend code, logs, or API responses.

### Upstream key (required)

```bash
npx wrangler secret put HCNSEC_API_KEY
```

Wrangler prompts for the value. It is stored as a Cloudflare Worker Secret and read as `env.HCNSEC_API_KEY`.

### Optional client key

```bash
npx wrangler secret put PROXY_API_KEY
```

If `PROXY_API_KEY` is set, clients must send:

```text
Authorization: Bearer <MY_PROXY_KEY>
```

The Worker then authenticates to HCNSEC with `HCNSEC_API_KEY`.

If `PROXY_API_KEY` is not set, the public endpoint allows unauthenticated requests (development only). Enable `PROXY_API_KEY` before sharing a public URL.

### Local development secrets

Copy the example file:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` locally. That file is gitignored.

## 6. Deployment commands

```bash
npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler secret put HCNSEC_API_KEY
```

```bash
npx wrangler secret put PROXY_API_KEY
```

```bash
npx wrangler deploy
```

```bash
npx wrangler tail
```

Local:

```bash
cp .dev.vars.example .dev.vars
```

```bash
npx wrangler dev
```

Default local URL: `http://127.0.0.1:8787`

## 7. Custom domain

The public API should be:

```text
https://api.example.com/v1/chat/completions
```

### Dashboard

1. Add `example.com` to Cloudflare DNS.
2. Open Workers & Pages -> `hcnsec-ai-proxy` -> Settings -> Domains & Routes.
3. Add custom domain `api.example.com`.
4. Cloudflare creates the DNS record and TLS certificate.

### wrangler.toml

```toml
[[routes]]
pattern = "api.example.com"
custom_domain = true
```

Then run:

```bash
npx wrangler deploy
```

OpenAI-compatible base URL becomes `https://api.example.com/v1`.

## 8. curl tests

Replace `YOUR_WORKER_URL` with the Worker URL or custom domain, for example `https://hcnsec-ai-proxy.<account>.workers.dev`.

### Health

```bash
curl https://YOUR_WORKER_URL/health
```

Expected:

```json
{"status":"ok"}
```

### Root

```bash
curl https://YOUR_WORKER_URL/
```

### Normal completion

Without `PROXY_API_KEY`:

```bash
curl https://YOUR_WORKER_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {
        "role": "user",
        "content": "Say hello in one sentence."
      }
    ]
  }'
```

With `PROXY_API_KEY` enabled, add:

```bash
-H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

Full example:

```bash
curl https://YOUR_WORKER_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -d '{
    "model": "auto",
    "messages": [
      {
        "role": "user",
        "content": "Say hello in one sentence."
      }
    ]
  }'
```

### Streaming

```bash
curl https://YOUR_WORKER_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "auto",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Write a short paragraph about artificial intelligence."
      }
    ]
  }'
```

With client auth:

```bash
curl https://YOUR_WORKER_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -N \
  -d '{
    "model": "auto",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Write a short paragraph about artificial intelligence."
      }
    ]
  }'
```

`-N` disables curl output buffering so SSE chunks appear immediately.

## 9. OpenAI-compatible client configuration

Base URL:

```text
https://YOUR_DOMAIN/v1
```

API key:

- If `PROXY_API_KEY` is set: use that value
- If it is not set: any placeholder such as `not-needed` may work, because the Worker uses `HCNSEC_API_KEY` server-side

Model:

```text
auto
```

The client sends `POST /v1/chat/completions`. Do not point clients at `https://api.hcnsec.cn`.

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_PROXY_API_KEY",
    base_url="https://YOUR_DOMAIN/v1",
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Say hello in one sentence."}],
)
print(response.choices[0].message.content)
```

### OpenAI SDK (JavaScript)

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_PROXY_API_KEY",
  baseURL: "https://YOUR_DOMAIN/v1",
});

const response = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Say hello in one sentence." }],
});
```

### Cursor / Continue / other tools

- API base: `https://YOUR_DOMAIN/v1`
- API key: `YOUR_PROXY_API_KEY`
- Model: `auto`

## 10. Security notes

- `HCNSEC_API_KEY` exists only as a Cloudflare Secret (`env.HCNSEC_API_KEY`).
- Client `Authorization` headers are never forwarded upstream.
- Request bodies, Authorization headers, and secrets are not logged.
- Unexpected exceptions return `{ "error": { "message": "Internal proxy error", "type": "proxy_error" } }`.
- Missing `HCNSEC_API_KEY` returns HTTP 500 `configuration_error` without revealing secret values.
- The Worker only fetches `https://api.hcnsec.cn/v1/chat/completions`. Clients cannot choose another upstream URL.
- Unsupported methods return HTTP 405.
- JSON bodies are validated but not rewritten, so new upstream fields keep working.
- Enable `PROXY_API_KEY` before exposing the Worker publicly.
- Restrict `CORS_ORIGIN` in production instead of `*`.
- `.dev.vars` is gitignored. Never commit real keys.

## 11. Rate limiting

Do not use in-memory counters in the Worker. Isolate memory is not shared and not durable.

Recommended: Cloudflare WAF Rate Limiting rules on the custom domain or Worker route.

Example rule:

- Match `POST /v1/chat/completions`
- Limit by IP, for example 60 requests per minute
- Action: block or JS challenge

Optional Workers Rate Limiting binding (uncomment in `wrangler.toml`):

```toml
[[ratelimits]]
name = "RATE_LIMITER"
namespace_id = "1001"
simple = { limit = 60, period = 60 }
```

Tradeoffs:

| Approach | Persistence | Cost / setup | Notes |
| --- | --- | --- | --- |
| Cloudflare WAF Rate Limiting | Yes | Dashboard rule | Best default for production |
| Workers Rate Limiting binding | Yes | Wrangler binding | Needs extra code to call `env.RATE_LIMITER.limit()` |
| Durable Objects | Yes | More complexity | Useful for custom quotas per API key |
| In-memory Map on the isolate | No | None | Unreliable. Do not use |

This project ships without an in-memory limiter. Add a WAF rule after deploy.

## 12. Troubleshooting

### `Server API key is not configured`

`HCNSEC_API_KEY` is missing. Run `npx wrangler secret put HCNSEC_API_KEY` and redeploy if needed.

For local dev, put the key in `.dev.vars`.

### HTTP 401 `Missing API key` / `Invalid API key`

`PROXY_API_KEY` is enabled. Send `Authorization: Bearer <MY_PROXY_KEY>`. This is the client key, not the upstream key.

### HTTP 405

Use `POST` for `/v1/chat/completions` and `GET` for `/` and `/health`.

### CORS errors in the browser

`OPTIONS` is handled. If the app is not on `*`, set `CORS_ORIGIN` to the exact frontend origin.

### Streaming appears buffered

Use `curl -N`. Confirm the client reads a fetch `ReadableStream`. The Worker does not buffer upstream bodies.

### Upstream 401 / 403

The secret value is wrong, or the upstream account is blocked. Rotate `HCNSEC_API_KEY`. The Worker does not print the key.

### Upstream 429

Passed through with `Retry-After` when present. Add Cloudflare rate limiting to protect your quota.

### Timeouts or 502 `Upstream request failed`

Network failure talking to `api.hcnsec.cn`. Check upstream status. Streaming requests can run until the Worker/account CPU and wall-clock limits.

### Logs

```bash
npx wrangler tail
```

Logs do not include bodies or Authorization headers.

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | No | Status JSON |
| GET | `/health` | No | `{ "status": "ok" }` without calling upstream |
| OPTIONS | `/v1/chat/completions` | No | CORS preflight |
| POST | `/v1/chat/completions` | `PROXY_API_KEY` if configured | OpenAI-compatible proxy |

## Request forwarding

The body is forwarded as-is, including:

- `model`
- `messages`
- `temperature`
- `top_p`
- `max_tokens`
- `stream`
- `tools`
- `tool_choice`
- `response_format`
- any other JSON fields the upstream accepts

Streaming (`"stream": true`) preserves `Content-Type: text/event-stream` and the upstream `ReadableStream`.

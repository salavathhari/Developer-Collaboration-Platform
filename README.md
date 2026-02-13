# Developer Collaboration Platform

Modern developer workspace combining projects, chat, tasks, files, and AI insights.

## Quick Start

### 1) Environment setup

- Copy env templates:
	- `server/.env.example` -> `server/.env`
	- `client/.env.example` -> `client/.env`
- AI Setup (Optional):
	- Install [Ollama](https://ollama.com/)
	- Pull the model specified in `server/.env`: `ollama pull llama3.1`

### 2) Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 3) Run locally

```bash
cd server
npm run dev

cd ../client
npm run dev
```

Expected logs:
- `MongoDB connected`
- `Server running on port 5000`

## Environment Variables

Server (see `server/.env.example`):
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_MS`
- `NODE_ENV`
- `PORT`
- `UPLOAD_DIR`
- `CORS_ORIGIN`
- `CLIENT_URL`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- `SOCKET_RATE_LIMIT`, `SOCKET_RATE_WINDOW_MS`
- `REDIS_URL` (optional)
- `S3_BUCKET`, `S3_REGION`, `AWS_S3_KEY`, `AWS_S3_SECRET` (optional)
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_LOCAL_URL`
- `EMAIL_SMTP_HOST`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS` (optional)
- `CLAMAV_ENABLED`, `CLAMAV_REQUIRED`, `CLAMAV_COMMAND`, `CLAMAV_TIMEOUT_MS`, `CLAMAV_ARGS` (optional)

Client (see `client/.env.example`):
- `VITE_API_URL`
- `VITE_SOCKET_URL`

## QA & Validation Plan

### Phase-1 smoke tests (curl)

```bash
BASE_URL=http://localhost:5000

curl -s -X POST "$BASE_URL/api/auth/register" \
	-H "Content-Type: application/json" \
	-d '{"name":"Test User","email":"test@example.com","password":"Password123"}'

curl -s -X POST "$BASE_URL/api/auth/login" \
	-H "Content-Type: application/json" \
	-d '{"email":"test@example.com","password":"Password123"}'
```

### Phase-2 socket smoke steps

1) Open two browsers and sign in.
2) Join the same project.
3) Send chat message from client A -> verify appears in client B.
4) Move a task from client A -> verify client B receives update.

### Phase-3 AI smoke

```bash
curl -s -X POST "$BASE_URL/api/ai/query" \
	-H "Authorization: Bearer <JWT>" \
	-H "Content-Type: application/json" \
	-d '{"prompt":"Summarize our progress"}'
```

If provider fails, the API returns a safe fallback response.

## Tests

Server tests:

```bash
cd server
npm test
```

Client Cypress tests (requires running app):

```bash
cd client
npm run cypress:run
```

## Seed Data

```bash
cd server
node scripts/seed.js
```

Seeded content: one owner, one member, one project, tasks, and sample messages.

## Security Reminders

- Revoke compromised keys immediately (never paste secrets in issues or chats).
- Never expose API keys to the client. AI calls must go through the backend.
- Rotate keys by updating `.env` and restarting the server.

## Error Response Format

The API returns a consistent structure:

```json
{
	"message": "Human readable summary",
	"errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

## Load Testing (Example)

```bash
npx autocannon -c 20 -d 20 http://localhost:5000/api/projects/<projectId>/messages
```

Watch for elevated latency and 429 responses when rate limiting kicks in.

## Production Notes

### Redis socket scaling

Socket adapter is already wired for Redis when `REDIS_URL` is set.

### S3 pre-signed uploads

Use `/api/projects/:projectId/files/signed-url` to get a short-lived upload URL.

### Key rotation

1) Update `.env` with the new key (`AI_API_KEY`, SMTP, etc.).
2) Restart the server.
3) Verify with a test request.

### Sticky sessions

Use a load balancer with sticky sessions or move presence to Redis.

## Smoke Script

```bash
./scripts/smoke.sh
```

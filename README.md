# Elixir DocBot

AI-powered WhatsApp medical consultation framework. Doctors run AI chatbots on WhatsApp — patients chat in any Indian language (text or voice), the AI responds in their language, and doctors see everything in English on their WordPress dashboard.

```
[Patient WhatsApp] <---> [Meta Cloud API]
                              |
                              v
                   [Vercel Next.js Backend]  <---> [OpenAI GPT-4o]
                     |          |         |
                     v          v         v
               [Bhashini]  [Postgres]  [WP Plugin REST Client]
                (STT/TTS/                    |
                Translate)                   v
                                      [WordPress Admin]
                                      (Doctor Dashboard)
```

## What It Does

1. Patient sends a voice note in Hindi on WhatsApp
2. Bhashini ASR converts Hindi speech to Hindi text
3. Bhashini NMT translates Hindi text to English
4. GPT-4o generates a medical triage response (English)
5. Bhashini NMT translates English response back to Hindi
6. Bhashini TTS generates Hindi audio
7. Patient receives Hindi text + audio reply on WhatsApp
8. Doctor sees the full conversation in English on WordPress

Supports all **22 scheduled Indian languages** via [Bhashini](https://bhashini.gov.in) (Govt of India AI translation platform).

---

## What You Need Before Starting

### Accounts & API Keys

| Service | What You Need | Where to Get It |
|---------|--------------|-----------------|
| **Vercel** | Account (free tier works) | [vercel.com](https://vercel.com) |
| **Vercel Postgres** | A Postgres database | Vercel Dashboard → Storage → Create Database |
| **OpenAI** | API key with GPT-4o access | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Meta (WhatsApp)** | WhatsApp Business App, Phone Number ID, Permanent Access Token | [developers.facebook.com](https://developers.facebook.com) → Create App → WhatsApp |
| **Bhashini** | User ID + API Key (free, Govt of India) | [bhashini.gov.in/ulca](https://bhashini.gov.in/ulca) → Register → Get API credentials |
| **WordPress** | A WordPress site (self-hosted or managed, PHP 8.0+) | Any WordPress host |

### Meta WhatsApp Business Setup

1. Go to [Meta Developer Portal](https://developers.facebook.com) and create a Business App
2. Add the **WhatsApp** product to your app
3. In WhatsApp → API Setup, note your:
   - **Phone Number ID** (e.g., `109234567890123`)
   - **Permanent Access Token** (generate a system user token that doesn't expire)
4. You'll configure the webhook URL after deploying to Vercel

### Bhashini Setup

1. Register at [bhashini.gov.in/ulca](https://bhashini.gov.in/ulca)
2. Go to My Account → API Keys
3. Note your **User ID** and **ULCA API Key**

---

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDebanitrkl%2Felixir-doc-bot&env=POSTGRES_PRISMA_URL,OPENAI_API_KEY,BHASHINI_USER_ID,BHASHINI_API_KEY,WHATSAPP_APP_SECRET,ENCRYPTION_SECRET,DOCBOT_MASTER_SECRET&envDescription=API%20keys%20needed%20for%20DocBot&envLink=https%3A%2F%2Fgithub.com%2FDebanitrkl%2Felixir-doc-bot%23environment-variables&project-name=elixir-doc-bot)

> The repo includes a `vercel.json` that configures the build command and output directory automatically — no manual Root Directory setting needed.

### Manual Deploy

1. Fork/clone this repo
2. In Vercel Dashboard → New Project → Import this repo
3. Framework Preset will be auto-detected as **Next.js**
4. Add all environment variables (see below)
5. Deploy

### Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PRISMA_URL` | Vercel Postgres connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `BHASHINI_USER_ID` | Bhashini platform user ID | `your-user-id` |
| `BHASHINI_API_KEY` | Bhashini ULCA API key | `your-api-key` |
| `WHATSAPP_APP_SECRET` | Meta App Secret (for webhook signature verification) | Found in Meta App → Settings → Basic → App Secret |
| `ENCRYPTION_SECRET` | 32+ character random string for PII encryption | Generate with `openssl rand -hex 32` |
| `DOCBOT_MASTER_SECRET` | Shared secret for doctor registration | Generate with `openssl rand -hex 24` |

### After Deploying

1. **Push the database schema:**
   ```bash
   cd packages/backend
   npx prisma db push
   ```
   Or use `npx prisma migrate deploy` if you prefer migrations.

2. **Configure WhatsApp webhook:**
   - Go to Meta Developer Portal → Your App → WhatsApp → Configuration
   - Webhook URL: `https://your-app.vercel.app/api/webhook/whatsapp`
   - Verify Token: same value as your `DOCBOT_MASTER_SECRET`
   - Subscribe to: `messages`

---

## WordPress Plugin Setup

### Install the Plugin

1. Zip the `packages/wordpress-plugin/docbot/` folder
2. In WordPress Admin → Plugins → Add New → Upload Plugin → upload the zip
3. Activate the plugin

### Build the Admin UI (if modifying)

```bash
cd packages/wordpress-plugin/docbot/admin
npm install
npm run build
```

The built assets go into `admin/dist/` which the plugin auto-detects.

### WordPress `wp-config.php` (optional but recommended)

```php
define('DOCBOT_MASTER_SECRET', 'same-value-as-vercel-env');
define('DOCBOT_ENCRYPTION_KEY', 'a-random-32-char-string-for-wp');
```

### First-Time Setup

1. Go to WordPress Admin → DocBot
2. The setup wizard will appear
3. Choose **New Registration** (or use an existing API key)
4. Enter your Vercel backend URL (e.g., `https://your-app.vercel.app`)
5. Enter the master secret
6. Optionally enter WhatsApp Phone Number ID and token
7. Click Register & Connect

---

## Project Structure

```
elixir-doc-bot/
├── packages/
│   ├── backend/                          # Next.js 14 API (deployed to Vercel)
│   │   ├── prisma/schema.prisma          # Database schema
│   │   ├── src/
│   │   │   ├── app/api/
│   │   │   │   ├── webhook/whatsapp/     # WhatsApp webhook (core pipeline)
│   │   │   │   ├── doctors/register/     # Doctor registration
│   │   │   │   ├── patients/             # Patient CRUD
│   │   │   │   ├── conversations/[id]/   # Conversations + messages + doctor reply
│   │   │   │   ├── settings/             # Doctor settings
│   │   │   │   ├── stats/                # Dashboard statistics
│   │   │   │   └── auth/verify/          # API key verification
│   │   │   └── lib/
│   │   │       ├── whatsapp/client.ts    # Meta Cloud API wrapper
│   │   │       ├── bhashini/client.ts    # Bhashini ASR/NMT/TTS pipeline
│   │   │       ├── bhashini/languages.ts # 22 Indian language definitions
│   │   │       ├── openai/client.ts      # GPT-4o chat completion
│   │   │       ├── openai/system-prompts.ts # Medical AI prompt builder
│   │   │       ├── auth/middleware.ts     # API key + webhook auth + rate limiting
│   │   │       ├── db/prisma.ts          # Prisma singleton
│   │   │       └── utils/                # Encryption, audit logging
│   │   └── vercel.json
│   │
│   └── wordpress-plugin/docbot/          # WordPress Plugin
│       ├── docbot.php                    # Plugin entry point
│       ├── includes/
│       │   ├── class-docbot-admin.php    # Admin menu + React enqueue
│       │   ├── class-docbot-api-client.php # HTTP client to Vercel
│       │   ├── class-docbot-rest-api.php # WP REST proxy (14 endpoints)
│       │   ├── class-docbot-settings.php # WP options management
│       │   └── class-docbot-encryption.php # AES-256-GCM for WP
│       └── admin/
│           └── src/                      # React 18 + Vite admin app
│               ├── App.tsx               # Router + sidebar navigation
│               ├── pages/
│               │   ├── Dashboard.tsx     # Stats, recent conversations, languages
│               │   ├── Conversations.tsx # Conversation list with filters
│               │   ├── ConversationDetail.tsx # Chat UI + doctor reply
│               │   ├── Patients.tsx      # Patient list
│               │   ├── PatientDetail.tsx # Patient details + block/unblock
│               │   ├── Settings.tsx      # All doctor configurations
│               │   └── Setup.tsx         # First-time onboarding wizard
│               └── lib/api-client.ts     # WP REST API wrapper
```

## Architecture

### Multi-Doctor Support

- Each doctor installs the WordPress plugin on their own site
- All doctors share a single Vercel backend
- Data is fully isolated by `doctorId` — doctors only see their own patients
- Doctors are identified by WhatsApp Phone Number ID in webhooks, by API key in REST calls

### Message Pipeline

```
Patient Voice (Hindi) ──► WhatsApp ──► Vercel Webhook
                                          │
                                    ┌─────┴─────┐
                                    │ Download   │
                                    │ Audio      │
                                    └─────┬─────┘
                                          │
                                    ┌─────┴─────┐
                                    │ Bhashini   │
                                    │ ASR (hi)   │──► Hindi Text
                                    └─────┬─────┘
                                          │
                                    ┌─────┴─────┐
                                    │ Bhashini   │
                                    │ NMT hi→en  │──► English Text
                                    └─────┬─────┘
                                          │
                                    ┌─────┴─────┐
                                    │ OpenAI     │
                                    │ GPT-4o     │──► English Response
                                    └─────┬─────┘
                                          │
                                    ┌─────┴─────┐
                                    │ Bhashini   │
                                    │ NMT en→hi  │──► Hindi Response Text
                                    └─────┬─────┘
                                          │
                                    ┌─────┴─────┐
                                    │ Bhashini   │
                                    │ TTS (hi)   │──► Hindi Audio
                                    └─────┬─────┘
                                          │
                                    Send text + audio ──► WhatsApp ──► Patient
                                          │
                                    Store both versions ──► Postgres
                                          │
                                    Doctor sees English ──► WordPress Dashboard
```

### Security

- WhatsApp webhooks verified via `X-Hub-Signature-256` HMAC
- Doctor API keys: SHA-256 hashed in Postgres, AES-256-GCM encrypted in WordPress
- Patient phone numbers encrypted at rest
- WordPress admin auth via nonce + `manage_options` capability
- Rate limiting: 30 messages/min per patient
- Medical disclaimer in every AI system prompt

### Supported Languages

Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu, Urdu

---

## Local Development

### Backend

```bash
cd packages/backend
cp .env.example .env        # Fill in your API keys
npm install
npx prisma generate
npx prisma db push          # Push schema to your database
npm run dev                 # Starts on http://localhost:3000
```

For local WhatsApp webhook testing, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Use the ngrok URL as your webhook URL in Meta Developer Portal
```

### WordPress Plugin Admin (React)

```bash
cd packages/wordpress-plugin/docbot/admin
npm install
npm run dev                 # Starts Vite dev server on http://localhost:5173
npm run build               # Production build into dist/
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `Doctor` | Doctor profile, API key hash, WhatsApp credentials |
| `DoctorSettings` | Specialization, system prompt, working hours, feature flags |
| `Patient` | Phone, name, preferred language, blocked status |
| `Conversation` | Links doctor + patient, status tracking |
| `Message` | Both original language and English translation, role, type |
| `AuditLog` | Doctor actions for compliance |
| `RateLimit` | Per-patient and per-doctor rate limiting |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Next.js 14 (App Router) on Vercel |
| Database | Vercel Postgres (Neon) + Prisma ORM |
| AI | OpenAI GPT-4o |
| WhatsApp | Meta WhatsApp Business Cloud API |
| Translation | Bhashini (Govt of India) — ASR, NMT, TTS |
| WP Plugin | PHP 8.0+ (backend) + React 18 + Vite (admin UI) |
| Auth | HMAC API keys, AES-256-GCM encryption, WP nonce |

---

## License

MIT

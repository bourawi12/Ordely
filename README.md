# Ordely — Autonomous AI Sales & Order Agent

> **Turn every "Buy" click into an intelligent, automated workflow.**  
> Ordely is an embedded AI Sales & Order Agent designed for B2B e-commerce platforms to validate, execute, track, and optimize orders end-to-end[cite: 2].

---

## 🌟 Overview

Ordely bridges the gap between front-end checkout and back-end fulfillment[cite: 2]. By combining real-time order processing, dynamic inventory control, automated supplier communications, and local voice pipeline orchestration, Ordely eliminates manual intervention while giving sales teams full administrative oversight[cite: 1, 2].

Built on a modern multi-tenant SaaS foundation, Ordely separates Control Plane management from Application Plane orchestration to guarantee enterprise-scale tenant isolation, security, and performance[cite: 3].

---

## 🔑 Core Capabilities

* **Autonomous Order Validation & Fraud Check:** Evaluates incoming orders against customer risk profiles, custom pricing matrices, and fraud indicators prior to execution[cite: 2].
* **Dynamic Stock Reservation:** Instantly locks inventory upon order creation to prevent overselling and syncs real-time balances across sales channels[cite: 2].
* **Automated Supplier Replenishment Calls:** Monitors stock thresholds and automatically initiates voice calls or API orders to suppliers to replenish stock before stockouts occur[cite: 2].
* **End-to-End CRM/ERP Synchronization:** Real-time event propagation to systems like Salesforce, HubSpot, SAP, or custom ERPs[cite: 1, 2].
* **Supervised Automation ("Supervision, Not Replacement"):** Provides real-time alerts, immutable audit trails, and an instant **Manual Override** toggle for human sales teams[cite: 2].

---

## 🗣️ Voice & Local Market Strategy

Ordely leverages a hybrid voice architecture specifically engineered for multilingual operational environments, with dedicated support for **Tunisian Arabic (Darja)**, **French**, and **Modern Standard Arabic (MSA)**[cite: 1].

### Hybrid Pipeline Architecture
* **Global Infrastructure:** High-throughput call routing and WebRTC handling via Twilio Voice API and Retell AI for flexible agent orchestration[cite: 1].
* **Local Ecosystem Integration:** Native API connectors for regional platforms like Confirmed (Tunisia) to ensure seamless local carrier routing (+216 numbers) and logistics alignment[cite: 1].
* **Custom Dialect Microservices:** Low-latency Speech-to-Text (ASR), Natural Language Understanding (NLU), and Text-to-Speech (TTS) pipeline tuned for local dialectal nuances (Darja/French code-switching)[cite: 1].

---

## 🏗️ System Architecture & Stack

Ordely is designed following the **AWS SaaS Architecture Fundamentals**, maintaining a strict separation between the Control Plane and Application Plane[cite: 3].

### Tech Stack Specifications
* **API Framework:** GraphQL & REST API gateway with low-latency WebSockets for live status feeds[cite: 2].
* **Event Orchestration:** Event-driven microservices architecture using Apache Kafka / AWS EventBridge for real-time order lifecycle events[cite: 3].
* **Database & Data Partitioning:** Hybrid data isolation supporting both pooled database schemas and isolated siloed tenant stores for enterprise clients[cite: 3].
* **Voice Pipeline:** Custom low-latency WebRTC streams connected to Twilio Voice and Retell AI engines[cite: 1].

---

## 🛡️ Security & Compliance

* **Tenant Isolation:** Context-aware tenant token enforcement preventing cross-tenant data access at the database and API layer[cite: 3].
* **Enterprise Security:** End-to-end encryption in transit (TLS 1.3) and at rest (AES-256)[cite: 2].
* **Regulatory Compliance:** Strict adherence to GDPR guidelines, including configurable data retention policies and call recording consent management[cite: 1, 2].
* **Access Control:** Role-Based Access Control (RBAC) supporting Admin, Sales Rep, Auditor, and System roles[cite: 2].

---

## 🚀 Getting Started & Deployment

Ordely is delivered as a cloud-native SaaS solution. Teams can roll out an initial pilot within 6–8 weeks on selected high-value SKUs before full enterprise scaling[cite: 2].

```bash
# Clone the repository
git clone [https://github.com/your-org/ordely-core.git](https://github.com/your-org/ordely-core.git)

# Navigate to project directory
cd ordely-core

# Install dependencies and start local development services
npm install
docker-compose up -d
```

---

## 🛠️ Development

This repository contains the Ordely web app: a NestJS API, a Next.js dashboard and landing page, and PostgreSQL.

| Service    | Stack                  | Default URL                 |
| ---------- | ---------------------- | --------------------------- |
| `frontend` | Next.js 15             | http://localhost:3200       |
| `backend`  | NestJS 10 + Prisma 6   | http://localhost:3001/api   |
| `db`       | PostgreSQL 16          | `localhost:5433`            |
| `mailpit`  | Mailpit (dev inbox)    | http://localhost:8025       |

### Run everything with Docker

```bash
docker compose up -d
```

This is **development mode** (from `docker-compose.override.yml`, which Docker Compose merges
automatically): your `backend/` and `frontend/` folders are mounted into the containers, which run
`nest start --watch` and `next dev`, so a saved file is live in a few seconds. Add `--build` (plus
`-V` to refresh `node_modules`) only after changing a `package.json`.

For the **production** images, where the code is copied in at build time and changes only show up
after a rebuild, name the base file explicitly:

```bash
docker compose -f docker-compose.yml up -d --build
```

A root `.env` with `JWT_SECRET` is required (see [.env.example](.env.example));
host ports, database name and credentials can be overridden there too. Data is kept in the `db-data` volume;
`docker compose down -v` wipes it.

### Local development

Run only the database in Docker and the apps on your machine:

```bash
docker compose up -d db

# backend
cd backend && npm install && npm run prisma:deploy && npm run start:dev

# frontend, in another terminal
cd frontend && npm install && npm run dev
```

The backend reads `DATABASE_URL` and `JWT_SECRET` from `backend/.env`. The frontend reaches the
backend server-side using `BACKEND_URL` from `frontend/.env.local`.

### Database (Prisma)

The schema lives in `backend/prisma/schema.prisma`. After changing it:

```bash
cd backend
npm run prisma:migrate -- --name <change-name>   # creates + applies a migration
npm run prisma:studio                            # browse the data
```

The Docker backend applies pending migrations (`prisma migrate deploy`) on startup.

Demo data (≈60 days of orders and confirmation calls; users are never touched):

```bash
cd backend
npm run db:seed              # only runs on an empty orders table
npm run db:seed -- --reset   # replaces ALL orders and calls
```

In development, `start:dev` and `docker compose up` automatically seed the back-office demo
merchants when the database has no boutiques. Existing data is left untouched.

### Authentication

- Users sign up at `/register` and log in at `/login`; `/dashboard` and `/orders` require a session.
- The backend issues a JWT (`JWT_EXPIRES_IN` seconds, default 1 day). The frontend stores it in an
  HttpOnly `ordely_session` cookie and sends it as a Bearer token on server-side API calls.
- Every API route requires `Authorization: Bearer <token>` except `/api/health` and `/api/auth/*`.
- Login and register are rate-limited per email (10 and 5 attempts per minute).
- A new account is closed until its email address is confirmed: sign-up sends a link (valid 24 h,
  single use) and every API route except `/auth/me`, `/auth/resend-verification` and
  `/auth/avatar` answers `403 Email address not verified` until then. In development the emails land
  in Mailpit (http://localhost:8025); set `SMTP_*` and `APP_URL` to send real ones.

### Back office (`/admin`, Ordely team only)

An internal dashboard of all merchants: overview KPIs and MRR, activation funnel, usage, call
quality, revenue and unit economics, a merchants table with a health score, weekly cohorts, and
CSV exports. Merchants never see it: the API answers `403` on `/api/admin/*` and the frontend sends
them back to `/dashboard`.

- **Become an admin:** set `ADMIN_EMAIL` (root `.env`) and restart the backend. The account with
  that address gets `users.isPlatformAdmin` at startup. If it doesn't exist yet and `ADMIN_PASSWORD`
  is set, it is created (verified, with an empty shop). Then log in at `/login` and open `/admin`
  (or **Back office** in the user menu). Revoke access in the database.
- **Plans and prices** live in `backend/src/admin/plans.ts`; a shop's plan is
  `boutiques.plan` (null = free), with `planStartedAt` and `churnedAt`.
- **Unit economics** use `COST_PER_MINUTE` and `COST_PER_CALL` (TND, estimates).
- **Demo data (dev only):** `cd backend && npm run db:seed:demo` creates 45 demo merchants
  (`@demo.ordely.test`) with several weeks of orders and calls. Re-running replaces them; it
  refuses to run when `NODE_ENV` is production or the database isn't local.

### Plans and payment

The last onboarding screen, **Votre forfait** (`/onboarding/plan`), recommends the plan that fits
the daily order volume the merchant declared, lets them pick one, and takes the first month's
payment for a paid plan before the app opens. The free plan needs no payment.

- **Catalogue**: `backend/src/admin/plans.ts` (Free / Starter / Growth / Pro, monthly price in TND
  and call quota). The recommendation rule is in `backend/src/billing/billing.rules.ts`.
- **API**: `GET /api/billing/plans` (catalogue, recommended and current plan) and
  `POST /api/billing/subscribe` `{ plan, paymentToken? }`. Every attempt is stored in `payments`;
  the shop's plan (`boutiques.plan`, `planStartedAt`) only changes after a successful charge.
- **Provider**: `PAYMENTS_PROVIDER`. Empty = paid plans can't be bought. `simulated` = **test
  mode**: no money moves, only the test cards on the screen work (4242 4242 4242 4242 succeeds,
  4000 0000 0000 0002 is declined). It is the development default and is refused when
  `NODE_ENV=production`. A real gateway (Konnect, Flouci) implements the `PaymentProvider`
  interface in `backend/src/billing/payment-provider.ts`.
- **Card data never reaches Ordely**: the browser turns the card into a token
  (`frontend/src/lib/payment.ts`) and only the token is sent; `payments` keeps the brand and last
  four digits.

### Voice agent (Ringio)

The AI that calls customers lives in a separate repository,
[Ringio](https://github.com/HadricheAymen/Ringio), cloned locally into `Ringio/` (ignored by
git). Ordely and the agent talk over HTTP:

```
"Call now" ─► calls row (pending) ─► dispatcher (backend/src/voice) ── POST /api/task/start ─► agent :4200
                                                                                                 │ phone call
order confirmed/cancelled ◄─ Ordely decides ◄── /api/internal/voice/{events,transcript,recordings,result} ◄─┘
```

- **Dispatcher**: every 5 s, hands the oldest queued call to the agent (one at a time, within the
  shop's call hours). Off unless `VOICE_DISPATCH_ENABLED=true`. Every call goes to
  `VOICE_TEST_DESTINATION`, Ringio's simulated test number, never to a real customer.
- **Callbacks**: public routes authenticated by the shared secret `VOICE_CALLBACK_SECRET`. The
  transcript and both recordings (MinIO) appear on the call in Call Logs.
- **Decision**: only a clear `CONFIRMED`/`CANCELLED` with confidence ≥ `VOICE_MIN_CONFIDENCE`
  changes the order. Anything else leaves it pending (the call shows "No answer"). A call that
  never reports back is closed after `VOICE_CALL_TIMEOUT_MINUTES`.
- The agent needs the changes in `docs/integrations/ringio-ordely-task.patch` (order passed to
  Gemini, `report_decision` function, real result instead of "confirmed"). In `Ringio/`:
  `git apply ../docs/integrations/ringio-ordely-task.patch`.

**Test without a phone** (the fake agent replays a scripted call through the real callbacks):

```bash
# root .env: VOICE_DISPATCH_ENABLED=true, VOICE_AGENT_TOKEN and VOICE_CALLBACK_SECRET set
docker compose up -d backend
cd backend && npm run voice:fake-agent                 # FAKE_SCENARIO=yes|no|unclear|no_answer|random
# then "Call now" on a pending order: the order is confirmed within a few seconds
```

**Test with the real agent** (Node 22+, an Android phone on the same Wi-Fi, a Gemini API key):

1. `Ringio/mock-external-service/.env`: set `GEMINI_API_KEY`. Its `AGENT_SERVICE_TOKEN` and
   `ORDELY_CALLBACK_SECRET` must equal Ordely's `VOICE_AGENT_TOKEN` and `VOICE_CALLBACK_SECRET`.
2. `cd Ringio/voip-call-server && npm install && npm start` (port 4100).
3. Phone: `cd Ringio/voip-mobile-app && npm install && npm run android` (first time), then
   `npm run start:local`; keep the app open.
4. `cd Ringio/mock-external-service && npm install && npm start` (port 4200).
5. Root `.env`: `VOICE_DISPATCH_ENABLED=true`, then `docker compose up -d backend`.
6. In Ordely, "Call now" on a pending order: the phone rings, answer and speak as the customer.

### API

- `GET /api/health` — reports app and database status (public)
- `POST /api/auth/register` `{ email, name, password, accentColor?, themeMode? }` (`accentColor` is `#rrggbb`, `themeMode` is `system`, `light` or `dark`) · `POST /api/auth/login` `{ email, password }` (public)
- `POST /api/auth/verify-email` `{ token }` (public) · `POST /api/auth/resend-verification` (one per minute)
- `GET /api/auth/me` · `PATCH /api/auth/appearance` `{ accentColor?, themeMode? }` (`accentColor: null` goes back to the Ordely blue)
- `GET /api/dashboard/summary` — 30-day stats, 7-day confirmations, recent calls, pending orders
- `GET /api/calls?status=&search=&range=today|7d|30d|all&page=` · `GET /api/calls/export` (CSV) · `GET /api/calls/:id`
- `POST /api/calls` `{ orderId }` queues a call · `POST /api/calls/queue-pending` · `GET /api/calls/usage`
- `GET /api/orders` · `POST /api/orders` `{ customer, phone, item, quantity, total }`
- `GET /api/orders/:id` · `PATCH /api/orders/:id` `{ status }` · `DELETE /api/orders/:id`

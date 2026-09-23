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

### Run everything with Docker

```bash
docker compose up -d --build
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

### Authentication

- Users sign up at `/register` and log in at `/login`; `/dashboard` and `/orders` require a session.
- The backend issues a JWT (`JWT_EXPIRES_IN` seconds, default 1 day). The frontend stores it in an
  HttpOnly `ordely_session` cookie and sends it as a Bearer token on server-side API calls.
- Every API route requires `Authorization: Bearer <token>` except `/api/health` and `/api/auth/*`.
- Login and register are rate-limited per email (10 and 5 attempts per minute).

### API

- `GET /api/health` — reports app and database status (public)
- `POST /api/auth/register` `{ email, name, password }` · `POST /api/auth/login` `{ email, password }` (public)
- `GET /api/auth/me`
- `GET /api/dashboard/summary` — 30-day stats, 7-day confirmations, recent calls, pending orders
- `GET /api/calls?status=&search=&range=today|7d|30d|all&page=` · `GET /api/calls/export` (CSV) · `GET /api/calls/:id`
- `POST /api/calls` `{ orderId }` queues a call · `POST /api/calls/queue-pending` · `GET /api/calls/usage`
- `GET /api/orders` · `POST /api/orders` `{ customer, phone, item, quantity, total }`
- `GET /api/orders/:id` · `PATCH /api/orders/:id` `{ status }` · `DELETE /api/orders/:id`

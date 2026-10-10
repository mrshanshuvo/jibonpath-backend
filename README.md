<h1 align="center">🚑 Emergency Ambulance Dispatch System</h1>

<p align="center">
  <strong>A production-grade RESTful API backend for dispatching emergency ambulances, managing hospitals, tracking trips, and processing payments.</strong>
</p>

<p align="center">
  <a href="https://ambulance-dispatch-backend-66f2.onrender.com/health">
    <img src="https://img.shields.io/badge/status-live-brightgreen?style=flat-square" alt="Live Status" />
  </a>
  <a href="https://github.com/mrshanshuvo/ambulance-dispatch-backend/actions/workflows/ci.yml">
    <img src="https://github.com/mrshanshuvo/ambulance-dispatch-backend/actions/workflows/ci.yml/badge.svg" alt="CI Pipeline" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-24.x-339933?style=flat-square&logo=node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Prisma-7.10-2D3748?style=flat-square&logo=prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Stripe-Payment-635BFF?style=flat-square&logo=stripe" />
</p>

---

## 🌐 Live URLs

| Resource         | URL                                                         |
| ---------------- | ----------------------------------------------------------- |
| **API Base**     | https://ambulance-dispatch-backend-66f2.onrender.com        |
| **Health Check** | https://ambulance-dispatch-backend-66f2.onrender.com/health |
| **Postman Docs** | https://documenter.getpostman.com/view/47434753/2sBYAvwWcJ  |
| **GitHub**       | https://github.com/mrshanshuvo/ambulance-dispatch-backend   |

---

## ✨ Features

- **JWT Authentication** — Register, Login, Refresh Token, Logout with secure httpOnly-ready tokens
- **Google OAuth 2.0** — Single sign-on via Google
- **Role-Based Access Control (RBAC)** — `PATIENT`, `DRIVER`, `ADMIN` roles with route-level enforcement
- **Ambulance Management** — Full CRUD with status tracking (`AVAILABLE`, `DISPATCHED`, `MAINTENANCE`, `RETIRED`)
- **Driver Management** — Register drivers, assign ambulances, availability filtering
- **Hospital Management** — Public searchable hospital directory with geolocation support
- **Emergency Request System** — Patient creates CRITICAL/HIGH/MEDIUM/LOW priority requests
- **Dispatch Engine** — Atomic DB transactions prevent double-booking of ambulances/drivers
- **Trip Status Machine** — 6-stage status progression: `DISPATCHED → EN_ROUTE → PATIENT_PICKUP → HOSPITAL_SELECTED → HOSPITAL_ARRIVAL → COMPLETED`
- **Audit Logging** — Every create/update/delete action is logged with actor, entity, and metadata
- **Stripe Payment Integration** — Hosted checkout sessions, webhook-driven payment confirmation
- **bKash Tokenized Checkout** — Direct tokenized PGW integration (create, execute, refund)
- **SSLCommerz Hosted Gateway** — IPN webhooks, secure transaction validation & callback handling
- **Redis Caching** — High-performance caching on admin stats with graceful database fallback
- **Auth Rate Limiting** — Dedicated rate limiting on login/register endpoints preventing brute-force
- **Soft Deletes** — All critical records use `deletedAt` instead of hard deletes
- **Pagination** — All list endpoints support `?page=&limit=` with total/totalPages metadata

---

## 🏗️ Tech Stack

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| **Runtime**        | Node.js 24.x                                    |
| **Framework**      | Express.js 4.x                                  |
| **Language**       | TypeScript 5.4 (strict mode)                    |
| **ORM**            | Prisma 7.10                                     |
| **Database**       | PostgreSQL (Neon serverless)                    |
| **Cache**          | Redis (ioredis / Redis Cloud)                   |
| **Authentication** | JWT (jsonwebtoken) + Passport.js (Google OAuth) |
| **Validation**     | Zod                                             |
| **Payment**        | Stripe v22, bKash Tokenized, SSLCommerz         |
| **Testing**        | Vitest (Unit, Integration, E2E)                 |
| **Security**       | Helmet, CORS, express-rate-limit                |
| **Linting**        | Biome (2-space indent, double quotes)           |
| **Hosting**        | Render (auto-deploy from GitHub)                |

---

## 📁 Project Structure

```
src/
├── app.ts                    # Express app setup, middleware, route mounts
├── server.ts                 # HTTP server entry point
├── config/
│   ├── db.ts                 # Prisma client singleton
│   ├── env.ts                # Centralized type-safe environment config
│   ├── passport.ts           # Google OAuth strategy
│   └── stripe.ts             # Stripe SDK singleton
├── middlewares/
│   ├── auth.middleware.ts     # JWT authentication guard
│   ├── rbac.middleware.ts     # Role-based authorization
│   ├── validate.middleware.ts # Zod schema validation
│   └── errorHandler.middleware.ts
├── modules/
│   ├── auth/                 # Register, Login, Google OAuth, Token Refresh
│   ├── user/                 # Profile management
│   ├── ambulance/            # Ambulance CRUD
│   ├── driver/               # Driver registration & management
│   ├── hospital/             # Hospital directory
│   ├── request/              # Emergency request lifecycle
│   ├── dispatch/             # Dispatch engine + status machine
│   ├── payment/              # Stripe checkout + webhook
│   └── admin/                # Admin user management + audit logs
├── utils/
│   ├── AppError.ts           # Custom error class
│   ├── asyncHandler.ts       # Async wrapper for controllers
│   ├── auditLogger.ts        # Audit trail utility
│   ├── pagination.ts         # Pagination helpers
│   └── response.ts           # Unified sendSuccess / sendError helpers
├── types/
│   └── express.d.ts          # Express.Request user type augmentation
└── prisma/
    └── seed.ts               # Database seeder
```

---

## 🗄️ Database Schema

```
User ──< EmergencyRequest ──< Dispatch >── Ambulance
                         └──< Payment    └── Driver
                                          └── Hospital
                                          └──< TripStatusLog
User ──< AuditLog
Driver ──< Dispatch
```

**Entities:** `User`, `Driver`, `Ambulance`, `Hospital`, `EmergencyRequest`, `Dispatch`, `TripStatusLog`, `Payment`, `AuditLog`

---

## 🚀 API Reference

### Authentication (`/api/v1/auth`)

| Method | Endpoint           | Auth   | Description                            |
| ------ | ------------------ | ------ | -------------------------------------- |
| `POST` | `/register`        | Public | Register new patient account           |
| `POST` | `/login`           | Public | Login with email & password            |
| `POST` | `/refresh-token`   | Public | Get new access token via refresh token |
| `POST` | `/logout`          | Bearer | Logout and invalidate refresh token    |
| `GET`  | `/google`          | Public | Initiate Google OAuth2 flow            |
| `GET`  | `/google/callback` | Public | Google OAuth2 callback                 |

### Users (`/api/v1/users`)

| Method  | Endpoint     | Auth   | Description                              |
| ------- | ------------ | ------ | ---------------------------------------- |
| `GET`   | `/me`        | Bearer | Get my profile                           |
| `PATCH` | `/me`        | Bearer | Update my profile (name, phone, address) |
| `POST`  | `/me/avatar` | Bearer | Upload profile picture via Cloudinary    |

### Ambulances (`/api/v1/ambulances`)

| Method   | Endpoint | Auth   | Description                                         |
| -------- | -------- | ------ | --------------------------------------------------- |
| `GET`    | `/`      | Public | List all ambulances (`?status=&type=&page=&limit=`) |
| `GET`    | `/:id`   | Public | Get ambulance by ID                                 |
| `POST`   | `/`      | ADMIN  | Create ambulance                                    |
| `PATCH`  | `/:id`   | ADMIN  | Update ambulance                                    |
| `DELETE` | `/:id`   | ADMIN  | Soft delete ambulance                               |

### Drivers (`/api/v1/drivers`)

| Method   | Endpoint | Auth   | Description                                     |
| -------- | -------- | ------ | ----------------------------------------------- |
| `GET`    | `/me`    | DRIVER | My driver profile + vehicle assignment          |
| `GET`    | `/`      | ADMIN  | List drivers (`?isAvailable=true&page=&limit=`) |
| `GET`    | `/:id`   | ADMIN  | Get driver by ID                                |
| `POST`   | `/`      | ADMIN  | Register driver (auto-promotes user role)       |
| `PATCH`  | `/:id`   | ADMIN  | Update driver                                   |
| `DELETE` | `/:id`   | ADMIN  | Soft delete driver                              |

### Hospitals (`/api/v1/hospitals`)

| Method   | Endpoint | Auth   | Description                                 |
| -------- | -------- | ------ | ------------------------------------------- |
| `GET`    | `/`      | Public | List hospitals (`?name=dhaka&page=&limit=`) |
| `GET`    | `/:id`   | Public | Get hospital by ID                          |
| `POST`   | `/`      | ADMIN  | Create hospital                             |
| `PATCH`  | `/:id`   | ADMIN  | Update hospital                             |
| `DELETE` | `/:id`   | ADMIN  | Soft delete hospital                        |

### Emergency Requests (`/api/v1/requests`)

| Method  | Endpoint      | Auth          | Description                                      |
| ------- | ------------- | ------------- | ------------------------------------------------ |
| `POST`  | `/`           | PATIENT       | Create emergency request                         |
| `GET`   | `/my`         | PATIENT       | My request history                               |
| `GET`   | `/`           | ADMIN         | All requests (`?status=&priority=&page=&limit=`) |
| `GET`   | `/:id`        | Bearer        | Get request detail (with dispatch + payment)     |
| `PATCH` | `/:id/cancel` | PATIENT/ADMIN | Cancel a PENDING request                         |

### Dispatch (`/api/v1/dispatches`)

| Method  | Endpoint      | Auth         | Description                                                |
| ------- | ------------- | ------------ | ---------------------------------------------------------- |
| `POST`  | `/`           | ADMIN        | Dispatch ambulance (atomic transaction)                    |
| `GET`   | `/`           | ADMIN/DRIVER | List dispatches (`?status=&page=&limit=`; Driver sees own) |
| `GET`   | `/my-active`  | DRIVER       | Get driver's current ongoing assigned dispatch             |
| `GET`   | `/:id`        | ADMIN/DRIVER | Get dispatch + trip status timeline                        |
| `PATCH` | `/:id/status` | DRIVER/ADMIN | Advance trip status                                        |

### Payments (`/api/v1/payments`)

| Method | Endpoint               | Auth          | Description                                                 |
| ------ | ---------------------- | ------------- | ----------------------------------------------------------- |
| `GET`  | `/fare/:requestId`     | PATIENT/ADMIN | Itemized GPS fare estimate quotation                        |
| `GET`  | `/my`                  | PATIENT/ADMIN | Payment history (`?status=&page=&limit=`; Admin sees fleet) |
| `GET`  | `/:requestId`          | PATIENT/ADMIN | Get payment status by request ID                            |
| `POST` | `/stripe/checkout`     | PATIENT       | Create Stripe checkout session                              |
| `POST` | `/stripe/webhook`      | Stripe Signed | Handle Stripe payment events                                |
| `POST` | `/bkash/create`        | PATIENT       | Create bKash payment URL (Tokenized PGW)                    |
| `POST` | `/bkash/execute`       | PATIENT       | Execute & capture bKash payment                             |
| `POST` | `/sslcommerz/initiate` | PATIENT       | Initialize SSLCommerz hosted session                        |
| `POST` | `/sslcommerz/success`  | Public        | SSLCommerz success return & validation                      |
| `POST` | `/sslcommerz/fail`     | Public        | SSLCommerz fail return                                      |
| `POST` | `/sslcommerz/cancel`   | Public        | SSLCommerz cancellation return                              |
| `POST` | `/sslcommerz/ipn`      | Public        | SSLCommerz IPN background validation                        |

### Admin (`/api/v1/admin`)

| Method   | Endpoint            | Auth  | Description                                                                          |
| -------- | ------------------- | ----- | ------------------------------------------------------------------------------------ |
| `POST`   | `/drivers`          | ADMIN | Direct driver onboarding                                                             |
| `GET`    | `/users`            | ADMIN | List users (`?search=&role=&page=&limit=`)                                           |
| `PATCH`  | `/users/:id/role`   | ADMIN | Update user role (`PATIENT`, `DRIVER`, `ADMIN`)                                      |
| `PATCH`  | `/users/:id/status` | ADMIN | Toggle user active/deactive status (`isActive`)                                      |
| `DELETE` | `/users/:id`        | ADMIN | Soft delete user                                                                     |
| `GET`    | `/audit-logs`       | ADMIN | View audit trail (`?action=&entityType=&page=&limit=`, e.g. `?action=UPDATE_STATUS`) |
| `GET`    | `/stats`            | ADMIN | View cached dashboard statistics & summary metrics                                   |

---

## ⚙️ Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or a [Neon](https://neon.tech) database URL)
- A [Stripe](https://stripe.com) account (test mode)
- A [Google Cloud](https://console.cloud.google.com) OAuth2 application

### 1. Clone the repository

```bash
git clone https://github.com/mrshanshuvo/jibonpath-backend.git
cd ambulance-dispatch-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

See the [Environment Variables](#-environment-variables) section below.

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. (Optional) Seed the database

```bash
npm run db:seed
```

### 6. Start the development server

```bash
npm run dev
```

Server runs at `http://localhost:5000`.

---

## 🔑 Environment Variables

```env
# ─── Server ───────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
DOCS_URL=https://github.com/mrshanshuvo/ambulance-dispatch-backend#readme

# ─── Database (Neon PostgreSQL) ───────────────────────────────────────────────
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

# ─── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=30d

# ─── Google OAuth 2.0 ─────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# ─── Stripe Payment ───────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Cloudinary (file uploads) ────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ─── Redis (optional — for future caching) ────────────────────────────────────
REDIS_URL=redis://default:password@host:port
```

---

## 🧪 Testing the API

- **Live Published Docs**: [https://documenter.getpostman.com/view/47434753/2sBYAvwWcJ](https://documenter.getpostman.com/view/47434753/2sBYAvwWcJ) (Includes interactive "Run in Postman" button)
- **Local File**: Import [`docs/postman_collection.json`](./docs/postman_collection.json) directly into [Postman](https://postman.com).

The collection is organized into **9 numbered folders** (00–09) covering all modules. Test scripts automatically save tokens and IDs between requests.

**Recommended test flow:**

1. `01. Auth Module` → Register + Login (tokens auto-saved)
2. `03. Ambulance Module` → Create ambulance (ID auto-saved)
3. `04. Driver Module` → Register driver (ID auto-saved)
4. `05. Hospital Module` → Create hospital
5. `06. Emergency Request Module` → Create request as PATIENT (ID auto-saved)
6. `07. Dispatch Module` → Dispatch ambulance as ADMIN
7. `07. Dispatch Module` → Advance to `EN_ROUTE` → `COMPLETED` as DRIVER
8. `09. Payment Module` → Create checkout session → open `checkoutUrl` in browser → pay with test card `4242 4242 4242 4242`

---

## 💳 Stripe Payment Flow

```
PATIENT  →  POST /payments/checkout  →  Stripe Checkout Page
                                              ↓ (test card 4242...)
Stripe   →  POST /payments/webhook   →  Payment marked SUCCESS
                                              ↓
                                     EmergencyRequest → COMPLETED
```

**To test Stripe webhooks locally:**

```bash
# Install Stripe CLI (https://stripe.com/docs/stripe-cli)
stripe login
stripe listen --forward-to localhost:5000/api/v1/payments/webhook

# In another terminal, trigger an event:
stripe trigger checkout.session.completed
```

---

## 🇧🇩 bKash Tokenized Checkout Flow

```
PATIENT  →  POST /payments/bkash/create   →  bKash Sandbox Payment Page (bkashURL)
                                                  ↓ (Enter Sandbox Wallet, OTP, PIN)
PATIENT  →  POST /payments/bkash/execute  →  Payment captured (trxID recorded)
                                                  ↓
                                         EmergencyRequest → COMPLETED
```

### 🧪 bKash Sandbox Test Credentials & Wallets

| Key                               | Sandbox Test Value                                         |
| :-------------------------------- | :--------------------------------------------------------- |
| **API Version**                   | `v1.2.0-beta` (Tokenized Checkout)                         |
| **Base URL**                      | `https://tokenized.sandbox.bka.sh/v1.2.0-beta`             |
| **Active Wallets (Success)**      | `01770618575`, `01929918378`, `01770618576`, `01877722345` |
| **Wallet (Insufficient Balance)** | `01823074817`                                              |
| **Wallet (Debit Block)**          | `01823074818`                                              |
| **OTP**                           | `123456`                                                   |
| **PIN**                           | `12121`                                                    |

---

## 📜 Available Scripts

```bash
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # prisma generate + tsc (production build)
npm start            # Start compiled dist/ server
npm run db:migrate   # Run Prisma migrations
npm run db:generate  # Regenerate Prisma client
npm run db:seed      # Seed the database
npm run db:studio    # Open Prisma Studio GUI
npm run lint         # Check code with Biome
npm run lint:fix     # Auto-fix lint issues with Biome
npm run format       # Format source files with Biome
npm test             # Run test suite (Vitest - Unit, Integration & E2E)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

---

## 🔐 RBAC Permission Matrix

| Endpoint Group                | PATIENT  | DRIVER    | ADMIN |
| ----------------------------- | -------- | --------- | ----- |
| Auth                          | ✅       | ✅        | ✅    |
| User Profile (own)            | ✅       | ✅        | ✅    |
| Ambulances (read)             | ✅       | ✅        | ✅    |
| Ambulances (write)            | ❌       | ❌        | ✅    |
| Drivers (read)                | ❌       | Self only | ✅    |
| Drivers (write)               | ❌       | ❌        | ✅    |
| Hospitals (read)              | ✅       | ✅        | ✅    |
| Hospitals (write)             | ❌       | ❌        | ✅    |
| Emergency Requests (create)   | ✅       | ❌        | ❌    |
| Emergency Requests (read all) | ❌       | ❌        | ✅    |
| Emergency Requests (read own) | ✅       | ❌        | ✅    |
| Emergency Requests (cancel)   | Own only | ❌        | ✅    |
| Dispatch (create)             | ❌       | ❌        | ✅    |
| Dispatch (status update)      | ❌       | ✅        | ✅    |
| Payments                      | Own only | ❌        | ✅    |
| Admin Panel                   | ❌       | ❌        | ✅    |

---

## 🚢 Deployment

The API is hosted on **Render** and auto-deploys on every push to `main`.

**Build command:** `npm install && npm run build`  
**Start command:** `node dist/server.js`

Ensure all environment variables from the [Environment Variables](#-environment-variables) section are configured in the Render dashboard under **Environment** settings.

---

## 📄 License

[MIT](./LICENSE)

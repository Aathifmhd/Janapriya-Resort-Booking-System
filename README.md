# Janapriya Resort Management System

A complete, single-install management system for Janapriya Resort covering the **public booking website**, **front desk**, **restaurant & bar POS**, **inventory with empty-bottle tracking**, **HR & payroll**, and **finance**.

- Backend: Node.js 22+ + Express 5 + PostgreSQL (Neon serverless Postgres, free tier)
- Frontend: React 18 + Vite + Tailwind CSS 4 + Framer Motion + Recharts
- Auth: JWT with role-based access per module

## Project structure

```
frontend/    React + Vite website and staff portal (own package.json)
backend/     Express API, database schema and demo seed (own package.json, .env)
vercel.json  Deploys both folders as one Vercel project
Dockerfile   One container for other hosts
package.json Shortcuts that run both folders from the root
```

Each folder is a standalone Node project: you can `cd` into it and use `npm install` and `npm run dev` there on its own.

## Quick start

```bash
npm install                                # installs the root tool plus backend/ and frontend/ packages
copy backend\.env.example backend\.env     # then paste your Neon DATABASE_URL and a JWT_SECRET into backend/.env
npm run seed                               # creates the tables and loads demo data (first time only)
npm run dev                                # API on http://localhost:4000, website on http://localhost:5173
```

Production (single server serves the API and the built site):

```bash
npm run build
npm start            # http://localhost:4000
```

Tables are created automatically on first request. `npm run seed` wipes the database and reloads the demo data.

## Demo logins (staff portal: `/admin`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@janapriya.lk | admin123 |
| Manager | manager@janapriya.lk | manager123 |
| Front desk | frontdesk@janapriya.lk | frontdesk123 |
| Restaurant | restaurant@janapriya.lk | restaurant123 |
| Bar | bar@janapriya.lk | bar123 |
| Housekeeping | housekeeping@janapriya.lk | housekeeping123 |
| HR | hr@janapriya.lk | hr123 |
| Accounts | accounts@janapriya.lk | accounts123 |

Change these from **Users & Roles** before going live.

## Modules

### Customer website (`/`)
Animated home page, rooms & villas, restaurant/bar menu with table-reservation requests, 4-step online booking wizard with live availability, and *My Booking* lookup / cancellation by reference + phone or email. Online bookings are limited to 30 nights, up to 365 days ahead, and 5 per visitor per hour (see `backend/src/routes/public.js`).

### Front desk
Bookings (arrivals, in-house, departures, website requests), 14-day room tape chart, live room status board, room types & rates, guest CRM with stay history, housekeeping & maintenance work orders. Check-in / check-out with folio, extra charges, payments, balance control and automatic invoice.

### Restaurant & bar
Floor plan with table status per area, touch POS (send to kitchen, cancel items, discounts, cash/card settle, charge to room folio), orders list, kitchen/bar display board, menu & categories linked to stock, table reservations.

### Inventory
Stock items by category/location, purchases (goods received notes) that add stock and update cost, supplier ledger with outstanding balances, full movement audit trail, stock adjustments (wastage, breakage, transfer), **empty bottle management** (empties auto-created on sale of returnable bottles, returns to supplier with deposit recovery, breakage/loss posted as expense).

### Human resources
Employees & departments & shifts, daily attendance register with check-in/out and overtime, leave requests (approval writes to attendance), payroll generation from attendance with EPF 8/12 % and ETF 3 %, payslips, salary payment posts expenses.

### Finance
Invoices (room / restaurant / bar) with print view, payments received by method, expenses, reports: revenue by outlet, 12-month trend, P&L statement with COGS, occupancy, ADR, top items, booking sources.

### System
Settings (resort profile, website hero text, tax / service charge, payroll rates), users & roles, audit log.

## Deploying (Vercel + Neon, free)

One Vercel project runs both folders as [Vercel Services](https://vercel.com/docs/services) (`vercel.json`). `frontend/` is built with Vite and serves the website on `/`. `backend/` runs the Express app (`backend/src/app.js`) as a function on `/api/*`. Both share one domain, so the website calls the API without any extra setup. Data lives in a Neon Postgres database.

1. Create a free Postgres database at https://neon.tech and copy its connection string.
2. On https://vercel.com click **Add New > Project**, import `Aathifmhd/Janapriya-Resort-Booking-System` and keep the root directory as `/` (do not pick `frontend` or `backend`; `vercel.json` points at both).
3. Under **Environment Variables** add these (both services can read them):
   - `DATABASE_URL` = the Neon connection string
   - `JWT_SECRET` = any long random string
4. Click **Deploy**. Then run `npm run seed` locally once with the same `DATABASE_URL` in `backend/.env` to load the demo data (or create everything by hand in the portal).
5. Add your domain under the project's **Settings > Domains**.

Vercel Services is in Beta. Push to a branch first and check its Preview deployment before deploying to production.

Customers book at `https://yourdomain/book`, staff sign in at `https://yourdomain/admin`.

### Other hosts
The included `Dockerfile` builds `frontend/` and runs `backend/` in one container on Railway, Render, Fly.io or a VPS. Set `DATABASE_URL` and `JWT_SECRET` as environment variables; no disk is needed because the data is in Neon.

Environment variables: `DATABASE_URL` (required), `JWT_SECRET` (required), `PORT` (default 4000).

Dates ("today", reports, invoice dates) follow Sri Lanka time. To change the time zone, edit `TIMEZONE` in `backend/src/db.js` and `frontend/src/lib/format.js`.

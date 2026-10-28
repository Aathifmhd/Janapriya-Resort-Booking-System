# Janapriya Resort Management System

A complete, single-install management system for Janapriya Resort covering the **public booking website**, **front desk**, **restaurant & bar POS**, **inventory with empty-bottle tracking**, **HR & payroll**, and **finance**.

- Backend: Node.js 24 + Express 5 + SQLite (built-in `node:sqlite`, no native build, no external DB)
- Frontend: React 18 + Vite + Tailwind CSS 4 + Framer Motion + Recharts
- Auth: JWT with role-based access per module

## Quick start

```bash
npm install          # installs root, server and client dependencies
npm run dev          # API on http://localhost:4000, website on http://localhost:5173
```

Production (single server serves the API and the built site):

```bash
npm run build
npm start            # http://localhost:4000
```

The database is created and seeded with demo data on first run at `server/data/janapriya.db`.
To reset to fresh demo data: `npm run seed`.

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
Animated home page, rooms & villas, restaurant/bar menu with table-reservation requests, 4-step online booking wizard with live availability, and *My Booking* lookup / cancellation by reference + phone or email.

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

## Configuration

Environment variables (optional): `PORT` (default 4000), `JWT_SECRET` (set a strong value in production), `DB_PATH`.

## Deploying with a domain

1. `npm install && npm run build` on the server.
2. Run `npm start` under a process manager (pm2, NSSM on Windows, or systemd).
3. Point your domain at the server and put it behind HTTPS (Caddy or nginx reverse proxy to port 4000).
4. Customers book at `https://yourdomain/book`; staff sign in at `https://yourdomain/admin`.

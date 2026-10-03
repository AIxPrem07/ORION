# ORION — Phase 1 Task Tracker

## Milestone 0 — Project Foundation
- [x] Initialize Tauri 2.x + React + TypeScript + Vite project
- [x] Configure Tailwind CSS with ORION design system tokens
- [x] Set up ESLint + Prettier + Vitest
- [x] Configure Tauri plugins (sql, fs, shell, dialog, store, http, opener)
- [x] Write all SQL migrations (30 tables)
- [x] Write migration runner
- [x] Create design system base components (Button, Input, Select, Modal, Card, Table, Badge, Toast, etc.)
- [x] Create app shell (Sidebar, TopBar, PageHeader, AppShell, Router)
- [x] Write unit tests for decimal.ts, gst.service.ts, number-to-words.ts, invoice-number.ts

## Milestone 1 — Business Core
- [x] Business profile service & settings (Feature 2)
- [x] Customer management & editor (Feature 3)
- [x] Supplier management & editor (Feature 14)
- [x] Product management & editor (Feature 10)
- [x] Tax rate & unit seeding
- [x] Invoice sequence system (Feature 5)

## Milestone 2 — Billing Engine
- [x] GST calculation engine (Feature 4)
- [x] Invoice creation editor (Feature 1)
- [x] Invoice numbering
- [x] Invoice lifecycle (DRAFT -> FINALIZED -> CANCELLED)
- [x] PDF generation (Feature 6)
- [x] Print invoice (Feature 7)
- [x] Sales history (Feature 8)
- [x] Invoice duplication (Feature D)

## Milestone 3 — Inventory & Purchases
- [x] Inventory stock movement engine (Feature 9)
- [x] Purchase management & editor (Feature 13)
- [x] Stock reduction on invoice finalization
- [x] Stock addition on purchase finalization
- [x] Low stock alerts and movements audit

## Milestone 4 — Payments & Ledger
- [x] Payment recording (Feature 16)
- [x] Payment allocation & status updates
- [x] Ledger entries for customers and suppliers (Feature 15)
- [x] Customer/Supplier ledger views
- [x] Outstanding balance calculations

## Milestone 5 — Analytics & Reports
- [x] Dashboard with KPIs and recent activity (Feature 11)
- [x] Business analytics with Recharts monthly trends (Feature 17)
- [x] Product analytics with revenue rankings (Feature 19)
- [x] Reports hub

## Milestone 6 — Advanced Features
- [x] Invoice cancellation with automatic inventory/ledger reversal (Feature E/F)
- [x] WhatsApp sharing with pre-formatted message (Feature 12)
- [x] Global search ⌘K across invoices, customers, products (Feature A)
- [x] Keyboard shortcuts (Feature B)
- [x] Audit log viewer & tamper-evident audit service (Feature G)

## Milestone 7 — Backup & Polish
- [x] Local backup & restore commands in Rust (Feature 18)
- [x] Cloud backup S3 service (Feature 18)
- [x] App diagnostics & system commands (Feature K)
- [x] Error handling & user messages (Feature J)
- [x] Empty states across all modules (Feature I)
- [x] Full build verification (`npm run build`, `cargo check`, `cargo build`, `cargo test`, `npm test`)

## Milestone 8 — Advanced Business Extensions & Final Polish
- [x] Returns management & service (Sales Return & Purchase Return) (Feature E)
- [x] Credit Notes & Debit Notes issuance and ledger integration (Feature F)
- [x] Stock movement integration for returns (auto-restock & auto-deduct)
- [x] RFC-4180 CSV parser and generator
- [x] Customer bulk CSV import with validation & deduplication (Feature H)
- [x] Product bulk CSV import with opening stock generation (Feature H)
- [x] Full CSV export across Invoices, Purchases, Inventory, Customers, and Reports (Feature H)
- [x] Quick Create (+ New dropdown in TopBar) (Feature C)
- [x] Keyboard shortcuts expansion (⌘K, ⌘N, ⌘B, ?) & interactive cheat sheet modal (Feature B)
- [x] 52/52 Vitest unit tests passing
- [x] 0 TypeScript/Vite errors on production build

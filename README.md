# ORION — Enterprise ERP & Statutory GST Billing Software

<p align="center">
  <img src="public/logo.png" alt="ORION Logo" width="120" height="120" style="border-radius: 20%;" />
</p>

<p align="center">
  <strong>Next-Generation High-Performance Offline-First Desktop ERP for Modern Businesses</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.5.2-blue.svg?style=flat-square" alt="Version 1.5.2" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/tauri-v2-orange.svg?style=flat-square" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/react-18-blue.svg?style=flat-square" alt="React 18" />
  <img src="https://img.shields.io/badge/typescript-5.0-blue.svg?style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/sqlite-embedded-003B57.svg?style=flat-square" alt="SQLite" />
  <img src="https://img.shields.io/badge/license-Proprietary-red.svg?style=flat-square" alt="License" />
</p>

---

## 🌟 Overview

**ORION** is a commercial-grade, ultra-responsive enterprise billing and inventory management desktop application built for Indian businesses, wholesalers, manufacturers, and retailers. Engineered with a **local-first, zero-cloud dependency architecture**, ORION gives you complete control over your sensitive financial data with millisecond database speeds, 100% offline capability, and ironclad stability.

Powered by **Tauri v2**, **Rust**, **React 18**, and **SQLite**, ORION starts up instantly, consumes less than 80 MB of RAM, and generates statutory GST tax invoices and delivery challans adhering strictly to Indian GST laws.

---

## ✨ Key Features

### 🧾 1. Statutory GST Invoicing & Billing
* **Full GST Law Compliance**: Built strictly adhering to the Indian Goods and Services Tax Act and Rules. Supports **CGST + SGST** (Intra-state) and **IGST** (Inter-state).
* **Reverse Charge & Special Schemes**: Toggle Reverse Charge Mechanism (RCM), export supply, and composition schemes effortlessly.
* **Professional Print Engine**:
  * Standard **A4** and **US Letter** support.
  * Crisp borders and ultra-readable high-contrast typography.
  * Dynamic blank rows (minimum 10 rows per page) to ensure full-page elegance even for single-item bills.
  * Large dedicated signature & stamp verification box.
  * Custom top and bottom margins (up to 50 mm) for pre-printed letterheads.
* **UPI & Dynamic QR Code**: Automated NPCI-compliant UPI payment QR code generated on every invoice for instant customer checkout.
* **Invoice Lifecycle Management**: Draft, Issued, Cancelled, and a dedicated **Recycle Bin** for soft-deleting and restoring invoices with automatic ledger adjustments.

### 🚚 2. Rule 55 Delivery Challans
* **Non-Taxable Dispatch Management**: Generate Delivery Challans for job work, approval basis, exhibition, or inter-branch transfers without triggering GST tax liability.
* **Stock-Linked Only**: Adjusts inventory stocks automatically while keeping customer financial ledgers and cash inflow/outflow untouched.
* **Dedicated Challan PDF**: Clean, statutory format with clear dispatch notes, transporter information, and vehicle numbers.

### 📅 3. Financial Year (FY) Segregation
* **Automated FY Numbering**: Invoices and Challans automatically reset sequence numbering (starting from `1`) per Financial Year (e.g. `FY 2024-25`, `FY 2025-26`).
* **Global FY Context Switcher**: Seamlessly view historical sales, production analytics, and customer ledger records across past financial years.

### 📦 4. Real-Time Inventory & Warehouse Tracking
* **Comprehensive Product Catalog**: Manage SKUs, barcodes, HSN/SAC codes, tax rates, cost price, and selling price.
* **Unit Versatility**: Full support for custom units (Pcs, Nos, Kgs, Litres, Meters, Boxes, etc.).
* **Stock Movement History**: Complete audit trail of stock ins, outs, returns, and adjustments with an option to remove/edit entries.
* **Low Stock & Reorder Triggers**: Automatic alerts when stock drops below safety thresholds.

### 👥 5. Customer & Supplier Ledgers (CRM)
* **Double-Entry Party Ledgers**: Real-time debit/credit accounting with running balances.
* **Statement of Accounts**: Generate customer and supplier ledger statements with date-range filters and PDF exports.
* **GSTIN & PAN Validation**: Auto-detection of state codes and validation of 15-digit GSTINs.
* **Payment Recording**: Track partial and full payments via Cash, Bank Transfer (NEFT/RTGS/IMPS), UPI, or Cheque.

### 📊 6. GST Filing & Compliance Reports
* **GSTR-1 Preparation**: Summarized B2B, B2CL, B2CS, and HSN summary ready for portal filing.
* **GSTR-3B Tax Liability Breakdown**: Tax payable, input tax credit (ITC) offsets, and net tax payable.
* **Analytics Dashboard**: Daily, monthly, and yearly revenue graphs, gross margin tracking, and top-selling products.

### 🔒 7. Data Safety, Backup & Security
* **Embedded SQLite Database**: Self-healing migrations that guarantee data integrity across updates and operating systems.
* **One-Click Backup & Restore**: Export full encrypted JSON/SQL database backups to local storage or external USB drives.
* **Audit Logs**: Immutable log tracking every transaction creation, modification, and deletion.
* **Hardware-Bound Licensing**: Secure machine-locked offline license activation system.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://tauri.app/) (Rust 1.77+) |
| **Frontend UI** | [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/) |
| **State & Navigation** | Custom reactive hooks, Context API, Lucide React icons |
| **Database** | Embedded SQLite with resilient TS migration runners |
| **Document Generation** | [pdfmake](http://pdfmake.org/), Canvas QR generator |
| **Charts & Analytics** | [Recharts](https://recharts.org/) |
| **Testing** | [Vitest](https://vitest.dev/) (126 comprehensive unit tests) |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:
* **Node.js** (v18 or v20 LTS)
* **npm** or **pnpm**
* **Rust & Cargo** (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
* System build tools:
  * **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  * **Windows**: [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AIxPrem07/ORION.git
   cd ORION
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run the development application:**
   ```bash
   npm run tauri dev
   ```

4. **Run the test suite:**
   ```bash
   npm test
   ```

---

## 📦 Building for Production

### macOS (.dmg & .app)
Run the automated packaging script to generate both the compressed `.dmg` and portable `.zip`:
```bash
bash build-macos.sh
```
Output files will be generated in `dist-installer/`:
* `dist-installer/ORION_v1.5.2_macOS.dmg`
* `dist-installer/ORION-macOS-v1.5.2.zip`

### Windows (.exe & .msi)
To build on a Windows machine:
```bash
npm run tauri build
```
Or download pre-compiled installers directly from **[GitHub Actions Releases](https://github.com/AIxPrem07/ORION/actions)**.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Ctrl / Cmd + N` | New Invoice |
| `Ctrl / Cmd + P` | Print / Export Current Document |
| `Ctrl / Cmd + S` | Save Current Record |
| `Ctrl / Cmd + K` | Global Quick Search |
| `?` | Open Keyboard Shortcuts Modal |

---

## 📄 License & Attribution

&copy; 2026 **ORION INC.** All rights reserved.  
Architected and developed by **Prem Prajapati** ([@AIxPrem07](https://github.com/AIxPrem07)).  
Inquiries: `premprajapati.ai@gmail.com`

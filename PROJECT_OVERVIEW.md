# SPA CRM — Project Overview

Comprehensive documentation of the SPA CRM system for managing Thai massage salons.

## 📌 Project Concept
A specialized CRM for 3 spa salons (e.g., "Main Salon", "City Salon" and "One more in Chunzha") designed to automate the booking process, manage resources (rooms and therapists), and provide real-time business analytics. Current users had to use papers to make track of everything or excel sheets which was very inconvenient especially for such task as tracking bookings and revenue. Also it's hard to navigate through excel, since it's just a grid of cells, not something that has a great visual representation and ease of use for people who are not so close to the technology. Now they can use it on any device with an adaptive interface, also all data will be tracked in the dashboard. 

---

## 🛠 Technology Stack
- **Frontend**: React (Hooks, Context), Tailwind CSS (Aesthetics), Lucide React (Icons).
- **Backend/Database**: Supabase (Auth, Postgres DB, Row Level Security).
- **Analytics**: Custom SVG charts (MiniBar, MiniPie) for real-time KPI tracking.
- **Integration**: Node.js Telegram Bot for daily reports and instant notifications.
- **Environment**: Multi-salon setup with dynamic configuration.

---

## 🏗 System Architecture

### 1. Storage & Auth Layer
- **Supabase Integration**: All data is persisted in Supabase tables.
- **Storage Adapter**: A layer in `index.html` wraps Supabase calls to provide a unified `window.storage` API (CRUD operations with auto-mapping between camelCase and snake_case).
- **Security**: Row Level Security (RLS) ensures only authenticated users can access data, with role-based access for admins.

### 2. Core Modules
- **Schedule (Grid)**: Interaction-heavy booking calendar. Validates room and therapist availability in real-time.
- **Dashboard**: Real-time business intelligence with KPI cards and performance graphs.
- **Journal**: Searchable audit trail of all historical bookings with advanced filtering.
- **Workers Management**: Admin-only interface for managing personnel and activity logs.
- **Onboarding Wizard**: Step-by-step setup for new salons, rooms, and procedures.

---

## 📈 Key Metrics & Business Logic

### Business Logic
- **Booking Types**: Supports single procedures and complex "Combos" (sequential steps with different resources).
- **Resource Management**: 
    - **Rooms**: Multiple beds/rooms tracked per salon.
    - **Therapists**: Active therapist count vs. busy therapists per time slot.
    - **Shared Resources**: Sauna and Peeling capacity management.
- **Status Lifecycle**: `booked` 👋 `completed` / `no-show` / `cancelled` (with or without refund).
- **Payment Methods**: Cash, Card, Kaspi, and "Certificate/Deposit" (special handling).

### Performance Metrics (Dashboard)
- **Revenue**: Calculated from paid bookings (excludes "Certificate/Deposit" payments).
- **Average Check**: Total revenue divided by number of paid clients.
- **Utilization**:
    - **Room Load**: % of room-hours occupied by active bookings vs. total capacity.
    - **Therapist Load**: % of therapist-hours utilized vs. total available workforce.
- **Overdue Tracking**: Identifies "forgotten" bookings (past time, but status not updated).

---

## 🤖 Telegram Integration
- **Bot Commands**: `/start`, `/report` (manual summary), `/stop`.
- **Automated Reports**: Daily summaries sent to subscribers including:
    - Total Bookings & Clients.
    - Daily Revenue & Avg Check.
    - Salon Load Percentages.
- **Instant Notifications**: Alerts for new bookings, status changes, and cancellations.

---

## 🚀 Development Roadmap (Steps)
The project was built in 12 structured stages:
1.  **Foundation**: Basic React shell and Supabase adapter.
2.  **Onboarding**: Wizard for salon and room setup.
3.  **Procedures & Combos**: Management of services.
4.  **Booking Logic**: Complex validation and segment splitting.
5.  **Schedule (Day View)**: Vertical day grid.
6.  **Schedule (Multi-View)**: Week/Month/Custom period views.
7.  **Auth & Profiles**: Identity management.
8.  **Onboarding Finalization**: First-run experience.
9.  **Booking Details**: Sidebar for editing and deletion.
10. **Journal**: Global search and historical records.
11. **Dashboard**: Analytics and visual charts.
12. **Export/Import**: Data portability.

---

## 📂 Project Structure
- `app.jsx`: Core application logic and UI components.
- `index.html`: Entry point and Supabase storage adapter.
- `bot.js`: Telegram bot implementation.
- `server.js`: Local development server (Node.js).
- `supabase-migration.sql`: Database schema and RLS policies.
- `Steps/`: Original developmental blueprints for each module.

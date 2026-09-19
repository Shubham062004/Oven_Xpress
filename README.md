# Oven Xpress

Multi-branch restaurant management system for centralized operations, staff, inventory, orders, and analytics.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript (strict mode)
- **Database & ORM**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: HTTP-only Cookie Sessions + [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (base-nova)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Theme**: [next-themes](https://github.com/pacocoursey/next-themes)
- **Package Manager**: [pnpm](https://pnpm.io/)

## Prerequisites

- Node.js 18.18+
- pnpm 8+
- Docker (optional, for running local PostgreSQL)

## Installation & Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Database Setup (PostgreSQL)**:
   Start local PostgreSQL with Docker:
   ```bash
   docker compose up -d
   ```
   Push the database schema:
   ```bash
   pnpm prisma db push
   ```
   Seed development accounts and permissions:
   ```bash
   pnpm prisma db seed
   ```

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Test Accounts

| Role | Email | Password | Scope |
|------|-------|----------|-------|
| **Owner** | `owner@ovenxpress.com` | `Owner123!` | Universal access across all modules |
| **Admin** | `admin@ovenxpress.com` | `Admin123!` | System settings & user management |
| **Manager** | `manager@ovenxpress.com` | `Manager123!` | Branch oversight & reporting |
| **Staff** | `staff@ovenxpress.com` | `Staff123!` | Operational dashboard only |
| **Inactive** | `inactive@ovenxpress.com` | `Inactive123!` | Blocked / deactivated test account |

## Build & Verify

```bash
pnpm lint          # Run ESLint
pnpm exec tsc --noEmit # Strict TypeScript verification
pnpm build         # Production Next.js build
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/                 # Unauthenticated routes
│   │   ├── login/              # Login page with show/hide password & validation
│   │   └── unauthorized/       # 403 Forbidden Access Denied page
│   ├── (dashboard)/            # Authenticated application shell routes
│   │   ├── layout.tsx          # Server guard enforcing requireAuthentication()
│   │   ├── page.tsx            # Dashboard overview & active session badge
│   │   ├── settings/           # Protected settings (requires settings.read)
│   │   └── users/              # Staff & user list (requires users.read)
│   ├── globals.css             # Tailwind v4 theme tokens
│   └── layout.tsx              # Root HTML, ThemeProvider, Toaster
├── components/
│   ├── auth/                   # Authentication forms (login-form.tsx)
│   ├── layout/                 # Application shell (header, sidebar, mobile-sidebar)
│   ├── ui/                     # 16 accessible shadcn/ui components
│   └── theme-toggle.tsx        # Dark / Light / System theme toggle
├── config/
│   └── navigation.ts           # Navigation items with requiredPermission metadata
├── lib/
│   ├── auth/                   # Session, password hashing, actions, and guards
│   ├── permissions/            # Granular permission codes, role mappings, check helpers
│   ├── validations/            # Zod validation schemas
│   ├── db/                     # Prisma singleton client
│   └── utils.ts                # Class merging utility
└── providers/
    ├── auth-provider.tsx       # Client authentication context
    ├── sidebar-provider.tsx    # Sidebar collapse & drawer state
    └── theme-provider.tsx      # next-themes wrapper
```

## Documentation

- [docs/PROJECT-CONTEXT.md](docs/PROJECT-CONTEXT.md) — Multi-branch vision, tech stack, and principles
- [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md) — Milestone tracker & completed tasks
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) — Comprehensive Authentication & RBAC guide
- [docs/AI-PROMPTS.md](docs/AI-PROMPTS.md) — Reusable prompt templates

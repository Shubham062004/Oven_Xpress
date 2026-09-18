# Project Context

## Overview

Oven Xpress is a multi-branch restaurant management system designed for restaurant owners who manage multiple branches within a city. It centralizes operations across branches into a single, unified platform.

## Business Context

A restaurant owner manages several branches of the same restaurant brand. Each branch has its own staff, inventory, menu pricing, and daily operations. The system provides a centralized view of all branches while allowing per-branch management of:

- Staff and attendance
- Menu and recipes
- Inventory and purchases
- Orders (dine-in, takeaway, delivery)
- Kitchen operations
- Payments and expenses
- Customer management
- Analytics and reporting

## Target Users

- **Restaurant Owner** — Full system access, cross-branch analytics
- **Branch Manager** — Branch-level operations and reporting
- **Staff** — Role-specific access (kitchen, service, cashier)

## Future Modules

| Module | Purpose |
|--------|---------|
| Branch Management | Add/edit branches, branch-level settings |
| Staff Management | Employee records, roles, permissions |
| Attendance | Clock-in/out, attendance tracking |
| Salary & Bonuses | Payroll, bonus calculations |
| Menu Management | Menu items, categories, pricing |
| Recipes | Recipe details, ingredient lists |
| Inventory | Stock tracking, low-stock alerts |
| Purchases | Purchase orders, receiving |
| Suppliers | Supplier directory, contacts |
| Orders | Order creation, status tracking |
| Dine-in | Table management, reservations |
| Takeaway | Takeaway order flow |
| Delivery | Delivery management, tracking |
| Kitchen Operations | Kitchen display, order queue |
| Payments | Payment processing, methods |
| Expenses | Expense tracking, categories |
| Profit/Loss | Financial summaries |
| Customers | Customer directory, loyalty |
| Reviews | Customer feedback |
| Analytics | Business intelligence, trends |
| Reports | Configurable report generation |
| Audit Logs | System activity tracking |
| Role-based Permissions | Access control |

## Technology Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (base-nova)
- **Icons**: Lucide React
- **Theme**: next-themes
- **Package Manager**: pnpm

## Architecture Direction

- Server Components by default, Client Components only where interactivity is needed
- App Router with file-based routing
- Centralized design tokens via CSS variables
- Shared layout shell (sidebar + header)
- Component library via shadcn/ui (copy-paste ownership)
- Future: Server Actions for mutations, Prisma for database

## Design Principles

- Professional and clean, appropriate for daily business use
- Consistent spacing, typography, and color usage via design tokens
- Responsive from mobile (390px) to desktop (1440px+)
- Accessible (semantic HTML, keyboard navigation, ARIA attributes)
- Both light and dark themes

## Coding Principles

- TypeScript strict mode, avoid `any`
- Small, focused, reusable components
- Semantic HTML with proper labels
- No inline styles; use design tokens
- Business logic separate from UI
- Server Components where possible
- No unnecessary abstractions or files

## Current Phase

**Phase 1: Foundation & Design System**

Establishing the project structure, design system, responsive shell, and component library. No business logic, database, or authentication at this stage.

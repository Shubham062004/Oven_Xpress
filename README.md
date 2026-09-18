# Oven Xpress

Multi-branch restaurant management system for centralized operations, staff, inventory, orders, and analytics.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (base-nova)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Theme**: [next-themes](https://github.com/pacocoursey/next-themes)
- **Package Manager**: [pnpm](https://pnpm.io/)

## Prerequisites

- Node.js 18.18+
- pnpm 8+

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
pnpm start
```

## Lint

```bash
pnpm lint
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── globals.css         # Design system tokens and global styles
│   ├── layout.tsx          # Root layout (font, theme, shell)
│   └── page.tsx            # Design system demo page
├── components/
│   ├── layout/             # Application shell components
│   │   ├── app-shell.tsx   # Main layout wrapper
│   │   ├── header.tsx      # Top header bar
│   │   ├── mobile-sidebar.tsx  # Mobile drawer navigation
│   │   └── sidebar.tsx     # Desktop sidebar navigation
│   ├── ui/                 # shadcn/ui + custom components
│   │   ├── empty-state.tsx # Reusable empty state
│   │   ├── loading-skeleton.tsx # Skeleton loading patterns
│   │   ├── page-header.tsx # Consistent page header
│   │   └── ...             # shadcn/ui components
│   └── theme-toggle.tsx    # Light/dark/system theme switcher
├── config/
│   └── navigation.ts       # Sidebar navigation configuration
├── lib/
│   └── utils.ts            # Utility functions (cn)
└── providers/
    ├── sidebar-provider.tsx # Sidebar state context
    └── theme-provider.tsx   # Theme provider wrapper
docs/
├── AI-PROMPTS.md           # Reusable prompt templates
├── PROJECT-CONTEXT.md      # Project overview and architecture
└── PROJECT-STATUS.md       # Current development status
```

## Documentation

- [Project Context](docs/PROJECT-CONTEXT.md) — Overview, target users, tech stack, principles
- [Project Status](docs/PROJECT-STATUS.md) — Current phase and progress
- [AI Prompts](docs/AI-PROMPTS.md) — Reusable prompt templates for development

## Current Phase

**Foundation & Design System** — Project scaffolding, design tokens, responsive shell, and component library. No business logic implemented yet.

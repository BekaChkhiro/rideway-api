# Bike Area Web - Frontend Development Plan

## Project Overview

This document outlines the complete frontend development plan for the Bike Area web application. The frontend will be built with Next.js 14, providing both the user-facing web application and an admin dashboard. A separate React Native mobile app will be developed later using the same API.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 (App Router) | React framework with SSR/SSG |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS | Utility-first CSS |
| UI Components | shadcn/ui | Accessible, customizable components |
| State Management | Zustand | Client-side state |
| Server State | TanStack Query v5 | API data fetching & caching |
| Forms | React Hook Form + Zod | Form handling & validation |
| Authentication | NextAuth.js | Auth integration with JWT |
| Real-time | Socket.io Client | Chat, notifications |
| Icons | Lucide React | Icon library |
| Date Handling | date-fns | Date formatting |
| File Upload | react-dropzone | Drag & drop uploads |
| Maps | Leaflet / Mapbox | Location features |
| Charts | Recharts | Admin dashboard charts |

## Project Structure

```
bike-area-web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   └── verify/
│   │   ├── (main)/
│   │   │   ├── feed/
│   │   │   ├── explore/
│   │   │   ├── marketplace/
│   │   │   ├── parts/
│   │   │   ├── forum/
│   │   │   ├── services/
│   │   │   ├── messages/
│   │   │   ├── notifications/
│   │   │   ├── profile/
│   │   │   ├── settings/
│   │   │   └── [username]/
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── users/
│   │   │       ├── content/
│   │   │       ├── reports/
│   │   │       ├── marketplace/
│   │   │       ├── forum/
│   │   │       └── settings/
│   │   ├── api/
│   │   │   └── auth/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Header, Footer, Sidebar
│   │   ├── forms/           # Form components
│   │   ├── cards/           # Card components
│   │   ├── modals/          # Modal dialogs
│   │   ├── feed/            # Feed components
│   │   ├── marketplace/     # Marketplace components
│   │   ├── forum/           # Forum components
│   │   ├── chat/            # Chat components
│   │   ├── admin/           # Admin-specific components
│   │   └── shared/          # Shared/common components
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-user.ts
│   │   ├── use-socket.ts
│   │   └── ...
│   ├── lib/
│   │   ├── api/             # API client & endpoints
│   │   ├── utils.ts         # Utility functions
│   │   ├── validations/     # Zod schemas
│   │   └── constants.ts     # App constants
│   ├── stores/              # Zustand stores
│   │   ├── auth-store.ts
│   │   ├── ui-store.ts
│   │   └── chat-store.ts
│   ├── types/               # TypeScript types
│   │   ├── api.ts
│   │   ├── user.ts
│   │   ├── post.ts
│   │   └── ...
│   └── providers/           # Context providers
│       ├── query-provider.tsx
│       ├── auth-provider.tsx
│       └── socket-provider.tsx
├── public/
│   ├── images/
│   └── icons/
├── .env.example
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Development Phases

### [Phase 1: Foundation](./phase-1-foundation.md)
Setting up the project foundation including Next.js 14 initialization, Tailwind + shadcn/ui configuration, authentication system, and API client setup.

**Scope:** Project setup, Auth, Layout, API client, Core components

---

### [Phase 2: Core Features](./phase-2-core-features.md)
Building essential user features: profiles, settings, media uploads, and navigation.

**Scope:** User profiles, Settings, Media upload, Navigation, Search

---

### [Phase 3: Social Features](./phase-3-social.md)
Implementing social media functionality: feed, posts, stories, comments, and interactions.

**Scope:** Feed, Posts, Stories, Comments, Likes, Follow system

---

### [Phase 4: Marketplace & Forum](./phase-4-marketplace-forum.md)
Building marketplace listings, parts catalog, forum system, and services directory.

**Scope:** Listings, Parts, Forum threads, Services, Reviews

---

### [Phase 5: Admin Dashboard](./phase-5-admin.md)
Creating the admin panel for content moderation, user management, and analytics.

**Scope:** Dashboard, User management, Content moderation, Reports, Analytics

---

### [Phase 6: Production Ready](./phase-6-production.md)
Real-time features, PWA setup, performance optimization, testing, and deployment.

**Scope:** Chat, Notifications, PWA, SEO, Testing, Deployment

---

## Key Features by Section

### User Web Application
- **Feed** - Personalized post feed with infinite scroll
- **Stories** - Story viewing and creation
- **Explore** - Discover content, trending posts/hashtags
- **Marketplace** - Browse and create listings
- **Parts** - Motorcycle parts catalog
- **Forum** - Discussion threads and categories
- **Services** - Service provider directory with reviews
- **Messages** - Real-time private messaging
- **Notifications** - In-app notifications
- **Profile** - User profiles with posts, listings, activity
- **Settings** - Account, privacy, notification preferences

### Admin Dashboard
- **Dashboard** - Overview, stats, charts
- **Users** - User management, verification, bans
- **Content** - Post/listing moderation
- **Reports** - User reports handling
- **Forum** - Thread/category management
- **Marketplace** - Listing oversight
- **Settings** - App configuration

## Design System

### Colors (Tailwind Config)
```typescript
// Motorcycle/racing inspired palette
colors: {
  primary: {
    DEFAULT: '#E63946',  // Racing red
    foreground: '#FFFFFF',
  },
  secondary: {
    DEFAULT: '#1D3557',  // Deep blue
    foreground: '#FFFFFF',
  },
  accent: {
    DEFAULT: '#F4A261',  // Orange accent
    foreground: '#000000',
  },
  background: '#FAFAFA',
  foreground: '#1A1A1A',
  muted: '#F1F5F9',
  border: '#E2E8F0',
}
```

### Typography
```typescript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  display: ['Montserrat', 'sans-serif'],
}
```

### Responsive Breakpoints
```typescript
screens: {
  'sm': '640px',   // Mobile landscape
  'md': '768px',   // Tablet
  'lg': '1024px',  // Desktop
  'xl': '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
}
```

## API Integration

### Base Configuration
```typescript
// lib/api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const apiClient = {
  get: <T>(url: string) => fetch(`${API_BASE_URL}${url}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  }).then(res => res.json() as T),

  post: <T>(url: string, data: unknown) => fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(data),
  }).then(res => res.json() as T),
  // ... put, patch, delete
};
```

### API Response Types
```typescript
// types/api.ts
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

## Environment Variables

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Maps (optional)
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Generate component
npm run generate:component
```

## Progress Tracking

- [ ] Phase 1: Foundation
- [ ] Phase 2: Core Features
- [ ] Phase 3: Social Features
- [ ] Phase 4: Marketplace & Forum
- [ ] Phase 5: Admin Dashboard
- [ ] Phase 6: Production Ready

---

## Resources

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)

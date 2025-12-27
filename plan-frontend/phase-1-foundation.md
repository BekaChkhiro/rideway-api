# Phase 1: Foundation

## Overview

This phase establishes the project foundation. We will set up Next.js 14 with App Router, configure Tailwind CSS with shadcn/ui, implement authentication with NextAuth.js, create the API client, and build the core layout structure.

## Goals

- Initialize Next.js 14 project with TypeScript
- Configure Tailwind CSS and shadcn/ui
- Implement JWT authentication with NextAuth.js
- Create API client with TanStack Query
- Build responsive layout (Header, Sidebar, Footer)
- Set up Zustand stores and providers

---

## Tasks

### 1.1 Project Initialization

- [ ] Create Next.js 14 project with TypeScript
- [ ] Configure TypeScript strict mode
- [ ] Set up ESLint and Prettier
- [ ] Configure path aliases (@/components, @/lib, etc.)
- [ ] Create folder structure
- [ ] Set up environment variables

### 1.2 Tailwind & shadcn/ui Setup

- [ ] Install and configure Tailwind CSS
- [ ] Set up custom color palette (racing theme)
- [ ] Configure typography and fonts
- [ ] Initialize shadcn/ui
- [ ] Install core components (Button, Input, Card, etc.)
- [ ] Create theme toggle (light/dark mode)

### 1.3 Authentication System

- [ ] Install and configure NextAuth.js
- [ ] Create JWT credentials provider
- [ ] Implement login page
- [ ] Implement register page
- [ ] Create forgot password flow
- [ ] Implement OTP verification page
- [ ] Set up protected routes middleware
- [ ] Create auth hooks and context

### 1.4 API Client Setup

- [ ] Create API client with fetch wrapper
- [ ] Configure TanStack Query provider
- [ ] Set up request/response interceptors
- [ ] Create token refresh logic
- [ ] Build API hooks factory
- [ ] Create error handling utilities

### 1.5 Layout & Navigation

- [ ] Create root layout with providers
- [ ] Build responsive Header component
- [ ] Build mobile navigation (bottom tabs)
- [ ] Build desktop Sidebar
- [ ] Create Footer component
- [ ] Implement loading states
- [ ] Create error boundaries

### 1.6 Core UI Components

- [ ] Configure all shadcn/ui base components
- [ ] Create custom Avatar component
- [ ] Create custom Image component (with optimization)
- [ ] Build loading spinners and skeletons
- [ ] Create toast/notification component
- [ ] Build confirmation dialog component

---

## Technical Details

### Folder Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx           # Auth pages layout (no header)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── verify/
│   │       └── page.tsx
│   ├── (main)/
│   │   ├── layout.tsx           # Main app layout (with header/nav)
│   │   └── ...
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing/redirect
│   └── globals.css
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── mobile-nav.tsx
│   │   └── footer.tsx
│   └── shared/
│       ├── loading.tsx
│       ├── error-boundary.tsx
│       └── ...
├── hooks/
│   ├── use-auth.ts
│   └── use-media-query.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── endpoints.ts
│   │   └── hooks/
│   │       └── use-api.ts
│   ├── auth/
│   │   ├── config.ts
│   │   └── helpers.ts
│   ├── utils.ts
│   └── validations/
│       ├── auth.ts
│       └── common.ts
├── stores/
│   ├── auth-store.ts
│   └── ui-store.ts
├── types/
│   ├── api.ts
│   ├── auth.ts
│   └── next-auth.d.ts
└── providers/
    ├── providers.tsx            # Combined providers
    ├── query-provider.tsx
    ├── theme-provider.tsx
    └── auth-provider.tsx
```

### NextAuth.js Configuration

```typescript
// lib/auth/config.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const res = await fetch(`${process.env.API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error.message);
        }

        return {
          id: data.data.user.id,
          email: data.data.user.email,
          name: data.data.user.profile.fullName,
          username: data.data.user.profile.username,
          image: data.data.user.profile.avatarUrl,
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          image: user.image,
        };
      }

      // Handle token refresh
      if (trigger === 'update' && session?.accessToken) {
        token.accessToken = session.accessToken;
      }

      return token;
    },
    async session({ session, token }) {
      session.user = token.user;
      session.accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
};
```

### API Client

```typescript
// lib/api/client.ts
import { getSession } from 'next-auth/react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const session = await getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { params, ...init } = config;

    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams}`;
    }

    const headers = await this.getHeaders();

    const response = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...init.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error?.message || 'Request failed', data.error);
    }

    return data;
  }

  get<T>(endpoint: string, params?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const session = await getSession();
    const headers: HeadersInit = {};

    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error?.message || 'Upload failed', data.error);
    }

    return data;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public details?: { code: string; details?: unknown }
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
```

### TanStack Query Setup

```typescript
// providers/query-provider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Zustand Auth Store

```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### UI Store

```typescript
// stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMobileMenu: () =>
    set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
}));
```

### Zod Validation Schemas

```typescript
// lib/validations/auth.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  fullName: z.string().min(2, 'Full name is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

### Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-montserrat)', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

---

## Claude Code Prompts

### Prompt 1: Initialize Next.js Project

```
Create a new Next.js 14 project for bike-area-web with the following requirements:

1. Initialize Next.js with:
   - TypeScript
   - App Router
   - Tailwind CSS
   - ESLint
   - src/ directory
   - Import alias @/*

2. Configure TypeScript with strict mode in tsconfig.json

3. Set up ESLint with:
   - @typescript-eslint
   - eslint-plugin-react
   - eslint-plugin-react-hooks
   - prettier integration

4. Configure path aliases:
   - @/components/* -> src/components/*
   - @/lib/* -> src/lib/*
   - @/hooks/* -> src/hooks/*
   - @/stores/* -> src/stores/*
   - @/types/* -> src/types/*
   - @/providers/* -> src/providers/*

5. Create the folder structure as specified in the plan

6. Create .env.example with all required variables

7. Install additional dependencies:
   - zustand
   - @tanstack/react-query
   - @tanstack/react-query-devtools
   - react-hook-form
   - @hookform/resolvers
   - zod
   - next-auth
   - lucide-react
   - date-fns
   - clsx
   - tailwind-merge
   - class-variance-authority
   - tailwindcss-animate

8. Create lib/utils.ts with cn() function for className merging
```

### Prompt 2: Set Up shadcn/ui

```
Set up shadcn/ui in the Next.js project:

1. Initialize shadcn/ui with:
   - Style: New York
   - Base color: Slate
   - CSS variables: Yes

2. Configure custom color palette for the motorcycle theme:
   Primary: Racing red (#E63946 / hsl(355, 78%, 56%))
   Secondary: Deep blue (#1D3557 / hsl(213, 50%, 23%))
   Accent: Orange (#F4A261 / hsl(27, 87%, 67%))

3. Install these shadcn/ui components:
   - button
   - input
   - card
   - dialog
   - dropdown-menu
   - avatar
   - badge
   - tabs
   - toast (sonner)
   - form
   - label
   - textarea
   - select
   - checkbox
   - switch
   - skeleton
   - separator
   - sheet
   - tooltip
   - popover
   - command
   - scroll-area

4. Set up Inter and Montserrat fonts using next/font

5. Configure globals.css with:
   - CSS variables for light/dark themes
   - Custom scrollbar styles
   - Animation utilities

6. Create ThemeProvider using next-themes:
   - Support light/dark/system modes
   - Persist preference in localStorage
   - Add theme toggle component
```

### Prompt 3: Implement Authentication

```
Implement the authentication system with NextAuth.js:

1. Create src/app/api/auth/[...nextauth]/route.ts:
   - Configure CredentialsProvider
   - Connect to backend /auth/login endpoint
   - Set up JWT strategy
   - Configure callbacks for token and session

2. Create src/lib/auth/config.ts:
   - Export authOptions configuration
   - Token refresh logic
   - Error handling

3. Create auth pages in src/app/(auth)/:

   Login page (/login):
   - Email and password fields
   - "Remember me" checkbox
   - Forgot password link
   - Register link
   - Social login buttons (prepare for OAuth)
   - Form validation with Zod
   - Loading states
   - Error handling

   Register page (/register):
   - Email, username, full name fields
   - Password with confirmation
   - Terms acceptance checkbox
   - Link to login
   - Form validation with Zod
   - Success -> redirect to verify

   Forgot Password page (/forgot-password):
   - Email input
   - Send OTP button
   - Success message
   - Back to login link

   Verify page (/verify):
   - 6-digit OTP input
   - Resend code button with countdown
   - Verify button
   - Success -> redirect to login or home

4. Create src/middleware.ts:
   - Protect routes that require auth
   - Redirect authenticated users from auth pages
   - Handle token expiration

5. Create auth hooks:
   - useAuth() - current user, login, logout, isLoading
   - useRequireAuth() - redirect if not authenticated

6. Create AuthProvider component:
   - Wrap with SessionProvider
   - Sync NextAuth session with Zustand store
```

### Prompt 4: Create API Client and Hooks

```
Set up the API client and TanStack Query hooks:

1. Create src/lib/api/client.ts:
   - ApiClient class with get, post, patch, delete, upload methods
   - Automatic token injection from NextAuth session
   - Request/response error handling
   - ApiError class for typed errors

2. Create src/lib/api/endpoints.ts:
   - Define all API endpoint constants
   - Organize by module (auth, users, posts, etc.)

3. Create src/providers/query-provider.tsx:
   - Configure QueryClient with defaults
   - Stale time, gc time, retry logic
   - Add ReactQueryDevtools

4. Create base API hooks factory in src/lib/api/hooks/use-api.ts:

   createQueryHook<T>(key, endpoint, options):
   - Returns typed useQuery hook
   - Automatic key generation

   createMutationHook<T, V>(endpoint, method, options):
   - Returns typed useMutation hook
   - Automatic invalidation

5. Create module-specific hooks:

   src/lib/api/hooks/use-auth.ts:
   - useLogin()
   - useRegister()
   - useVerifyOtp()
   - useForgotPassword()
   - useResetPassword()
   - useLogout()
   - useRefreshToken()

   src/lib/api/hooks/use-user.ts:
   - useCurrentUser()
   - useUser(id)
   - useUserByUsername(username)
   - useUpdateProfile()
   - useUploadAvatar()

6. Create error handling utilities:
   - parseApiError(error) - extract user-friendly message
   - isApiError(error) - type guard
   - Handle common errors (401, 403, 404, 500)

7. Set up automatic token refresh:
   - Intercept 401 responses
   - Attempt refresh
   - Retry original request
   - Logout on refresh failure
```

### Prompt 5: Build Layout Components

```
Create the main layout components:

1. Create src/app/layout.tsx (Root Layout):
   - Import fonts (Inter, Montserrat)
   - Wrap with Providers component
   - Add Toaster (sonner)
   - Set metadata

2. Create src/providers/providers.tsx:
   - Combine all providers
   - ThemeProvider
   - QueryProvider
   - AuthProvider
   - Proper ordering

3. Create src/app/(auth)/layout.tsx:
   - Minimal layout for auth pages
   - Centered card design
   - Logo at top
   - No header/sidebar

4. Create src/app/(main)/layout.tsx:
   - Header at top
   - Sidebar on desktop (left)
   - Main content area
   - Mobile bottom navigation
   - Require authentication

5. Create src/components/layout/header.tsx:
   - Logo (link to home)
   - Search bar (desktop)
   - Notification bell with badge
   - User avatar with dropdown
   - Mobile menu trigger
   - Responsive design

6. Create src/components/layout/sidebar.tsx:
   - Navigation links with icons:
     - Feed (Home icon)
     - Explore (Compass icon)
     - Marketplace (Store icon)
     - Parts (Wrench icon)
     - Forum (MessageSquare icon)
     - Services (MapPin icon)
     - Messages (Mail icon)
   - Active state highlighting
   - Collapsible on desktop
   - User section at bottom

7. Create src/components/layout/mobile-nav.tsx:
   - Fixed bottom navigation
   - 5 main icons:
     - Home
     - Explore
     - Create (+)
     - Messages
     - Profile
   - Active state
   - Hide on scroll (optional)

8. Create src/components/layout/footer.tsx:
   - Simple footer for landing pages
   - Copyright, links

9. Create loading and error components:
   - src/components/shared/loading.tsx - Full page spinner
   - src/components/shared/page-loading.tsx - Skeleton layout
   - src/components/shared/error-boundary.tsx - Error fallback
   - src/app/(main)/loading.tsx - Route loading state
   - src/app/(main)/error.tsx - Route error state
```

### Prompt 6: Create Core UI Components

```
Create essential reusable UI components:

1. Extend shadcn/ui Avatar for user profiles:
   src/components/ui/user-avatar.tsx
   - Accept user object or individual props
   - Fallback to initials
   - Online indicator option
   - Link to profile option
   - Size variants (xs, sm, md, lg, xl)

2. Create optimized Image component:
   src/components/ui/optimized-image.tsx
   - Wrap next/image
   - Blur placeholder
   - Error fallback
   - Loading skeleton
   - Aspect ratio prop

3. Create loading components:
   src/components/shared/spinner.tsx
   - Size variants
   - Color variants

   src/components/shared/skeleton-card.tsx
   - Reusable skeleton for cards

   src/components/shared/skeleton-list.tsx
   - Skeleton for list items

4. Create empty state component:
   src/components/shared/empty-state.tsx
   - Icon
   - Title
   - Description
   - Action button (optional)

5. Create confirmation dialog:
   src/components/shared/confirm-dialog.tsx
   - Title, description
   - Confirm/cancel buttons
   - Destructive variant
   - Loading state

6. Create page header component:
   src/components/shared/page-header.tsx
   - Title
   - Description (optional)
   - Actions slot
   - Back button (optional)

7. Create infinite scroll component:
   src/components/shared/infinite-scroll.tsx
   - Intersection observer based
   - Loading indicator
   - End of list message
   - Error retry

8. Create file upload components:
   src/components/shared/image-upload.tsx
   - Drag and drop
   - Preview
   - Progress indicator
   - Multiple files support
   - Size/type validation

9. Set up toast notifications:
   - Configure sonner with custom styles
   - Create toast helper functions
   - Success, error, info, warning variants
```

---

## Testing Checklist

### Unit Tests

- [ ] API client methods work correctly
- [ ] Zod validation schemas validate correctly
- [ ] Auth store updates state correctly
- [ ] UI store toggles work correctly
- [ ] Utility functions work correctly

### Integration Tests

- [ ] Login flow works end-to-end
- [ ] Registration flow works end-to-end
- [ ] Password reset flow works
- [ ] Protected routes redirect properly
- [ ] Token refresh works automatically

### Component Tests

- [ ] Header renders correctly
- [ ] Sidebar navigation works
- [ ] Mobile navigation works
- [ ] Theme toggle switches themes
- [ ] Form components validate input
- [ ] Loading states display correctly
- [ ] Error states display correctly

### Accessibility Tests

- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] Screen reader labels present
- [ ] Color contrast meets WCAG
- [ ] Forms have proper labels

### Responsive Tests

- [ ] Mobile layout (320px - 639px)
- [ ] Tablet layout (640px - 1023px)
- [ ] Desktop layout (1024px+)
- [ ] Navigation adapts correctly

---

## Completion Criteria

Phase 1 is complete when:

1. **Project runs locally** with `npm run dev`
2. **TypeScript compiles** without errors
3. **ESLint passes** without warnings
4. **shadcn/ui components** are styled and functional
5. **Authentication works** - login, register, logout
6. **Protected routes** redirect unauthenticated users
7. **Layout is responsive** on mobile and desktop
8. **API client** connects to backend successfully
9. **Theme toggle** works (light/dark)
10. **All core components** render correctly

---

## Notes

- Test on multiple browsers (Chrome, Firefox, Safari)
- Ensure mobile touch interactions work
- Keep bundle size minimal - lazy load where possible
- Document component props with JSDoc
- Use semantic HTML elements
- Follow React best practices (keys, memoization)

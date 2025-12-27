# Phase 6: Production Ready

## Overview

This final phase prepares the application for production. We'll implement real-time features (chat and notifications), set up PWA capabilities, optimize SEO, add comprehensive testing, improve performance, and deploy to production.

## Goals

- Implement real-time chat with Socket.io
- Add push notifications support
- Set up PWA for installable web app
- Optimize SEO for all pages
- Add comprehensive testing
- Optimize performance and bundle size
- Deploy to production (Vercel)

---

## Tasks

### 6.1 Real-time Chat

- [ ] Set up Socket.io client
- [ ] Create chat UI components
- [ ] Implement conversations list
- [ ] Build chat window
- [ ] Add message sending/receiving
- [ ] Implement typing indicators
- [ ] Add read receipts
- [ ] Show online status

### 6.2 Notifications

- [ ] Create notifications page
- [ ] Implement notification dropdown
- [ ] Set up push notifications (FCM)
- [ ] Handle notification clicks
- [ ] Add notification preferences
- [ ] Implement unread badge

### 6.3 PWA Setup

- [ ] Configure next-pwa
- [ ] Create manifest.json
- [ ] Add service worker
- [ ] Set up offline fallback
- [ ] Add install prompt
- [ ] Configure caching strategies

### 6.4 SEO Optimization

- [ ] Set up metadata for all pages
- [ ] Create dynamic OG images
- [ ] Add structured data (JSON-LD)
- [ ] Create sitemap
- [ ] Implement canonical URLs
- [ ] Add robots.txt

### 6.5 Testing

- [ ] Set up Jest and Testing Library
- [ ] Write unit tests for utilities
- [ ] Write component tests
- [ ] Set up Playwright for E2E
- [ ] Write E2E tests for critical flows
- [ ] Set up CI test pipeline

### 6.6 Performance

- [ ] Analyze and reduce bundle size
- [ ] Implement code splitting
- [ ] Optimize images with next/image
- [ ] Add loading skeletons
- [ ] Implement virtualization for long lists
- [ ] Set up performance monitoring

### 6.7 Deployment

- [ ] Configure Vercel project
- [ ] Set up environment variables
- [ ] Configure custom domain
- [ ] Set up preview deployments
- [ ] Configure error monitoring (Sentry)
- [ ] Set up analytics (optional)

---

## Technical Details

### Socket.io Setup

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { getSession } from 'next-auth/react';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const session = await getSession();
  if (!session?.accessToken) {
    throw new Error('Not authenticated');
  }

  socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
    auth: { token: session.accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

```typescript
// providers/socket-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { getSocket, disconnectSocket } from '@/lib/socket';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.accessToken) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;

      setSocket(s);

      s.on('connect', () => setIsConnected(true));
      s.on('disconnect', () => setIsConnected(false));

      s.on('user:online', (userId: string) => {
        setOnlineUsers((prev) => new Set([...prev, userId]));
      });

      s.on('user:offline', (userId: string) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      });
    });

    return () => {
      mounted = false;
    };
  }, [session?.accessToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
```

### Chat Store

```typescript
// stores/chat-store.ts
import { create } from 'zustand';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image';
  mediaUrl?: string;
  createdAt: string;
  isRead: boolean;
}

interface Conversation {
  id: string;
  participant: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  lastMessage?: Message;
  unreadCount: number;
  isMuted: boolean;
}

interface TypingUser {
  conversationId: string;
  userId: string;
  timestamp: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: string | null;
  messages: Record<string, Message[]>;
  typingUsers: TypingUser[];
  totalUnread: number;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  markAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  updateUnreadCount: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: {},
  typingUsers: [],
  totalUnread: 0,

  setConversations: (conversations) =>
    set({ conversations }, false),

  setActiveConversation: (id) =>
    set({ activeConversation: id }),

  addMessage: (message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [message.conversationId]: [
          ...(state.messages[message.conversationId] || []),
          message,
        ],
      },
    })),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    })),

  markAsRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    })),

  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const now = Date.now();
      let typingUsers = state.typingUsers.filter(
        (t) => t.conversationId !== conversationId || t.userId !== userId
      );
      if (isTyping) {
        typingUsers.push({ conversationId, userId, timestamp: now });
      }
      return { typingUsers };
    }),

  updateUnreadCount: () =>
    set((state) => ({
      totalUnread: state.conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    })),
}));
```

### Page Structure

```
src/app/(main)/
├── messages/
│   ├── page.tsx                    # Conversations list
│   └── [conversationId]/
│       └── page.tsx                # Chat window
└── notifications/
    └── page.tsx                    # Notifications list
```

### Component Structure

```
src/components/
├── chat/
│   ├── conversations-list.tsx     # List of conversations
│   ├── conversation-item.tsx      # Single conversation preview
│   ├── chat-window.tsx            # Main chat area
│   ├── chat-header.tsx            # Chat header with user info
│   ├── messages-list.tsx          # Messages container
│   ├── message-bubble.tsx         # Single message
│   ├── message-input.tsx          # Input with send button
│   ├── typing-indicator.tsx       # "User is typing..."
│   └── online-indicator.tsx       # Online status dot
└── notifications/
    ├── notifications-dropdown.tsx  # Header dropdown
    ├── notifications-list.tsx     # Full notifications list
    ├── notification-item.tsx      # Single notification
    └── notification-badge.tsx     # Unread count badge
```

### PWA Configuration

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.bikearea\.ge\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ],
});

module.exports = withPWA({
  // Your Next.js config
});
```

```json
// public/manifest.json
{
  "name": "Bike Area",
  "short_name": "BikeArea",
  "description": "Motorcycle community platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#E63946",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### SEO Configuration

```typescript
// app/layout.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://bikearea.ge'),
  title: {
    default: 'Bike Area - Motorcycle Community',
    template: '%s | Bike Area',
  },
  description: 'Join the motorcycle community. Buy, sell, discuss, and connect with riders.',
  keywords: ['motorcycle', 'bikes', 'community', 'marketplace', 'forum', 'Georgia'],
  authors: [{ name: 'Bike Area' }],
  creator: 'Bike Area',
  openGraph: {
    type: 'website',
    locale: 'ka_GE',
    url: 'https://bikearea.ge',
    siteName: 'Bike Area',
    title: 'Bike Area - Motorcycle Community',
    description: 'Join the motorcycle community. Buy, sell, discuss, and connect with riders.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Bike Area',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bike Area - Motorcycle Community',
    description: 'Join the motorcycle community. Buy, sell, discuss, and connect with riders.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};
```

```typescript
// Dynamic metadata for listing page
// app/(main)/marketplace/[id]/page.tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }): Promise<Metadata> {
  const listing = await getListing(params.id);

  return {
    title: listing.title,
    description: `${listing.title} - ${listing.price} ${listing.currency}. ${listing.description?.slice(0, 150)}`,
    openGraph: {
      title: listing.title,
      description: `${listing.price} ${listing.currency}`,
      images: listing.images.map((img) => ({
        url: img.url,
        width: 800,
        height: 600,
      })),
    },
  };
}
```

### Testing Setup

```typescript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
};

module.exports = createJestConfig(customJestConfig);
```

```typescript
// jest.setup.js
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
```

```typescript
// Example component test
// __tests__/components/post-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PostCard } from '@/components/feed/post-card';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPost = {
  id: '1',
  userId: 'user1',
  content: 'Test post content',
  likesCount: 5,
  commentsCount: 3,
  sharesCount: 1,
  isLiked: false,
  isBookmarked: false,
  createdAt: new Date().toISOString(),
  user: {
    id: 'user1',
    username: 'testuser',
    fullName: 'Test User',
    avatarUrl: null,
  },
  images: [],
  hashtags: [],
};

describe('PostCard', () => {
  const queryClient = new QueryClient();

  const renderPostCard = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PostCard post={mockPost} />
      </QueryClientProvider>
    );

  it('renders post content', () => {
    renderPostCard();
    expect(screen.getByText('Test post content')).toBeInTheDocument();
  });

  it('renders author info', () => {
    renderPostCard();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText(/@testuser/)).toBeInTheDocument();
  });

  it('shows like count', () => {
    renderPostCard();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

```typescript
// E2E test example
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/feed');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
});
```

---

## Claude Code Prompts

### Prompt 1: Implement Real-time Chat

```
Implement the real-time chat feature:

1. Set up Socket.io client in src/lib/socket.ts:
   - Create singleton socket instance
   - Connect with JWT auth token
   - Handle reconnection
   - Export getSocket function

2. Create src/providers/socket-provider.tsx:
   - Manage socket connection lifecycle
   - Handle auth changes
   - Track online users
   - Provide socket context

3. Create src/stores/chat-store.ts:
   - Conversations list
   - Messages per conversation
   - Active conversation
   - Typing indicators
   - Unread counts

4. Create src/app/(main)/messages/page.tsx:
   - Two-column layout (conversations + chat)
   - Mobile: single column with navigation
   - Real-time updates

5. Create src/components/chat/conversations-list.tsx:
   - List of conversations
   - Last message preview
   - Unread badge
   - Online status indicator
   - Click to open chat

6. Create src/components/chat/chat-window.tsx:
   - Header with user info
   - Messages area (scrollable)
   - Typing indicator
   - Message input
   - Send button

7. Create src/components/chat/message-bubble.tsx:
   - Own vs other styling
   - Timestamp
   - Read receipt
   - Image support

8. Create src/components/chat/message-input.tsx:
   - Text input
   - Emoji picker (optional)
   - Image attachment
   - Send on Enter
   - Typing indicator trigger

9. Socket events to handle:
   - message:new - add to messages
   - message:read - update read status
   - typing:update - show typing indicator
   - user:online/offline - update status

10. Emit events:
    - message:send - send new message
    - message:read - mark as read
    - typing:start/stop - typing status
```

### Prompt 2: Implement Notifications

```
Implement the notifications system:

1. Create src/app/(main)/notifications/page.tsx:
   - Full notifications list
   - Mark all as read button
   - Filter by type
   - Infinite scroll
   - Empty state

2. Create src/components/notifications/notifications-dropdown.tsx:
   - Header dropdown trigger (bell icon)
   - Badge with unread count
   - Recent notifications list
   - "View all" link
   - Mark all as read

3. Create src/components/notifications/notification-item.tsx:
   - Icon based on type
   - Title and body
   - Timestamp
   - Unread indicator
   - Click to navigate

4. Create src/hooks/use-notifications.ts:
   - Fetch notifications
   - Real-time updates via socket
   - Mark as read
   - Unread count

5. Handle notification types:
   - new_follower -> link to profile
   - post_like -> link to post
   - post_comment -> link to post
   - comment_reply -> link to comment
   - new_message -> link to chat
   - thread_reply -> link to thread
   - listing_inquiry -> link to listing

6. Set up push notifications:
   - Request notification permission
   - Register service worker
   - Send device token to backend
   - Handle notification click

7. Create src/lib/push-notifications.ts:
   - Request permission
   - Get FCM token
   - Register with backend
   - Handle token refresh

8. Add notification sound (optional):
   - Play sound on new notification
   - Respect user preferences

9. Update header to show:
   - Notification bell
   - Unread count badge
   - Dropdown on click
```

### Prompt 3: Set Up PWA

```
Configure the application as a PWA:

1. Install next-pwa:
   npm install next-pwa

2. Update next.config.js:
   - Configure next-pwa
   - Set up caching strategies
   - Disable in development

3. Create public/manifest.json:
   - App name and description
   - Theme colors
   - Icons (192x192, 512x512, maskable)
   - Start URL
   - Display mode

4. Create app icons:
   - /public/icons/icon-192x192.png
   - /public/icons/icon-512x512.png
   - /public/icons/icon-maskable-512x512.png
   - Favicon variations

5. Add meta tags in layout.tsx:
   - theme-color
   - apple-mobile-web-app-capable
   - apple-mobile-web-app-status-bar-style

6. Create offline fallback page:
   - /public/offline.html
   - Simple message when offline
   - Retry button

7. Create install prompt component:
   src/components/shared/install-prompt.tsx
   - Detect installable state
   - Show install button/banner
   - Handle install event
   - Dismiss option

8. Configure service worker caching:
   - NetworkFirst for API calls
   - CacheFirst for images
   - StaleWhileRevalidate for static assets

9. Handle offline state:
   - Show offline indicator
   - Queue actions for sync
   - Show cached content

10. Test PWA:
    - Lighthouse PWA audit
    - Install on mobile
    - Test offline behavior
```

### Prompt 4: Optimize SEO

```
Implement SEO optimizations:

1. Set up base metadata in app/layout.tsx:
   - Title template
   - Default description
   - OpenGraph defaults
   - Twitter card defaults
   - Robots configuration

2. Create dynamic metadata for each page:

   Listing page:
   - Title: listing title
   - Description: price + truncated description
   - OG image: first listing image

   Profile page:
   - Title: user's name
   - Description: bio
   - OG image: avatar or default

   Thread page:
   - Title: thread title
   - Description: first 150 chars
   - OG image: category or default

3. Create dynamic OG images:
   src/app/api/og/route.tsx
   - Use @vercel/og
   - Generate image with title, description
   - Brand styling

4. Add structured data (JSON-LD):

   For listings:
   - Product schema
   - Price, condition, seller

   For services:
   - LocalBusiness schema
   - Address, hours, reviews

   For forum:
   - DiscussionForumPosting schema

5. Create sitemap:
   src/app/sitemap.ts
   - Static pages
   - Dynamic listings
   - User profiles (public)
   - Forum threads

6. Create robots.txt:
   src/app/robots.ts
   - Allow all crawlers
   - Sitemap reference
   - Disallow admin, api

7. Implement canonical URLs:
   - Add canonical link tag
   - Handle pagination
   - Handle filters

8. Optimize for Core Web Vitals:
   - Largest Contentful Paint (LCP)
   - First Input Delay (FID)
   - Cumulative Layout Shift (CLS)
```

### Prompt 5: Add Testing

```
Set up comprehensive testing:

1. Install testing dependencies:
   npm install -D jest @testing-library/react @testing-library/jest-dom
   npm install -D @playwright/test

2. Configure Jest:
   - Create jest.config.js
   - Create jest.setup.js
   - Add test scripts to package.json

3. Write unit tests for utilities:
   __tests__/lib/utils.test.ts
   - cn() function
   - formatDate()
   - formatPrice()
   - validateImage()

4. Write component tests:
   __tests__/components/
   - Button.test.tsx
   - PostCard.test.tsx
   - UserAvatar.test.tsx
   - Form components

5. Write hook tests:
   __tests__/hooks/
   - useAuth.test.ts
   - useDebounce.test.ts
   - useInfiniteScroll.test.ts

6. Set up Playwright:
   - Create playwright.config.ts
   - Configure browsers
   - Set up web server

7. Write E2E tests:
   e2e/
   - auth.spec.ts (login, register, logout)
   - feed.spec.ts (view, like, comment)
   - marketplace.spec.ts (browse, create)
   - navigation.spec.ts (routing)

8. Add to CI pipeline:
   .github/workflows/test.yml
   - Run Jest tests
   - Run Playwright tests
   - Upload coverage

9. Create test utilities:
   __tests__/utils/
   - renderWithProviders
   - mockRouter
   - createMockPost
   - createMockUser
```

### Prompt 6: Optimize Performance

```
Implement performance optimizations:

1. Analyze bundle size:
   - Run: npm run build
   - Check .next/analyze
   - Identify large dependencies

2. Implement code splitting:
   - Dynamic imports for heavy components
   - Lazy load modals
   - Route-based splitting (automatic)

3. Optimize images:
   - Use next/image everywhere
   - Set proper sizes
   - Use blur placeholders
   - Lazy loading

4. Implement virtualization:
   - Install @tanstack/react-virtual
   - Virtualize long lists (feed, comments)
   - Improve scroll performance

5. Optimize TanStack Query:
   - Set appropriate staleTime
   - Use placeholderData
   - Implement infinite queries properly
   - Prefetch on hover

6. Add loading skeletons:
   - Skeleton for every data-dependent component
   - Match actual content layout
   - Reduce layout shift

7. Minimize re-renders:
   - Use React.memo strategically
   - Optimize context usage
   - Use useCallback/useMemo appropriately

8. Optimize fonts:
   - Use next/font
   - Preload critical fonts
   - Use font-display: swap

9. Set up performance monitoring:
   - Vercel Analytics
   - Or custom Web Vitals tracking
   - Monitor in production

10. Create performance budget:
    - Max bundle size
    - Max LCP time
    - Max CLS score
    - Alert on regression
```

### Prompt 7: Deploy to Production

```
Configure production deployment:

1. Create Vercel project:
   - Connect GitHub repository
   - Configure build settings
   - Set framework preset to Next.js

2. Set up environment variables in Vercel:
   - NEXT_PUBLIC_API_URL
   - NEXT_PUBLIC_WS_URL
   - NEXTAUTH_URL
   - NEXTAUTH_SECRET
   - (All other env vars)

3. Configure custom domain:
   - Add domain in Vercel
   - Update DNS records
   - Wait for SSL certificate

4. Set up preview deployments:
   - Auto-deploy on PR
   - Unique URL per PR
   - Environment variables for preview

5. Configure Sentry for error monitoring:
   - Install @sentry/nextjs
   - Configure sentry.client.config.ts
   - Configure sentry.server.config.ts
   - Set SENTRY_DSN env var

6. Set up analytics (optional):
   - Vercel Analytics
   - Or Google Analytics
   - Privacy-compliant setup

7. Create deployment checklist:
   Pre-deployment:
   - [ ] All tests pass
   - [ ] Build succeeds
   - [ ] Environment variables set
   - [ ] API URL correct

   Post-deployment:
   - [ ] Site loads correctly
   - [ ] Auth works
   - [ ] API connection works
   - [ ] No console errors

8. Set up monitoring:
   - Uptime monitoring
   - Error rate alerts
   - Performance alerts

9. Document deployment process:
   - How to deploy
   - How to rollback
   - How to check logs
```

---

## Testing Checklist

### Chat Tests

- [ ] Socket connects on auth
- [ ] Socket disconnects on logout
- [ ] Messages send and receive
- [ ] Typing indicator shows
- [ ] Online status updates
- [ ] Read receipts work

### Notification Tests

- [ ] Notifications load
- [ ] Real-time updates work
- [ ] Mark as read works
- [ ] Click navigates correctly
- [ ] Badge count updates

### PWA Tests

- [ ] Manifest loads correctly
- [ ] Service worker registers
- [ ] App is installable
- [ ] Offline page shows
- [ ] Cached content loads offline

### SEO Tests

- [ ] Meta tags render server-side
- [ ] OG images generate
- [ ] Sitemap is accessible
- [ ] Robots.txt is correct
- [ ] Structured data validates

### Performance Tests

- [ ] Lighthouse score > 90
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Bundle size within budget

### E2E Tests

- [ ] Login flow works
- [ ] Registration flow works
- [ ] Feed loads and scrolls
- [ ] Post creation works
- [ ] Navigation works

---

## Completion Criteria

Phase 6 is complete when:

1. **Chat works** in real-time with all features
2. **Notifications** display and update live
3. **PWA** is installable and works offline
4. **SEO** is optimized for all pages
5. **Tests** cover critical functionality
6. **Performance** meets targets
7. **Production deployment** is stable

---

## Notes

- Monitor WebSocket connection stability
- Set up alerts for high error rates
- Regularly audit dependencies
- Keep bundle size in check
- Document all deployment procedures
- Create runbook for common issues
- Plan for scale (WebSocket limits, etc.)

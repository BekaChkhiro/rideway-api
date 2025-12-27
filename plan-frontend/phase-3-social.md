# Phase 3: Social Features

## Overview

This phase implements the core social media functionality: personalized feed, posts with images and hashtags, stories with 24-hour expiration, comments with threading, likes, and sharing. These features create the engaging social experience of the app.

## Goals

- Build personalized feed with infinite scroll
- Create post creation with multi-image support
- Implement stories viewing and creation
- Build threaded comments system
- Add like/unlike functionality
- Implement hashtag system
- Create explore/discover page

---

## Tasks

### 3.1 Feed

- [ ] Create feed page with infinite scroll
- [ ] Implement pull-to-refresh (mobile)
- [ ] Add feed loading skeletons
- [ ] Create empty feed state
- [ ] Implement feed refresh on new post

### 3.2 Posts

- [ ] Create post card component
- [ ] Implement post creation modal
- [ ] Add multi-image gallery in posts
- [ ] Implement hashtag parsing and linking
- [ ] Add mention detection and linking
- [ ] Create single post page
- [ ] Implement post editing
- [ ] Implement post deletion
- [ ] Add post sharing/repost

### 3.3 Stories

- [ ] Create stories bar component
- [ ] Implement story viewer (fullscreen)
- [ ] Add story creation flow
- [ ] Implement story progress indicators
- [ ] Create story navigation (tap/swipe)
- [ ] Show story viewers list (for own stories)
- [ ] Add story replies

### 3.4 Comments

- [ ] Create comment section component
- [ ] Implement nested/threaded comments
- [ ] Add comment creation form
- [ ] Implement comment editing
- [ ] Implement comment deletion
- [ ] Add comment likes
- [ ] Create "load more replies" functionality

### 3.5 Interactions

- [ ] Implement like button with animation
- [ ] Add bookmark/save post functionality
- [ ] Create share modal (copy link, share to...)
- [ ] Implement report post/comment
- [ ] Add "not interested" option

### 3.6 Explore

- [ ] Create explore page layout
- [ ] Implement trending posts section
- [ ] Add trending hashtags
- [ ] Create discover users section
- [ ] Implement hashtag page

---

## Technical Details

### Page Structure

```
src/app/(main)/
├── feed/
│   └── page.tsx                    # Main feed
├── explore/
│   └── page.tsx                    # Explore/discover
├── posts/
│   └── [id]/
│       └── page.tsx                # Single post view
├── hashtag/
│   └── [tag]/
│       └── page.tsx                # Posts by hashtag
└── stories/
    └── [userId]/
        └── page.tsx                # Story viewer (optional)
```

### Component Structure

```
src/components/
├── feed/
│   ├── feed.tsx                    # Feed container
│   ├── post-card.tsx               # Post card
│   ├── post-header.tsx             # Author info, menu
│   ├── post-content.tsx            # Text content
│   ├── post-images.tsx             # Image gallery
│   ├── post-actions.tsx            # Like, comment, share
│   ├── post-stats.tsx              # Likes, comments count
│   └── post-skeleton.tsx           # Loading skeleton
├── posts/
│   ├── create-post-modal.tsx       # Post creation dialog
│   ├── create-post-form.tsx        # Form with inputs
│   ├── post-editor.tsx             # Text editor with hashtags
│   ├── image-gallery.tsx           # Multi-image display
│   ├── image-lightbox.tsx          # Fullscreen image view
│   └── share-modal.tsx             # Share options
├── stories/
│   ├── stories-bar.tsx             # Horizontal stories list
│   ├── story-avatar.tsx            # Avatar with ring
│   ├── story-viewer.tsx            # Fullscreen viewer
│   ├── story-progress.tsx          # Progress bars
│   ├── story-content.tsx           # Story image/video
│   ├── create-story-modal.tsx      # Story creation
│   └── story-viewers.tsx           # Viewers list
├── comments/
│   ├── comments-section.tsx        # Comments container
│   ├── comment-item.tsx            # Single comment
│   ├── comment-form.tsx            # Add comment input
│   ├── comment-replies.tsx         # Nested replies
│   └── comment-skeleton.tsx        # Loading skeleton
└── explore/
    ├── trending-posts.tsx          # Trending posts grid
    ├── trending-hashtags.tsx       # Hashtag list
    ├── suggested-users.tsx         # User suggestions
    └── explore-grid.tsx            # Masonry grid layout
```

### Post Types

```typescript
// types/post.ts
export interface Post {
  id: string;
  userId: string;
  content: string;
  visibility: 'public' | 'followers' | 'private';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isEdited: boolean;
  originalPostId?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  images: PostImage[];
  hashtags: string[];
  isLiked: boolean;
  isBookmarked: boolean;
}

export interface PostImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  sortOrder: number;
}

export interface CreatePostInput {
  content: string;
  visibility: 'public' | 'followers' | 'private';
  images?: File[];
}

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  viewsCount: number;
  expiresAt: string;
  createdAt: string;
  hasViewed: boolean;
}

export interface StoryGroup {
  userId: string;
  username: string;
  avatarUrl?: string;
  hasUnviewed: boolean;
  stories: Story[];
}

export interface Comment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  isLiked: boolean;
  replies?: Comment[];
}
```

### API Hooks

```typescript
// lib/api/hooks/use-posts.ts
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// Get feed
export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<Post[]>>('/posts/feed', {
        page: String(pageParam),
        limit: '10',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 10) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
  });
}

// Get single post
export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => api.get<ApiResponse<Post>>(`/posts/${id}`),
    enabled: !!id,
  });
}

// Create post
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const formData = new FormData();
      formData.append('content', data.content);
      formData.append('visibility', data.visibility);
      data.images?.forEach((image) => {
        formData.append('images', image);
      });
      return api.upload<ApiResponse<Post>>('/posts', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Update post
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch<ApiResponse<Post>>(`/posts/${id}`, { content }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// Delete post
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse<void>>(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Like post
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<void>>(`/posts/${id}/like`),
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['posts', id] });

      const previousPost = queryClient.getQueryData(['posts', id]);

      queryClient.setQueryData(['posts', id], (old: any) => ({
        ...old,
        data: {
          ...old.data,
          isLiked: !old.data.isLiked,
          likesCount: old.data.isLiked
            ? old.data.likesCount - 1
            : old.data.likesCount + 1,
        },
      }));

      return { previousPost };
    },
    onError: (_, id, context) => {
      queryClient.setQueryData(['posts', id], context?.previousPost);
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: ['posts', id] });
    },
  });
}

// Get posts by hashtag
export function usePostsByHashtag(hashtag: string) {
  return useInfiniteQuery({
    queryKey: ['posts', 'hashtag', hashtag],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<Post[]>>(`/posts/hashtag/${hashtag}`, {
        page: String(pageParam),
        limit: '10',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 10) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!hashtag,
  });
}

// Get user posts
export function useUserPosts(userId: string) {
  return useInfiniteQuery({
    queryKey: ['posts', 'user', userId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<Post[]>>(`/posts/user/${userId}`, {
        page: String(pageParam),
        limit: '10',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 10) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });
}
```

```typescript
// lib/api/hooks/use-stories.ts
export function useStoryFeed() {
  return useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: () => api.get<ApiResponse<StoryGroup[]>>('/stories/feed'),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUserStories(userId: string) {
  return useQuery({
    queryKey: ['stories', 'user', userId],
    queryFn: () => api.get<ApiResponse<Story[]>>(`/stories/user/${userId}`),
    enabled: !!userId,
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { file: File; caption?: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.caption) formData.append('caption', data.caption);
      return api.upload<ApiResponse<Story>>('/stories', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useMarkStoryViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) =>
      api.post<ApiResponse<void>>(`/stories/${storyId}/view`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useStoryViewers(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'viewers'],
    queryFn: () =>
      api.get<ApiResponse<{ id: string; username: string; avatarUrl?: string }[]>>(
        `/stories/${storyId}/viewers`
      ),
    enabled: !!storyId,
  });
}
```

```typescript
// lib/api/hooks/use-comments.ts
export function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`, {
        page: String(pageParam),
        limit: '20',
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 20) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!postId,
  });
}

export function useCommentReplies(commentId: string) {
  return useQuery({
    queryKey: ['comments', commentId, 'replies'],
    queryFn: () =>
      api.get<ApiResponse<Comment[]>>(`/comments/${commentId}/replies`),
    enabled: !!commentId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      content,
      parentId,
    }: {
      postId: string;
      content: string;
      parentId?: string;
    }) =>
      api.post<ApiResponse<Comment>>(`/posts/${postId}/comments`, {
        content,
        parentId,
      }),
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts', postId] });
    },
  });
}

export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      api.post<ApiResponse<void>>(`/comments/${commentId}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete<ApiResponse<void>>(`/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
```

### Post Card Component

```typescript
// components/feed/post-card.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageGallery } from './image-gallery';
import { useLikePost } from '@/lib/api/hooks/use-posts';
import { cn } from '@/lib/utils';
import type { Post } from '@/types/post';

interface PostCardProps {
  post: Post;
  showFullContent?: boolean;
}

export function PostCard({ post, showFullContent = false }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);

  const likeMutation = useLikePost();

  const handleLike = () => {
    // Optimistic update
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    likeMutation.mutate(post.id, {
      onError: () => {
        // Revert on error
        setIsLiked(isLiked);
        setLikesCount(likesCount);
      },
    });
  };

  const content = showFullContent
    ? post.content
    : post.content.length > 300
    ? `${post.content.slice(0, 300)}...`
    : post.content;

  return (
    <article className="border-b bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <Link href={`/${post.user.username}`} className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.user.avatarUrl} />
            <AvatarFallback>{post.user.fullName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold hover:underline">{post.user.fullName}</p>
            <p className="text-sm text-muted-foreground">
              @{post.user.username} · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Copy link</DropdownMenuItem>
            <DropdownMenuItem>Not interested</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Report</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="mt-3">
        <p className="whitespace-pre-wrap">
          <PostContent content={content} />
        </p>
        {!showFullContent && post.content.length > 300 && (
          <Link href={`/posts/${post.id}`} className="text-primary hover:underline">
            Show more
          </Link>
        )}
      </div>

      {/* Images */}
      {post.images.length > 0 && (
        <div className="mt-3">
          <ImageGallery images={post.images} />
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Like */}
          <button
            onClick={handleLike}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary"
          >
            <Heart
              className={cn('h-5 w-5', isLiked && 'fill-primary text-primary')}
            />
            <span>{likesCount}</span>
          </button>

          {/* Comment */}
          <Link
            href={`/posts/${post.id}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary"
          >
            <MessageCircle className="h-5 w-5" />
            <span>{post.commentsCount}</span>
          </Link>

          {/* Share */}
          <button className="flex items-center gap-2 text-muted-foreground hover:text-primary">
            <Share2 className="h-5 w-5" />
            <span>{post.sharesCount}</span>
          </button>
        </div>

        {/* Bookmark */}
        <button className="text-muted-foreground hover:text-primary">
          <Bookmark className={cn('h-5 w-5', post.isBookmarked && 'fill-current')} />
        </button>
      </div>
    </article>
  );
}

// Parse and render hashtags and mentions
function PostContent({ content }: { content: string }) {
  const parts = content.split(/(#\w+|@\w+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          return (
            <Link
              key={i}
              href={`/hashtag/${part.slice(1)}`}
              className="text-primary hover:underline"
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith('@')) {
          return (
            <Link
              key={i}
              href={`/${part.slice(1)}`}
              className="text-primary hover:underline"
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}
```

### Story Viewer Component

```typescript
// components/stories/story-viewer.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useMarkStoryViewed } from '@/lib/api/hooks/use-stories';
import { formatDistanceToNow } from 'date-fns';
import type { StoryGroup, Story } from '@/types/post';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

export function StoryViewer({
  storyGroups,
  initialGroupIndex,
  onClose,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  const markViewed = useMarkStoryViewed();

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && !currentStory.hasViewed) {
      markViewed.mutate(currentStory.id);
    }
  }, [currentStory?.id]);

  // Progress timer
  useEffect(() => {
    if (isPaused) return;

    const duration = 5000; // 5 seconds per story
    const interval = 50;
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, storyIndex, groupIndex]);

  const goToNext = useCallback(() => {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, currentGroup, storyGroups.length, onClose]);

  const goToPrevious = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      const prevGroup = storyGroups[groupIndex - 1];
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [storyIndex, groupIndex, storyGroups]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious, onClose]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Progress bars */}
      <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-2">
        {currentGroup.stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-all"
              style={{
                width:
                  i < storyIndex
                    ? '100%'
                    : i === storyIndex
                    ? `${progress}%`
                    : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute left-0 right-0 top-4 z-10 flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white">
            <AvatarImage src={currentGroup.avatarUrl} />
            <AvatarFallback>{currentGroup.username.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-white">
            <p className="font-semibold">{currentGroup.username}</p>
            <p className="text-sm opacity-80">
              {formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Story content */}
      <div
        className="flex h-full items-center justify-center"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <img
          src={currentStory.mediaUrl}
          alt=""
          className="h-full w-full object-contain"
        />

        {/* Navigation areas */}
        <button
          className="absolute left-0 top-0 h-full w-1/3"
          onClick={goToPrevious}
        />
        <button
          className="absolute right-0 top-0 h-full w-1/3"
          onClick={goToNext}
        />
      </div>

      {/* Caption */}
      {currentStory.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-4">
          <p className="text-white">{currentStory.caption}</p>
        </div>
      )}

      {/* Views count (for own stories) */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white/80">
        <Eye className="h-4 w-4" />
        <span>{currentStory.viewsCount}</span>
      </div>

      {/* Navigation arrows (desktop) */}
      <button
        className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 md:block"
        onClick={goToPrevious}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 md:block"
        onClick={goToNext}
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}
```

---

## Claude Code Prompts

### Prompt 1: Create Feed Page

```
Create the main feed page with infinite scroll:

1. Create src/app/(main)/feed/page.tsx:
   - Default route after login
   - Show stories bar at top
   - Show personalized post feed
   - Infinite scroll with useInfiniteQuery
   - Pull-to-refresh on mobile
   - Empty state for new users
   - Create post button (FAB on mobile)

2. Create src/components/feed/feed.tsx:
   - Container for post list
   - Infinite scroll with Intersection Observer
   - Loading skeletons
   - Error retry button
   - End of feed message

3. Create src/components/feed/post-skeleton.tsx:
   - Skeleton matching PostCard layout
   - Avatar, lines for text, image placeholder

4. Create src/components/feed/empty-feed.tsx:
   - Illustration
   - "No posts yet" message
   - Suggestions to follow users
   - Link to explore

5. Create src/hooks/use-infinite-scroll.ts:
   - Reusable hook for infinite scroll
   - Intersection Observer based
   - Loading and hasMore states

6. Handle feed refresh:
   - Manual refresh button
   - New posts indicator
   - Auto-refresh on new post creation

7. Implement virtualization (optional):
   - Use react-virtual for large lists
   - Improve scroll performance
```

### Prompt 2: Create Post Components

```
Create post display and interaction components:

1. Create src/components/feed/post-card.tsx:
   - Author header (avatar, name, time, menu)
   - Text content with hashtag/mention parsing
   - Image gallery (1-4 images grid)
   - Action buttons (like, comment, share, bookmark)
   - Stats display

2. Create src/components/feed/post-images.tsx:
   - Grid layout based on image count:
     - 1 image: full width
     - 2 images: side by side
     - 3 images: one large + two small
     - 4+ images: grid with +N overlay
   - Click to open lightbox
   - Lazy loading

3. Create src/components/posts/image-lightbox.tsx:
   - Fullscreen image view
   - Swipe/arrow navigation
   - Zoom support
   - Close button
   - Image counter

4. Create src/components/posts/share-modal.tsx:
   - Copy link button
   - Share to Twitter/Facebook (optional)
   - Repost option
   - Send to user (future)

5. Create like animation:
   - Heart fill animation
   - Double-tap to like (on images)
   - Haptic feedback (mobile)

6. Create src/app/(main)/posts/[id]/page.tsx:
   - Single post view
   - Full content display
   - Comments section
   - SEO metadata
   - Share meta tags

7. Implement post interactions:
   - Optimistic like/unlike
   - Bookmark with toast feedback
   - Share with copy confirmation
```

### Prompt 3: Create Post Creation

```
Create post creation functionality:

1. Create src/components/posts/create-post-modal.tsx:
   - Dialog/sheet for post creation
   - Trigger from FAB or header button
   - Close confirmation if has content

2. Create src/components/posts/create-post-form.tsx:
   - Textarea with auto-resize
   - Character count (optional limit)
   - Hashtag highlighting as you type
   - Mention autocomplete
   - Visibility selector (public/followers)
   - Submit button with loading state

3. Create src/components/posts/post-editor.tsx:
   - Rich text area
   - Detect and highlight hashtags (#)
   - Detect and highlight mentions (@)
   - Show mention suggestions dropdown
   - Emoji picker button

4. Create image attachment:
   - Add images button
   - Drag and drop zone
   - Preview thumbnails
   - Remove individual images
   - Reorder images
   - Max 4 images

5. Create src/hooks/use-mention-suggestions.ts:
   - Debounced user search
   - Show dropdown at cursor
   - Insert selected mention

6. Validation:
   - Content required (unless images)
   - Max content length (if set)
   - Max 4 images
   - Valid image types

7. After post creation:
   - Close modal
   - Show success toast
   - Add to feed (optimistic or refetch)
   - Navigate to post (optional)
```

### Prompt 4: Create Stories Components

```
Create the stories feature:

1. Create src/components/stories/stories-bar.tsx:
   - Horizontal scrollable list
   - First item: "Your Story" (add story)
   - User story avatars with ring
   - Unviewed = colored ring, viewed = gray ring
   - Click to open viewer
   - Skeleton loading state

2. Create src/components/stories/story-avatar.tsx:
   - Avatar with gradient ring
   - Pulse animation for unviewed
   - "+" overlay for "Your Story"
   - Size variants

3. Create src/components/stories/story-viewer.tsx:
   - Fullscreen overlay
   - Progress bars at top
   - User info header
   - Story image/video content
   - Caption at bottom
   - Navigation: tap sides, swipe, arrows
   - Pause on hold
   - Keyboard navigation
   - Close button

4. Create src/components/stories/story-progress.tsx:
   - Multiple progress bars
   - Auto-advance timer (5s)
   - Pause/resume support

5. Create src/components/stories/create-story-modal.tsx:
   - File upload (image/video)
   - Preview before posting
   - Add caption
   - Post button
   - Camera capture (optional)

6. Create src/components/stories/story-viewers.tsx:
   - List of users who viewed (for own stories)
   - Avatar + username
   - Swipe up to show

7. Handle story navigation:
   - Between stories of same user
   - Between different users
   - Auto-advance to next user
   - Close at end

8. Mark stories as viewed:
   - Call API when story is displayed
   - Update UI to show viewed state
```

### Prompt 5: Create Comments System

```
Create the comments section and interactions:

1. Create src/components/comments/comments-section.tsx:
   - Container for post comments
   - Comments list with infinite scroll
   - Comment input at bottom (fixed on mobile)
   - Comments count header
   - Sort options (newest, popular)

2. Create src/components/comments/comment-item.tsx:
   - Avatar + username + time
   - Comment content
   - Like button + count
   - Reply button
   - More menu (edit, delete, report)
   - Nested replies (indented)

3. Create src/components/comments/comment-form.tsx:
   - Input field
   - Submit button
   - Character count (optional)
   - Reply indicator (when replying)
   - Cancel reply button

4. Create src/components/comments/comment-replies.tsx:
   - Show first 2-3 replies
   - "Load more replies" button
   - Nested indentation (max 2 levels)
   - Reply form inline

5. Implement comment actions:
   - Create comment (root or reply)
   - Like/unlike comment
   - Edit own comment
   - Delete own comment
   - Report comment

6. Create comment skeletons:
   - Loading state for initial load
   - Loading state for "load more"

7. Optimistic updates:
   - Add comment immediately
   - Show pending state
   - Handle errors with retry

8. Mobile optimizations:
   - Fixed input at bottom
   - Keyboard handling
   - Scroll to new comment
```

### Prompt 6: Create Explore Page

```
Create the explore/discover page:

1. Create src/app/(main)/explore/page.tsx:
   - Trending posts section
   - Trending hashtags
   - Suggested users
   - Search integration

2. Create src/components/explore/trending-posts.tsx:
   - Grid/masonry layout
   - Post thumbnails
   - Engagement stats overlay
   - Click to open post

3. Create src/components/explore/trending-hashtags.tsx:
   - List of popular hashtags
   - Post count for each
   - Click to view hashtag page

4. Create src/components/explore/suggested-users.tsx:
   - Horizontal scroll on mobile
   - Grid on desktop
   - User cards with follow button
   - Based on: popular, similar interests

5. Create src/app/(main)/hashtag/[tag]/page.tsx:
   - Hashtag header with stats
   - Posts with this hashtag
   - Infinite scroll
   - Follow hashtag (optional)

6. Create explore grid layout:
   - Masonry grid for variety
   - Responsive columns
   - Lazy load images
   - Hover effects

7. API integration:
   - useTrendingPosts()
   - useTrendingHashtags()
   - useSuggestedUsers()
   - usePostsByHashtag(tag)

8. SEO for hashtag pages:
   - Dynamic meta tags
   - Open Graph images
```

---

## Testing Checklist

### Feed Tests

- [ ] Feed loads with infinite scroll
- [ ] Pull-to-refresh works (mobile)
- [ ] Empty state shows for new users
- [ ] Post cards render correctly
- [ ] Like/unlike works with animation
- [ ] Comments count updates

### Post Tests

- [ ] Post creation works
- [ ] Multiple images upload works
- [ ] Hashtags are parsed and linked
- [ ] Mentions are parsed and linked
- [ ] Post edit works
- [ ] Post delete works
- [ ] Single post page loads

### Stories Tests

- [ ] Stories bar loads
- [ ] Story viewer opens
- [ ] Progress bar advances
- [ ] Navigation works (tap, swipe, keyboard)
- [ ] Story creation works
- [ ] Stories expire after 24h

### Comments Tests

- [ ] Comments load for post
- [ ] Add comment works
- [ ] Reply to comment works
- [ ] Nested replies display correctly
- [ ] Like comment works
- [ ] Delete comment works

### Explore Tests

- [ ] Trending posts display
- [ ] Trending hashtags display
- [ ] Hashtag page loads
- [ ] Suggested users display

### Performance Tests

- [ ] Feed scrolls smoothly
- [ ] Images lazy load
- [ ] No memory leaks on navigation
- [ ] Stories viewer performs well

---

## Completion Criteria

Phase 3 is complete when:

1. **Feed works** - infinite scroll, refresh, post display
2. **Posts work** - create, edit, delete, like, share
3. **Stories work** - view, create, progress, navigation
4. **Comments work** - create, reply, like, nest
5. **Explore works** - trending, hashtags, suggestions
6. **All interactions** have loading and error states
7. **Mobile experience** is smooth and intuitive

---

## Notes

- Optimize image loading with blur placeholders
- Cache feed data for quick back navigation
- Consider offline support for drafts
- Add haptic feedback on mobile (like, etc.)
- Monitor infinite scroll performance
- Consider virtualization for very long feeds
- Test story viewer on different screen sizes

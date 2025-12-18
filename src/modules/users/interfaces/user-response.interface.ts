export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  dateOfBirth?: Date;
  gender?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;
  isBlocked?: boolean;
  createdAt: Date;
}

export interface UserListItemResponse {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  isFollowing?: boolean;
}

export interface PaginatedUsersResponse {
  items: UserListItemResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

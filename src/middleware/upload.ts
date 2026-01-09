import multer from 'multer';
import { AppError } from './error-handler';

// File size limits (in bytes)
export const FILE_LIMITS = {
  avatar: 5 * 1024 * 1024, // 5MB
  cover: 10 * 1024 * 1024, // 10MB
  postImage: 10 * 1024 * 1024, // 10MB
  listingImage: 10 * 1024 * 1024, // 10MB
  storyMedia: 50 * 1024 * 1024, // 50MB (for video support)
} as const;

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export const ALLOWED_STORY_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Multer memory storage (files stored in memory buffer)
const storage = multer.memoryStorage();

// File filter for images
const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG, and WebP images are allowed'));
  }
};

// Avatar upload (single file, 5MB limit)
export const uploadAvatar = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.avatar },
  fileFilter: imageFileFilter,
}).single('avatar');

// Cover upload (single file, 10MB limit)
export const uploadCover = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.cover },
  fileFilter: imageFileFilter,
}).single('cover');

// Post images upload (multiple files, max 10, 10MB each)
export const uploadPostImages = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.postImage },
  fileFilter: imageFileFilter,
}).array('images', 10);

// Listing images upload (multiple files, max 20, 10MB each)
export const uploadListingImages = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.listingImage },
  fileFilter: imageFileFilter,
}).array('images', 20);

// Service images upload (multiple files, max 10, 10MB each)
export const uploadServiceImages = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.postImage },
  fileFilter: imageFileFilter,
}).array('images', 10);

// Generic single image upload
export const uploadSingleImage = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.postImage },
  fileFilter: imageFileFilter,
}).single('image');

// Story media file filter (images + videos)
const storyFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_STORY_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        'INVALID_FILE_TYPE',
        'Only JPEG, PNG, WebP images and MP4, MOV, WebM videos are allowed'
      )
    );
  }
};

// Story upload (single file, 50MB limit for video support)
export const uploadStoryMedia = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.storyMedia },
  fileFilter: storyFileFilter,
}).single('media');

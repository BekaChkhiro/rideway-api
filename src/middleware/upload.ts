import multer from 'multer';
import { AppError } from './error-handler';

// File size limits (in bytes)
export const FILE_LIMITS = {
  avatar: 5 * 1024 * 1024, // 5MB
  cover: 10 * 1024 * 1024, // 10MB
  postImage: 10 * 1024 * 1024, // 10MB
  listingImage: 10 * 1024 * 1024, // 10MB
} as const;

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

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

// Generic single image upload
export const uploadSingleImage = multer({
  storage,
  limits: { fileSize: FILE_LIMITS.postImage },
  fileFilter: imageFileFilter,
}).single('image');

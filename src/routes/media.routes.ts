import { Router } from 'express';
import * as mediaController from '../controllers/media.controller';
import { authenticate } from '../middleware/auth';
import { uploadAvatar, uploadCover } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Avatar
router.patch('/avatar', uploadAvatar, mediaController.uploadAvatar);
router.delete('/avatar', mediaController.deleteAvatar);

// Cover
router.patch('/cover', uploadCover, mediaController.uploadCover);
router.delete('/cover', mediaController.deleteCover);

export default router;

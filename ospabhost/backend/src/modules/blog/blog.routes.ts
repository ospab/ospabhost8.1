import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  getAllPosts,
  getPostByUrl,
  addComment,
  getAllPostsAdmin,
  getPostByIdAdmin,
  createPost,
  updatePost,
  deletePost,
  getAllComments,
  moderateComment,
  deleteComment
} from './blog.controller';
import { uploadImage, deleteImage } from './upload.controller';
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from '../auth/auth.middleware';

// Конфигурация multer для загрузки изображений
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../../uploads/blog'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (jpeg, jpg, png, gif, webp)'));
    }
  }
});

const router = Router();

// Публичные маршруты
router.get('/posts', getAllPosts);
router.get('/posts/:url', getPostByUrl);
router.post('/posts/:postId/comments', optionalAuthMiddleware, addComment); // Гости и авторизованные могут комментировать

// Админские маршруты
router.post('/admin/upload-image', authMiddleware, adminMiddleware, upload.single('image'), uploadImage);
router.delete('/admin/images/:filename', authMiddleware, adminMiddleware, deleteImage);

router.get('/admin/posts', authMiddleware, adminMiddleware, getAllPostsAdmin);
router.get('/admin/posts/:id', authMiddleware, adminMiddleware, getPostByIdAdmin);
router.post('/admin/posts', authMiddleware, adminMiddleware, createPost);
router.put('/admin/posts/:id', authMiddleware, adminMiddleware, updatePost);
router.delete('/admin/posts/:id', authMiddleware, adminMiddleware, deletePost);

router.get('/admin/comments', authMiddleware, adminMiddleware, getAllComments);
router.patch('/admin/comments/:id', authMiddleware, adminMiddleware, moderateComment);
router.delete('/admin/comments/:id', authMiddleware, adminMiddleware, deleteComment);

export default router;

import { Router } from 'express';
import { uploadCheck, getChecks, approveCheck, rejectCheck, getUserChecks, viewCheck, getCheckFile } from './check.controller';
import { authMiddleware } from '../auth/auth.middleware';
import multer, { MulterError } from 'multer';
import path from 'path';

const router = Router();

// Настройка Multer для загрузки чеков
const storage = multer.diskStorage({
	destination: function (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
		const uploadDir = path.join(__dirname, '../../../uploads/checks');
		// Проверяем и создаём директорию, если её нет
		try {
			require('fs').mkdirSync(uploadDir, { recursive: true });
		} catch (err) {
			// Игнорируем ошибку, если папка уже существует
		}
		cb(null, uploadDir);
	},
	filename: function (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + file.originalname);
	}
});
const allowedMimeTypes = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/jpg'
];

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB лимит
	fileFilter: (req, file, cb) => {
		if (allowedMimeTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			const err: any = new Error('Недопустимый формат файла. Разрешены только изображения: jpg, jpeg, png, gif, webp.');
			err.code = 'LIMIT_FILE_FORMAT';
			cb(err, false);
		}
	}
});

router.use(authMiddleware);

router.post('/upload', upload.single('file'), uploadCheck);
router.get('/', getChecks); // Для операторов - все чеки
router.get('/my', getUserChecks); // Для пользователей - свои чеки
router.get('/file/:filename', getCheckFile); // Получение файла чека с авторизацией
router.get('/:id', viewCheck); // Просмотр конкретного чека
router.post('/approve', approveCheck);
router.post('/reject', rejectCheck);

export default router;

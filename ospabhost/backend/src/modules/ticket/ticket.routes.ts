import { Router } from 'express';
import { 
  createTicket, 
  getTickets, 
  getTicketById,
  respondTicket, 
  closeTicket,
  updateTicketStatus,
  assignTicket,
  uploadTicketFiles
} from './ticket.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Получить все тикеты (с фильтрами для операторов)
router.get('/', getTickets);

// Получить один тикет по ID
router.get('/:id', getTicketById);

// Создать тикет
router.post('/create', createTicket);

// Ответить на тикет
router.post('/respond', respondTicket);

// Изменить статус тикета (только оператор)
router.post('/status', updateTicketStatus);

// Назначить тикет на оператора (только оператор)
router.post('/assign', assignTicket);

// Закрыть тикет
router.post('/close', closeTicket);

// Загрузить файлы к тикету (TODO: доделать обработку)
// router.post('/upload', uploadTicketFiles, (req, res) => {
//   res.json({ files: req.files });
// });

export default router;

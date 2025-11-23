import { prisma } from '../../prisma/client';
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/tickets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

export const uploadTicketFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  }
}).array('attachments', 5); // Максимум 5 файлов

// Создать тикет
export async function createTicket(req: Request, res: Response) {
  const { title, message, category = 'general', priority = 'normal' } = req.body;
  const userId = (req as any).user?.id;
  
  if (!userId) return res.status(401).json({ error: 'Нет авторизации' });
  if (!title || !message) {
    return res.status(400).json({ error: 'Необходимо указать title и message' });
  }
  
  try {
    const ticket = await prisma.ticket.create({
      data: { 
        title, 
        message, 
        userId,
        category,
        priority,
        status: 'open'
      },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    });
    
    // TODO: Отправить уведомление операторам о новом тикете
    
    res.json(ticket);
  } catch (err) {
    console.error('Ошибка создания тикета:', err);
    res.status(500).json({ error: 'Ошибка создания тикета' });
  }
}

// Получить тикеты (клиент — свои, оператор — все с фильтрами)
export async function getTickets(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const isOperator = Number((req as any).user?.operator) === 1;
  const { status, category, priority, assignedTo } = req.query;
  
  if (!userId) return res.status(401).json({ error: 'Нет авторизации' });
  
  try {
    const where: any = isOperator ? {} : { userId };
    
    // Фильтры (только для операторов)
    if (isOperator) {
      if (status) where.status = status;
      if (category) where.category = category;
      if (priority) where.priority = priority;
      if (assignedTo) where.assignedTo = Number(assignedTo);
    }
    
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        responses: { 
          include: { 
            operator: {
              select: { id: true, username: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        user: {
          select: { id: true, username: true, email: true }
        },
        attachments: true
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(tickets);
  } catch (err) {
    console.error('Ошибка получения тикетов:', err);
    res.status(500).json({ error: 'Ошибка получения тикетов' });
  }
}

// Получить один тикет по ID
export async function getTicketById(req: Request, res: Response) {
  const ticketId = Number(req.params.id);
  const userId = (req as any).user?.id;
  const isOperator = Number((req as any).user?.operator) === 1;
  
  if (!userId) return res.status(401).json({ error: 'Нет авторизации' });
  
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        responses: {
          where: isOperator ? {} : { isInternal: false }, // Клиенты не видят внутренние комментарии
          include: {
            operator: {
              select: { id: true, username: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        user: {
          select: { id: true, username: true, email: true }
        },
        attachments: true
      }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }
    
    // Проверка прав доступа
    if (!isOperator && ticket.userId !== userId) {
      return res.status(403).json({ error: 'Нет прав доступа к этому тикету' });
    }
    
    res.json(ticket);
  } catch (err) {
    console.error('Ошибка получения тикета:', err);
    res.status(500).json({ error: 'Ошибка получения тикета' });
  }
}

// Ответить на тикет (клиент или оператор)
export async function respondTicket(req: Request, res: Response) {
  const { ticketId, message, isInternal = false } = req.body;
  const operatorId = (req as any).user?.id;
  const isOperator = Number((req as any).user?.operator) === 1;
  
  if (!operatorId) return res.status(401).json({ error: 'Нет авторизации' });
  if (!message) return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  
  // Только операторы могут оставлять внутренние комментарии
  const actualIsInternal = isOperator ? isInternal : false;
  
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    
    // Клиент может отвечать только на свои тикеты
    if (!isOperator && ticket.userId !== operatorId) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    
    const response = await prisma.response.create({
      data: { 
        ticketId, 
        operatorId, 
        message,
        isInternal: actualIsInternal
      },
      include: {
        operator: {
          select: { id: true, username: true, email: true }
        }
      }
    });
    
    // Обновляем статус тикета
    let newStatus = ticket.status;
    if (isOperator && ticket.status === 'open') {
      newStatus = 'in_progress';
    } else if (!isOperator && ticket.status === 'awaiting_reply') {
      newStatus = 'in_progress';
    }
    
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { 
        status: newStatus,
        updatedAt: new Date()
      },
    });
    
    // TODO: Отправить уведомление автору тикета (если ответил оператор)
    
    res.json(response);
  } catch (err) {
    console.error('Ошибка ответа на тикет:', err);
    res.status(500).json({ error: 'Ошибка ответа на тикет' });
  }
}

// Изменить статус тикета (только оператор)
export async function updateTicketStatus(req: Request, res: Response) {
  const { ticketId, status } = req.body;
  const userId = (req as any).user?.id;
  const isOperator = Number((req as any).user?.operator) === 1;
  
  if (!userId || !isOperator) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  const allowedStatuses = ['open', 'in_progress', 'awaiting_reply', 'resolved', 'closed'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }
  
  try {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { 
        status,
        closedAt: status === 'closed' ? new Date() : null,
        updatedAt: new Date()
      },
    });
    
    res.json(ticket);
  } catch (err) {
    console.error('Ошибка изменения статуса тикета:', err);
    res.status(500).json({ error: 'Ошибка изменения статуса тикета' });
  }
}

// Назначить тикет на оператора (только оператор)
export async function assignTicket(req: Request, res: Response) {
  const { ticketId, operatorId } = req.body;
  const userId = (req as any).user?.id;
  const isOperator = Number((req as any).user?.operator) === 1;
  
  if (!userId || !isOperator) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  try {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { 
        assignedTo: operatorId,
        status: 'in_progress',
        updatedAt: new Date()
      },
    });
    
    res.json(ticket);
  } catch (err) {
    console.error('Ошибка назначения тикета:', err);
    res.status(500).json({ error: 'Ошибка назначения тикета' });
  }
}

// Закрыть тикет (клиент или оператор)
export async function closeTicket(req: Request, res: Response) {
  const { ticketId } = req.body;
  const userId = (req as any).user?.id;
  const isOperator = Number((req as any).user?.operator) === 1;
  
  if (!userId) return res.status(401).json({ error: 'Нет авторизации' });
  
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (!isOperator && ticket.userId !== userId) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { 
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date()
      },
    });
    
    res.json({ success: true, message: 'Тикет закрыт' });
  } catch (err) {
    console.error('Ошибка закрытия тикета:', err);
    res.status(500).json({ error: 'Ошибка закрытия тикета' });
  }
}

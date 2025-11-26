import { prisma } from '../../prisma/client';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface SerializedUserSummary {
  id: number;
  username: string;
  operator: boolean;
  email?: string | null;
}

interface SerializedAttachment {
  id: number;
  filename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
}

interface SerializedResponse {
  id: number;
  message: string;
  isInternal: boolean;
  createdAt: Date;
  author: SerializedUserSummary | null;
  attachments: SerializedAttachment[];
}

interface SerializedTicket {
  id: number;
  title: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  user: SerializedUserSummary | null;
  assignedTo: number | null;
  assignedOperator: SerializedUserSummary | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  responseCount: number;
  lastResponseAt: Date | null;
  attachments: SerializedAttachment[];
  responses: SerializedResponse[];
}

const serializeUser = (user: any | null): SerializedUserSummary | null => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    operator: Boolean(user.operator),
    email: user.email ?? null,
  };
};

const serializeAttachments = (attachments: any[] | undefined): SerializedAttachment[] => {
  if (!attachments?.length) {
    return [];
  }

  return attachments.map((attachment) => ({
    id: attachment.id,
    filename: attachment.filename,
    fileUrl: attachment.fileUrl,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    createdAt: attachment.createdAt,
  }));
};

const serializeResponses = (responses: any[] | undefined): SerializedResponse[] => {
  if (!responses?.length) {
    return [];
  }

  return responses.map((response) => ({
    id: response.id,
    message: response.message,
    isInternal: response.isInternal,
    createdAt: response.createdAt,
    author: serializeUser(response.operator ?? null),
    attachments: serializeAttachments(response.attachments),
  }));
};

const serializeTicket = (
  ticket: any,
  assignedOperatorsMap: Map<number, SerializedUserSummary>,
): SerializedTicket => {
  const responses = serializeResponses(ticket.responses);

  return {
    id: ticket.id,
    title: ticket.title,
    message: ticket.message,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    user: serializeUser(ticket.user ?? null),
    assignedTo: ticket.assignedTo ?? null,
    assignedOperator: ticket.assignedTo ? assignedOperatorsMap.get(ticket.assignedTo) ?? null : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt ?? null,
    responseCount: responses.length,
    lastResponseAt: responses.length ? responses[responses.length - 1]?.createdAt ?? null : null,
    attachments: serializeAttachments(ticket.attachments),
    responses,
  };
};

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
  const userId = Number((req as any).user?.id);

  if (!userId) {
    return res.status(401).json({ error: 'Нет авторизации' });
  }

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
        status: 'open',
      },
      include: {
        user: {
          select: { id: true, username: true, operator: true, email: true },
        },
        attachments: true,
        responses: {
          include: {
            operator: {
              select: { id: true, username: true, operator: true, email: true },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const assignedOperatorsMap = new Map<number, SerializedUserSummary>();
    const normalizedTicket = serializeTicket(ticket, assignedOperatorsMap);

    // TODO: Отправить уведомление операторам о новом тикете

    return res.json({ ticket: normalizedTicket });
  } catch (err) {
    console.error('Ошибка создания тикета:', err);
    return res.status(500).json({ error: 'Ошибка создания тикета' });
  }
}

// Получить тикеты (клиент — свои, оператор — все с фильтрами)
export async function getTickets(req: Request, res: Response) {
  const userId = Number((req as any).user?.id);
  const isOperator = Number((req as any).user?.operator) === 1;
  const {
    status,
    category,
    priority,
    assigned,
    search,
    page: pageParam,
    pageSize: pageSizeParam,
  } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Нет авторизации' });
  }

  const page = Number(pageParam) > 0 ? Number(pageParam) : 1;
  const pageSize = Number(pageSizeParam) > 0 ? Math.min(Number(pageSizeParam), 50) : 10;

  try {
    const where: any = isOperator ? {} : { userId };

    if (typeof status === 'string' && status !== 'all') {
      where.status = status;
    }

    if (typeof category === 'string' && category !== 'all') {
      where.category = category;
    }

    if (typeof priority === 'string' && priority !== 'all') {
      where.priority = priority;
    }

    if (typeof search === 'string' && search.trim().length > 1) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { message: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (isOperator && typeof assigned === 'string') {
      if (assigned === 'me') {
        where.assignedTo = userId;
      } else if (assigned === 'unassigned') {
        where.assignedTo = null;
      } else if (assigned === 'others') {
        where.AND = [{ assignedTo: { not: null } }, { assignedTo: { not: userId } }];
      }
    }

    const [tickets, total, statusBuckets, assignedToMe, unassigned] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          responses: {
            where: isOperator ? {} : { isInternal: false },
            include: {
              operator: {
                select: { id: true, username: true, operator: true, email: true },
              },
              attachments: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          user: {
            select: { id: true, username: true, operator: true, email: true },
          },
          attachments: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
      prisma.ticket.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: isOperator ? {} : { userId },
      }),
      isOperator
        ? prisma.ticket.count({ where: { assignedTo: userId } })
        : Promise.resolve(0),
      isOperator
        ? prisma.ticket.count({ where: { assignedTo: null, status: { not: 'closed' } } })
        : Promise.resolve(0),
    ]);

    const assignedOperatorIds = tickets
      .map((ticket) => ticket.assignedTo)
      .filter((value): value is number => typeof value === 'number');

    const assignedOperators = assignedOperatorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assignedOperatorIds } },
          select: { id: true, username: true, operator: true, email: true },
        })
      : [];

    const assignedOperatorsMap = new Map<number, SerializedUserSummary>();
    assignedOperators.forEach((operator) => {
      assignedOperatorsMap.set(operator.id, serializeUser(operator)!);
    });

    const normalizedTickets = tickets.map((ticket) => serializeTicket(ticket, assignedOperatorsMap));

    const statusMap = statusBuckets.reduce<Record<string, number>>((acc, bucket) => {
      acc[bucket.status] = bucket._count._all;
      return acc;
    }, {});

    const stats = {
      open: statusMap.open ?? 0,
      inProgress: statusMap.in_progress ?? 0,
      awaitingReply: statusMap.awaiting_reply ?? 0,
      resolved: statusMap.resolved ?? 0,
      closed: statusMap.closed ?? 0,
      assignedToMe: isOperator ? assignedToMe : undefined,
      unassigned: isOperator ? unassigned : undefined,
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.json({
      tickets: normalizedTickets,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      stats,
    });
  } catch (err) {
    console.error('Ошибка получения тикетов:', err);
    return res.status(500).json({ error: 'Ошибка получения тикетов' });
  }
}

// Получить один тикет по ID
export async function getTicketById(req: Request, res: Response) {
  const ticketId = Number(req.params.id);
  const userId = Number((req as any).user?.id);
  const isOperator = Number((req as any).user?.operator) === 1;

  if (!userId) {
    return res.status(401).json({ error: 'Нет авторизации' });
  }

  if (!ticketId) {
    return res.status(400).json({ error: 'Некорректный идентификатор тикета' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        responses: {
          where: isOperator ? {} : { isInternal: false },
          include: {
            operator: {
              select: { id: true, username: true, operator: true, email: true },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, username: true, operator: true, email: true },
        },
        attachments: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (!isOperator && ticket.userId !== userId) {
      return res.status(403).json({ error: 'Нет прав доступа к этому тикету' });
    }

    const assignedOperatorsMap = new Map<number, SerializedUserSummary>();

    if (ticket.assignedTo) {
      const assignedOperator = await prisma.user.findUnique({
        where: { id: ticket.assignedTo },
        select: { id: true, username: true, operator: true, email: true },
      });

      if (assignedOperator) {
        assignedOperatorsMap.set(assignedOperator.id, serializeUser(assignedOperator)!);
      }
    }

    const normalizedTicket = serializeTicket(ticket, assignedOperatorsMap);

    return res.json({ ticket: normalizedTicket });
  } catch (err) {
    console.error('Ошибка получения тикета:', err);
    return res.status(500).json({ error: 'Ошибка получения тикета' });
  }
}

// Ответить на тикет (клиент или оператор)
export async function respondTicket(req: Request, res: Response) {
  const { ticketId, message, isInternal = false } = req.body;
  const actorId = Number((req as any).user?.id);
  const isOperator = Number((req as any).user?.operator) === 1;

  if (!actorId) {
    return res.status(401).json({ error: 'Нет авторизации' });
  }

  const numericTicketId = Number(ticketId);

  if (!numericTicketId) {
    return res.status(400).json({ error: 'Некорректный ticketId' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: numericTicketId } });

    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (!isOperator && ticket.userId !== actorId) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const response = await prisma.response.create({
      data: {
        ticketId: numericTicketId,
        operatorId: actorId,
        message: message.trim(),
        isInternal: isOperator ? Boolean(isInternal) : false,
      },
      include: {
        operator: {
          select: { id: true, username: true, operator: true, email: true },
        },
        attachments: true,
      },
    });

    const updateData: any = {};

    if (isOperator) {
      if (!response.isInternal) {
        updateData.status = 'awaiting_reply';
      } else if (ticket.status === 'open') {
        updateData.status = 'in_progress';
      }

      if (!ticket.assignedTo) {
        updateData.assignedTo = actorId;
      }
    } else {
      updateData.status = 'in_progress';
      if (ticket.closedAt) {
        updateData.closedAt = null;
      }
    }

    const dataToApply = Object.keys(updateData).length ? updateData : { status: ticket.status };

    await prisma.ticket.update({
      where: { id: numericTicketId },
      data: dataToApply,
    });

    const normalizedResponse: SerializedResponse = {
      id: response.id,
      message: response.message,
      isInternal: response.isInternal,
      createdAt: response.createdAt,
      author: serializeUser(response.operator ?? null),
      attachments: serializeAttachments(response.attachments),
    };

    return res.json({
      response: normalizedResponse,
      ticketStatus: updateData.status ?? ticket.status,
      assignedTo: updateData.assignedTo ?? ticket.assignedTo ?? null,
    });
  } catch (err) {
    console.error('Ошибка ответа на тикет:', err);
    return res.status(500).json({ error: 'Ошибка ответа на тикет' });
  }
}

// Изменить статус тикета (только оператор)
export async function updateTicketStatus(req: Request, res: Response) {
  const { ticketId, status } = req.body;
  const userId = Number((req as any).user?.id);
  const isOperator = Number((req as any).user?.operator) === 1;

  if (!userId || !isOperator) {
    return res.status(403).json({ error: 'Нет прав' });
  }

  const allowedStatuses = ['open', 'in_progress', 'awaiting_reply', 'resolved', 'closed'];

  if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  const numericTicketId = Number(ticketId);

  if (!numericTicketId) {
    return res.status(400).json({ error: 'Некорректный ticketId' });
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: numericTicketId },
      data: {
        status,
        closedAt: status === 'closed' ? new Date() : null,
      },
      include: {
        user: {
          select: { id: true, username: true, operator: true, email: true },
        },
        attachments: true,
        responses: {
          include: {
            operator: {
              select: { id: true, username: true, operator: true, email: true },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const assignedOperatorsMap = new Map<number, SerializedUserSummary>();

    if (ticket.assignedTo) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: ticket.assignedTo },
        select: { id: true, username: true, operator: true, email: true },
      });

      if (assignedUser) {
        assignedOperatorsMap.set(assignedUser.id, serializeUser(assignedUser)!);
      }
    }

    const normalizedTicket = serializeTicket(ticket, assignedOperatorsMap);

    return res.json({ ticket: normalizedTicket });
  } catch (err) {
    console.error('Ошибка изменения статуса тикета:', err);
    return res.status(500).json({ error: 'Ошибка изменения статуса тикета' });
  }
}

// Назначить тикет на оператора (только оператор)
export async function assignTicket(req: Request, res: Response) {
  const { ticketId, operatorId } = req.body;
  const userId = Number((req as any).user?.id);
  const isOperator = Number((req as any).user?.operator) === 1;

  if (!userId || !isOperator) {
    return res.status(403).json({ error: 'Нет прав' });
  }

  const numericTicketId = Number(ticketId);
  const numericOperatorId = Number(operatorId);

  if (!numericTicketId || !numericOperatorId) {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  try {
    const operator = await prisma.user.findUnique({
      where: { id: numericOperatorId },
      select: { id: true, operator: true },
    });

    if (!operator || operator.operator !== 1) {
      return res.status(400).json({ error: 'Пользователь не является оператором' });
    }

    const ticket = await prisma.ticket.update({
      where: { id: numericTicketId },
      data: {
        assignedTo: numericOperatorId,
        status: 'in_progress',
      },
      include: {
        user: {
          select: { id: true, username: true, operator: true, email: true },
        },
        attachments: true,
        responses: {
          include: {
            operator: {
              select: { id: true, username: true, operator: true, email: true },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const assignedOperatorsMap = new Map<number, SerializedUserSummary>();
    const assignedOperatorUser = await prisma.user.findUnique({
      where: { id: numericOperatorId },
      select: { id: true, username: true, operator: true, email: true },
    });

    if (assignedOperatorUser) {
      assignedOperatorsMap.set(assignedOperatorUser.id, serializeUser(assignedOperatorUser)!);
    }

    const normalizedTicket = serializeTicket(ticket, assignedOperatorsMap);

    return res.json({ ticket: normalizedTicket });
  } catch (err) {
    console.error('Ошибка назначения тикета:', err);
    return res.status(500).json({ error: 'Ошибка назначения тикета' });
  }
}

// Закрыть тикет (клиент или оператор)
export async function closeTicket(req: Request, res: Response) {
  const { ticketId } = req.body;
  const userId = Number((req as any).user?.id);
  const isOperator = Number((req as any).user?.operator) === 1;

  if (!userId) {
    return res.status(401).json({ error: 'Нет авторизации' });
  }

  const numericTicketId = Number(ticketId);

  if (!numericTicketId) {
    return res.status(400).json({ error: 'Некорректный ticketId' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: numericTicketId } });

    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (!isOperator && ticket.userId !== userId) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    await prisma.ticket.update({
      where: { id: numericTicketId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        ...(isOperator ? {} : { assignedOperatorId: null }),
      },
    });

    return res.json({ success: true, message: 'Тикет закрыт' });
  } catch (err) {
    console.error('Ошибка закрытия тикета:', err);
    return res.status(500).json({ error: 'Ошибка закрытия тикета' });
  }
}

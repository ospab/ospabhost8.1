import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';

// Получить все опубликованные посты (публичный доступ)
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      where: { status: 'published' },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { publishedAt: 'desc' }
    });

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить один пост по URL (публичный доступ)
export const getPostByUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.params;

    const post = await prisma.post.findUnique({
      where: { url },
      include: {
        author: {
          select: { id: true, username: true }
        },
        comments: {
          where: { status: 'approved' },
          include: {
            user: {
              select: { id: true, username: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Статья не найдена' });
    }

    // Увеличить счетчик просмотров
    await prisma.post.update({
      where: { id: post.id },
      data: { views: { increment: 1 } }
    });

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Ошибка получения поста:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Добавить комментарий (публичный доступ)
export const addComment = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { content, authorName } = req.body;
    const userId = req.user?.id; // Если пользователь авторизован

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Содержимое комментария не может быть пустым' });
    }

    if (!userId && (!authorName || authorName.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'Укажите ваше имя' });
    }

    // Проверяем, существует ли пост
    const post = await prisma.post.findUnique({
      where: { id: parseInt(postId) }
    });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Пост не найден' });
    }

    const comment = await prisma.comment.create({
      data: {
        postId: parseInt(postId),
        userId: userId || null,
        authorName: !userId ? authorName.trim() : null,
        content: content.trim(),
        status: 'pending' // Комментарии требуют модерации
      },
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ success: true, data: comment, message: 'Комментарий отправлен на модерацию' });
  } catch (error) {
    console.error('Ошибка добавления комментария:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// === ADMIN ENDPOINTS ===

// Получить все посты (включая черновики) - только для админов
export const getAllPostsAdmin = async (req: Request, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить один пост по ID - только для админов
export const getPostByIdAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Пост не найден' });
    }

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Ошибка получения поста:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Создать пост - только для админов
export const createPost = async (req: Request, res: Response) => {
  try {
    const { title, content, excerpt, coverImage, url, status } = req.body;
    const authorId = req.user!.id; // user гарантированно есть после authMiddleware

    if (!title || !content || !url) {
      return res.status(400).json({ success: false, message: 'Заполните обязательные поля' });
    }

    // Проверка уникальности URL
    const existingPost = await prisma.post.findUnique({ where: { url } });
    if (existingPost) {
      return res.status(400).json({ success: false, message: 'URL уже используется' });
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        excerpt,
        coverImage,
        url,
        status: status || 'draft',
        authorId,
        publishedAt: status === 'published' ? new Date() : null
      },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Ошибка создания поста:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Обновить пост - только для админов
export const updatePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, coverImage, url, status } = req.body;

    // Проверка уникальности URL (если изменился)
    if (url) {
      const existingPost = await prisma.post.findUnique({ where: { url } });
      if (existingPost && existingPost.id !== parseInt(id)) {
        return res.status(400).json({ success: false, message: 'URL уже используется' });
      }
    }

    const currentPost = await prisma.post.findUnique({ where: { id: parseInt(id) } });
    const wasPublished = currentPost?.status === 'published';
    const nowPublished = status === 'published';

    const post = await prisma.post.update({
      where: { id: parseInt(id) },
      data: {
        title,
        content,
        excerpt,
        coverImage,
        url,
        status,
        publishedAt: !wasPublished && nowPublished ? new Date() : currentPost?.publishedAt
      },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Ошибка обновления поста:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Удалить пост - только для админов
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.post.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Пост удалён' });
  } catch (error) {
    console.error('Ошибка удаления поста:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить все комментарии (для модерации) - только для админов
export const getAllComments = async (req: Request, res: Response) => {
  try {
    const comments = await prisma.comment.findMany({
      include: {
        user: {
          select: { id: true, username: true }
        },
        post: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Модерация комментария - только для админов
export const moderateComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // approved, rejected

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Неверный статус' });
    }

    const comment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.json({ success: true, data: comment });
  } catch (error) {
    console.error('Ошибка модерации комментария:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Удалить комментарий - только для админов
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.comment.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Комментарий удалён' });
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useToast } from '../hooks/useToast';
import useAuth from '../context/useAuth';

interface Comment {
  id: number;
  content: string;
  authorName: string | null;
  createdAt: string;
  user: {
    id: number;
    username: string;
  } | null;
}

interface Post {
  id: number;
  title: string;
  content: string;
  coverImage: string | null;
  url: string;
  views: number;
  createdAt: string;
  publishedAt: string;
  author: {
    id: number;
    username: string;
  };
  comments: Comment[];
}

const BlogPost: React.FC = () => {
  const { url } = useParams<{ url: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isLoggedIn } = useAuth();
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [commentContent, setCommentContent] = useState('');
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadPost = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/blog/posts/${url}`);
      setPost(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки поста:', err);
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          setError('Статья не найдена');
        } else {
          setError('Не удалось загрузить статью');
        }
      } else {
        setError('Не удалось загрузить статью');
      }
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (url) {
      loadPost();
    }
  }, [url, loadPost]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!commentContent.trim()) {
      addToast('Введите комментарий', 'error');
      return;
    }
    
    if (!isLoggedIn && !commentAuthorName.trim()) {
      addToast('Укажите ваше имя', 'error');
      return;
    }

    try {
      setSubmittingComment(true);
      
      // Подготовка заголовков с токеном для авторизованных пользователей
      const headers: Record<string, string> = {};
      if (isLoggedIn) {
        const token = localStorage.getItem('access_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      await axios.post(`${API_URL}/api/blog/posts/${post?.id}/comments`, {
        content: commentContent,
        authorName: !isLoggedIn ? commentAuthorName : null
      }, { headers });
      
      addToast('Комментарий отправлен на модерацию', 'success');
      setCommentContent('');
      setCommentAuthorName('');
      loadPost(); // Перезагрузить пост с комментариями
    } catch (err) {
      console.error('Ошибка отправки комментария:', err);
      addToast('Не удалось отправить комментарий', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/blog')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Вернуться к блогу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <button
          onClick={() => navigate('/blog')}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span>←</span> Вернуться к блогу
        </button>

        {/* Cover Image */}
        {post.coverImage && (
          <div className="mb-8 rounded-lg overflow-hidden shadow-lg">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-96 object-cover"
            />
          </div>
        )}

        {/* Article */}
        <article className="bg-white rounded-lg shadow-lg p-8 md:p-12 mb-8">
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-6 text-gray-500 mb-8 pb-6 border-b">
            <div className="flex items-center gap-2">
              <span>Автор:</span>
              <span>{post.author.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Дата:</span>
              <span>{formatDate(post.publishedAt || post.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Просмотров:</span>
              <span>{post.views}</span>
            </div>
          </div>

          {/* Content (HTML) */}
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        {/* Comments Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Комментарии ({post.comments.length})
          </h2>

          {/* Comment Form */}
          <form onSubmit={handleSubmitComment} className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Оставить комментарий</h3>
            
            {!isLoggedIn && (
              <input
                type="text"
                value={commentAuthorName}
                onChange={(e) => setCommentAuthorName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            )}
            
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Напишите ваш комментарий..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            
            <button
              type="submit"
              disabled={submittingComment}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submittingComment ? 'Отправка...' : 'Отправить комментарий'}
            </button>
            
            <p className="mt-2 text-sm text-gray-500">
              Комментарии проходят модерацию перед публикацией
            </p>
          </form>

          {/* Comments List */}
          {post.comments.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              Пока нет комментариев. Будьте первым!
            </p>
          ) : (
            <div className="space-y-6">
              {post.comments.map((comment) => (
                <div key={comment.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900">
                      {comment.user ? comment.user.username : comment.authorName}
                    </span>
                    <span className="text-sm text-gray-500">
                      • {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogPost;

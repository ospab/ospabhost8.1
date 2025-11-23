import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useToast } from '../../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';

interface Post {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  coverImage: string | null;
  url: string;
  status: string;
  views: number;
  createdAt: string;
  publishedAt: string | null;
  author: {
    id: number;
    username: string;
  };
  _count: {
    comments: number;
  };
}

interface Comment {
  id: number;
  content: string;
  authorName: string | null;
  status: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
  } | null;
  post: {
    id: number;
    title: string;
  };
}

const BlogAdmin: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');

  // Модальное окно удаления
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [postsRes, commentsRes] = await Promise.all([
        axios.get(`${API_URL}/api/blog/admin/posts`, { headers }),
        axios.get(`${API_URL}/api/blog/admin/comments`, { headers })
      ]);

      setPosts(postsRes.data.data);
      setComments(commentsRes.data.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      addToast('Не удалось загрузить данные', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Открыть редактор для нового поста
  const handleNewPost = () => {
    navigate('/dashboard/blogeditor');
  };

  // Открыть редактор для редактирования поста
  const handleEditPost = (postId: number) => {
    navigate(`/dashboard/blogeditor/${postId}`);
  };

  // Удалить пост
  const handleDeletePost = async () => {
    if (!postToDelete) return;

    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_URL}/api/blog/admin/posts/${postToDelete}`, { headers });
      addToast('Пост удалён', 'success');
      setShowDeleteModal(false);
      setPostToDelete(null);
      loadData();
    } catch (error) {
      console.error('Ошибка удаления поста:', error);
      addToast('Не удалось удалить пост', 'error');
    }
  };

  // Модерация комментария
  const handleModerateComment = async (commentId: number, status: 'approved' | 'rejected') => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.patch(`${API_URL}/api/blog/admin/comments/${commentId}`, { status }, { headers });
      addToast(`Комментарий ${status === 'approved' ? 'одобрен' : 'отклонён'}`, 'success');
      loadData();
    } catch (error) {
      console.error('Ошибка модерации:', error);
      addToast('Ошибка модерации комментария', 'error');
    }
  };

  // Удалить комментарий
  const handleDeleteComment = async (commentId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_URL}/api/blog/admin/comments/${commentId}`, { headers });
      addToast('Комментарий удалён', 'success');
      loadData();
    } catch (error) {
      console.error('Ошибка удаления комментария:', error);
      addToast('Не удалось удалить комментарий', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-200 text-gray-700',
      published: 'bg-green-200 text-green-700',
      archived: 'bg-red-200 text-red-700',
      pending: 'bg-yellow-200 text-yellow-700',
      approved: 'bg-green-200 text-green-700',
      rejected: 'bg-red-200 text-red-700'
    };
    
    const labels = {
      draft: 'Черновик',
      published: 'Опубликовано',
      archived: 'Архив',
      pending: 'На модерации',
      approved: 'Одобрен',
      rejected: 'Отклонён'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Управление блогом</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          className={`px-4 py-2 ${activeTab === 'posts' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Статьи ({posts.length})
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'comments' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Комментарии ({comments.filter(c => c.status === 'pending').length})
        </button>
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div>
          <button
            onClick={handleNewPost}
            className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ➕ Создать статью
          </button>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заголовок</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Просмотры</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Комментарии</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{post.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      /blog/{post.url}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(post.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Просмотров: {post.views}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Комментариев: {post._count.comments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(post.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleEditPost(post.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => {
                          setPostToDelete(post.id);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-500">
                    К статье: <strong>{comment.post.title}</strong>
                  </p>
                  <p className="text-sm text-gray-500">
                    Автор: <strong>{comment.user ? comment.user.username : comment.authorName}</strong>
                    {' '} • {formatDate(comment.createdAt)}
                  </p>
                </div>
                {getStatusBadge(comment.status)}
              </div>
              
              <p className="text-gray-700 mb-4 whitespace-pre-wrap">{comment.content}</p>

              <div className="flex gap-2">
                {comment.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleModerateComment(comment.id, 'approved')}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Одобрить
                    </button>
                    <button
                      onClick={() => handleModerateComment(comment.id, 'rejected')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Отклонить
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}

          {comments.length === 0 && (
            <p className="text-center text-gray-400 py-8">Комментариев нет</p>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPostToDelete(null);
        }}
        title="Удаление статьи"
        type="danger"
        onConfirm={handleDeletePost}
        confirmText="Да, удалить"
        cancelText="Отмена"
      >
        <p>Вы уверены, что хотите удалить эту статью?</p>
        <p className="mt-2 text-sm text-gray-600">
          Все комментарии к статье также будут удалены. Это действие необратимо.
        </p>
      </Modal>
    </div>
  );
};

export default BlogAdmin;

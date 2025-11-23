import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useToast } from '../../hooks/useToast';
import { useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const BlogEditor: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { postId } = useParams<{ postId?: string }>();
  const quillRef = useRef<ReactQuill>(null);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    coverImage: '',
    url: '',
    status: 'draft'
  });

  const loadPost = useCallback(async (id: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/api/blog/admin/posts/${id}`, { headers });
      const post = response.data.data;

      setFormData({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || '',
        coverImage: post.coverImage || '',
        url: post.url,
        status: post.status
      });
    } catch (error) {
      console.error('Ошибка загрузки поста:', error);
      addToast('Не удалось загрузить пост', 'error');
      navigate('/dashboard/blogadmin');
    } finally {
      setLoading(false);
    }
  }, [addToast, navigate]);

  // Загрузить пост для редактирования
  useEffect(() => {
    if (postId) {
      loadPost(parseInt(postId));
    }
  }, [postId, loadPost]);

  // Сохранить пост
  const handleSavePost = async () => {
    if (!formData.title || !formData.content || !formData.url) {
      addToast('Заполните обязательные поля (Заголовок, URL, Содержание)', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      if (postId) {
        // Обновление
        await axios.put(`${API_URL}/api/blog/admin/posts/${postId}`, formData, { headers });
        addToast('Пост обновлён', 'success');
      } else {
        // Создание
        await axios.post(`${API_URL}/api/blog/admin/posts`, formData, { headers });
        addToast('Пост создан', 'success');
      }

      navigate('/dashboard/blogadmin');
    } catch (error) {
      console.error('Ошибка сохранения поста:', error);
      const message = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message 
        : 'Ошибка сохранения';
      addToast(message || 'Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Обработчик загрузки изображений для Quill
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Проверка размера файла (макс 10MB)
      if (file.size > 10 * 1024 * 1024) {
        addToast('Файл слишком большой. Максимальный размер: 10MB', 'error');
        return;
      }

      try {
        const formData = new FormData();
        formData.append('image', file);

        const token = localStorage.getItem('access_token');
        const headers = { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        };

        const response = await axios.post(
          `${API_URL}/api/blog/admin/upload-image`,
          formData,
          { headers }
        );

        const imageUrl = response.data.data.url;

        // Вставляем изображение в редактор
        if (quillRef.current) {
          const editor = quillRef.current.getEditor();
          const range = editor.getSelection();
          editor.insertEmbed(range?.index || 0, 'image', imageUrl);
        }

        addToast('Изображение загружено', 'success');
      } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        addToast('Не удалось загрузить изображение', 'error');
      }
    };
  }, [addToast]);

  // Конфигурация Quill
  const quillModules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['blockquote', 'code-block'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {postId ? 'Редактирование статьи' : 'Новая статья'}
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard/blogadmin')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={loading}
            >
              ← Назад
            </button>
            <button
              onClick={handleSavePost}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Заголовок статьи <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите заголовок статьи..."
              />
            </div>

            {/* Content Editor */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Содержание статьи <span className="text-red-500">*</span>
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={formData.content}
                  onChange={(value) => setFormData({ ...formData, content: value })}
                  modules={quillModules}
                  className="bg-white"
                  style={{ minHeight: '500px' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Используйте кнопку изображения для загрузки картинок в статью
              </p>
            </div>
          </div>

          {/* Sidebar - Settings */}
          <div className="space-y-6">
            {/* URL */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL статьи <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center mb-2">
                <span className="text-gray-500 text-sm mr-2">/blog/</span>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="my-awesome-post"
                />
              </div>
              <p className="text-xs text-gray-500">
                Используйте латиницу, цифры и дефисы
              </p>
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Статус публикации
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="draft">Черновик</option>
                <option value="published">Опубликовано</option>
                <option value="archived">📦 Архив</option>
              </select>
            </div>

            {/* Excerpt */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Краткое описание
              </label>
              <textarea
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Краткое описание для отображения в ленте блога..."
              />
            </div>

            {/* Cover Image */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Обложка статьи
              </label>
              <input
                type="text"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="https://example.com/image.jpg"
              />
              {formData.coverImage && (
                <div className="mt-3">
                  <img
                    src={formData.coverImage}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EНе загружено%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogEditor;

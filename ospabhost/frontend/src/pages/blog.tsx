import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/api';

interface Post {
  id: number;
  title: string;
  excerpt: string;
  coverImage: string | null;
  url: string;
  views: number;
  createdAt: string;
  publishedAt: string;
  author: {
    id: number;
    username: string;
  };
  _count: {
    comments: number;
  };
}

const Blog: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/blog/posts`);
      setPosts(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки постов:', err);
      setError('Не удалось загрузить статьи');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Блог</h1>
          <p className="text-xl text-gray-600">
            Новости, статьи и полезные материалы о хостинге
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-center">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl text-gray-400">📭 Статей пока нет</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.url}`}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden group"
              >
                {/* Cover Image */}
                {post.coverImage ? (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-4xl text-white font-bold">Статья</span>
                  </div>
                )}

                {/* Content */}
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  
                  {post.excerpt && (
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>Автор: {post.author.username}</span>
                      <span>Просмотров: {post.views}</span>
                      <span>Комментариев: {post._count.comments}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-400">
                    {formatDate(post.publishedAt || post.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;

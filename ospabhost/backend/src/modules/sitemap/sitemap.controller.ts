import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';

export async function generateSitemap(req: Request, res: Response) {
  try {
    const baseUrl = 'https://ospab.host';
    
    // Основные страницы
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'weekly' },
      { loc: '/about', priority: '0.9', changefreq: 'monthly' },
      { loc: '/tariffs', priority: '0.95', changefreq: 'weekly' },
      { loc: '/login', priority: '0.7', changefreq: 'monthly' },
      { loc: '/register', priority: '0.8', changefreq: 'monthly' },
      { loc: '/terms', priority: '0.5', changefreq: 'yearly' },
    ];

    // Динамические страницы (если будут статьи в будущем)
    let dynamicPages: any[] = [];
    try {
      // Если будет блог, добавьте сюда
      // const posts = await prisma.post.findMany();
      // dynamicPages = posts.map(post => ({
      //   loc: `/blog/${post.slug}`,
      //   priority: '0.7',
      //   changefreq: 'weekly',
      //   lastmod: post.updatedAt.toISOString().split('T')[0]
      // }));
    } catch (error) {
      // Блог пока не активирован
    }

    const allPages = [...staticPages, ...dynamicPages];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const page of allPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      if (page.lastmod) {
        xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
      }
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Ошибка генерации sitemap:', error);
    res.status(500).json({ error: 'Ошибка генерации sitemap' });
  }
}
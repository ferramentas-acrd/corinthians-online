import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'corinthians_online',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export interface NoticiaData {
  id: number;
  document_id: string;
  title: string;
  slug: string;
  excerpt?: string;
  published_at?: string;
  created_at: string;
  single?: boolean;
}

export interface CategoryData {
  id: number;
  document_id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

export async function getNoticias(limit = 10): Promise<NoticiaData[]> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, document_id, title, slug, excerpt, published_at, created_at, single 
       FROM noticias 
       WHERE published_at IS NOT NULL 
       ORDER BY published_at DESC 
       LIMIT ${limit}`
    );
    return rows as NoticiaData[];
  } catch (error) {
    console.error('Error fetching noticias:', error);
    return [];
  }
}

export async function getNoticiaBySlug(slug: string): Promise<NoticiaData | null> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, document_id, title, slug, excerpt, published_at, created_at, single 
       FROM noticias 
       WHERE slug = '${slug}' AND published_at IS NOT NULL 
       LIMIT 1`
    );
    const results = rows as NoticiaData[];
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Error fetching noticia by slug:', error);
    return null;
  }
}

export async function getCategories(): Promise<CategoryData[]> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, document_id, name, slug, description, created_at 
       FROM categories 
       ORDER BY name ASC`
    );
    return rows as CategoryData[];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<CategoryData | null> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, document_id, name, slug, description, created_at 
       FROM categories 
       WHERE slug = '${slug}' 
       LIMIT 1`
    );
    const results = rows as CategoryData[];
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Error fetching category by slug:', error);
    return null;
  }
}

export async function getNoticiasByCategory(categorySlug: string, limit = 20): Promise<NoticiaData[]> {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT n.id, n.document_id, n.title, n.slug, n.excerpt, n.published_at, n.created_at, n.single 
       FROM noticias n
       INNER JOIN noticias_category_lnk ncl ON n.id = ncl.noticia_id
       INNER JOIN categories c ON ncl.category_id = c.id
       WHERE c.slug = '${categorySlug}' AND n.published_at IS NOT NULL 
       ORDER BY n.published_at DESC 
       LIMIT ${limit}`
    );
    return rows as NoticiaData[];
  } catch (error) {
    console.error('Error fetching noticias by category:', error);
    return [];
  }
}
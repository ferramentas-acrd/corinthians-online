// src/lib/cache-tags.js
// Sistema de gerenciamento de cache tags para ISR

export class CacheTagManager {
  constructor(env) {
    this.env = env;
    this.prefix = '_tags/';
  }

  // Adiciona tags a uma chave
  async addTags(key, tags) {
    if (!tags || tags.length === 0) return;
    
    // Para cada tag, adiciona a chave ao índice da tag
    for (const tag of tags) {
      const tagKey = `${this.prefix}${tag}`;
      let tagData = await this.getTagData(tag);
      
      if (!tagData) {
        tagData = { keys: [], updated: Date.now() };
      }
      
      // Adiciona a chave se não existir
      if (!tagData.keys.includes(key)) {
        tagData.keys.push(key);
        tagData.updated = Date.now();
        
        await this.env.R2_CACHE.put(tagKey, JSON.stringify(tagData));
      }
    }
    
    // Também armazena as tags associadas à chave
    const keyTagsKey = `${this.prefix}_key/${key}`;
    await this.env.R2_CACHE.put(keyTagsKey, JSON.stringify({
      tags,
      created: Date.now()
    }));
  }

  // Remove tags de uma chave
  async removeTags(key) {
    const keyTagsKey = `${this.prefix}_key/${key}`;
    const keyTagsData = await this.getKeyTags(key);
    
    if (keyTagsData?.tags) {
      // Remove a chave de cada tag
      for (const tag of keyTagsData.tags) {
        const tagData = await this.getTagData(tag);
        if (tagData) {
          tagData.keys = tagData.keys.filter(k => k !== key);
          tagData.updated = Date.now();
          
          if (tagData.keys.length > 0) {
            await this.env.R2_CACHE.put(`${this.prefix}${tag}`, JSON.stringify(tagData));
          } else {
            // Remove a tag se não tiver mais chaves
            await this.env.R2_CACHE.delete(`${this.prefix}${tag}`);
          }
        }
      }
    }
    
    // Remove o registro de tags da chave
    await this.env.R2_CACHE.delete(keyTagsKey);
  }

  // Obtém todas as chaves associadas a uma tag
  async getKeysByTag(tag) {
    const tagData = await this.getTagData(tag);
    return tagData?.keys || [];
  }

  // Obtém todas as chaves associadas a múltiplas tags (OR)
  async getKeysByTags(tags) {
    const allKeys = new Set();
    
    for (const tag of tags) {
      const keys = await this.getKeysByTag(tag);
      keys.forEach(key => allKeys.add(key));
    }
    
    return Array.from(allKeys);
  }

  // Obtém as tags associadas a uma chave
  async getKeyTags(key) {
    try {
      const keyTagsKey = `${this.prefix}_key/${key}`;
      const data = await this.env.R2_CACHE.get(keyTagsKey);
      if (!data) return null;
      return JSON.parse(await data.text());
    } catch {
      return null;
    }
  }

  // Invalida todas as chaves associadas a uma tag
  async invalidateTag(tag) {
    const keys = await this.getKeysByTag(tag);
    const invalidated = [];
    
    for (const key of keys) {
      await this.env.R2_CACHE.delete(key);
      await this.removeTags(key);
      invalidated.push(key);
    }
    
    return invalidated;
  }

  // Invalida múltiplas tags
  async invalidateTags(tags) {
    const allInvalidated = new Set();
    
    for (const tag of tags) {
      const invalidated = await this.invalidateTag(tag);
      invalidated.forEach(key => allInvalidated.add(key));
    }
    
    return Array.from(allInvalidated);
  }

  // Helpers privados
  async getTagData(tag) {
    try {
      const tagKey = `${this.prefix}${tag}`;
      const data = await this.env.R2_CACHE.get(tagKey);
      if (!data) return null;
      return JSON.parse(await data.text());
    } catch {
      return null;
    }
  }

  // Lista todas as tags existentes
  async listTags() {
    const list = await this.env.R2_CACHE.list({ prefix: this.prefix });
    return list.objects
      .map(obj => obj.key.replace(this.prefix, ''))
      .filter(key => !key.startsWith('_key/'));
  }

  // Estatísticas de cache
  async getStats() {
    const tags = await this.listTags();
    const stats = {
      totalTags: tags.length,
      tags: {}
    };
    
    for (const tag of tags) {
      const keys = await this.getKeysByTag(tag);
      stats.tags[tag] = keys.length;
    }
    
    return stats;
  }
}

// Função helper para extrair tags de conteúdo do Strapi
export function extractStrapiTags(model, entry) {
  const tags = new Set(['all']);
  
  if (model === 'noticia' || model === 'api::noticia.noticia') {
    tags.add('type:noticias');
    
    if (entry.slug) {
      tags.add(`noticia:${entry.slug}`);
    }
    
    if (entry.categoria?.slug) {
      tags.add(`categoria:${entry.categoria.slug}`);
    }
    
    if (entry.tags && Array.isArray(entry.tags)) {
      entry.tags.forEach(tag => {
        if (tag.slug) {
          tags.add(`tag:${tag.slug}`);
        }
      });
    }
    
    if (entry.autor?.slug) {
      tags.add(`autor:${entry.autor.slug}`);
    }
    
    // Tags por data
    if (entry.publishedAt || entry.createdAt) {
      const date = new Date(entry.publishedAt || entry.createdAt);
      tags.add(`year:${date.getFullYear()}`);
      tags.add(`month:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
  }
  
  return Array.from(tags);
}

// Função para gerar tags baseadas em URL
export function generateUrlTags(pathname, searchParams) {
  const tags = new Set(['all']);
  const segments = pathname.split('/').filter(Boolean);
  
  // Remove o prefixo base se existir
  if (segments[0] === 'apostas') {
    segments.shift();
  }
  
  // Homepage
  if (segments.length === 0) {
    tags.add('page:home');
    return Array.from(tags);
  }
  
  // Tipo de conteúdo
  const contentType = segments[0];
  tags.add(`type:${contentType}`);
  
  // Páginas de listagem
  if (segments.length === 1) {
    tags.add(`list:${contentType}`);
    
    // Paginação
    const page = searchParams.get('page') || searchParams.get('p');
    if (page) {
      tags.add(`page:${page}`);
      tags.add(`${contentType}:page:${page}`);
    }
  }
  
  // Páginas individuais
  if (segments.length >= 2) {
    const slug = segments[1];
    tags.add(`${contentType}:${slug}`);
    
    // Páginas de paginação específicas
    if (segments[1] === 'page' && segments[2]) {
      tags.add(`page:${segments[2]}`);
      tags.add(`${contentType}:page:${segments[2]}`);
    }
  }
  
  // Tags especiais para rotas conhecidas
  switch (contentType) {
    case 'categoria':
    case 'categorias':
      if (segments[1]) {
        tags.add(`categoria:${segments[1]}`);
      }
      break;
      
    case 'tag':
    case 'tags':
      if (segments[1]) {
        tags.add(`tag:${segments[1]}`);
      }
      break;
      
    case 'autor':
    case 'autores':
      if (segments[1]) {
        tags.add(`autor:${segments[1]}`);
      }
      break;
  }
  
  return Array.from(tags);
}
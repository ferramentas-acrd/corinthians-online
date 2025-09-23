'use strict';

/**
 * noticia controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::noticia.noticia', ({ strapi }) => ({
  // Endpoint otimizado para listagem
  async listagem(ctx) {
    try {
      const { query } = ctx;
      
      // Parse dos parâmetros de query
      const page = parseInt(query.page) || 1;
      const pageSize = Math.min(parseInt(query.pageSize) || 25, 100);
      const featured = query.featured === 'true';
      
      // Configurar filtros base
      const filters = {
        $and: [
          { publishedAt: { $notNull: true } },
          { single: { $ne: true } }
        ]
      };
      
      // Aplicar filtros adicionais
      if (query.filters) {
        Object.assign(filters, query.filters);
      }
      
      // Se for featured, filtrar por posts com imagem
      if (featured) {
        filters.$and.push({ coverImage: { $notNull: true } });
      }
      
      // Buscar dados
      const { results: data, pagination } = await strapi.entityService.findPage(
        'api::noticia.noticia',
        {
          filters,
          populate: {
            coverImage: {
              fields: ['url', 'alternativeText', 'formats']
            },
            category: {
              fields: ['name', 'slug']
            },
            authors: {
              fields: ['name', 'slug']
            }
          },
          fields: ['id', 'title', 'slug', 'excerpt', 'publishedAt', 'createdAt', 'single'],
          sort: { publishedAt: 'desc' },
          page,
          pageSize
        }
      );
      
      ctx.body = {
        data,
        meta: {
          pagination
        }
      };
    } catch (error) {
      console.error('Erro no endpoint listagem:', error);
      ctx.throw(500, 'Erro interno do servidor');
    }
  }
}));
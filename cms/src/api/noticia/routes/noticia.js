'use strict';

/**
 * noticia router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::noticia.noticia');

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;
  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      if (!routes) routes = [...innerRouter.routes, ...extraRoutes];
      return routes;
    },
  };
};

const customRoutes = [
  {
    method: 'GET',
    path: '/noticias/listagem',
    handler: 'api::noticia.noticia.listagem',
    config: {
      auth: false,
    },
  },
];

module.exports = customRouter(defaultRouter, customRoutes);
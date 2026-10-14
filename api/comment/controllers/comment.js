'use strict';

const { sanitizeEntity } = require('strapi-utils');

module.exports = {
  async create(ctx) {
    const { authorName, body, article } = ctx.request.body || {};

    if (!authorName || !body || !article) {
      return ctx.badRequest('authorName, body, and article are required');
    }

    const articleId = typeof article === 'object' ? article.id : article;
    const exists = await strapi.query('article').findOne({ id: articleId });
    if (!exists) {
      return ctx.notFound('Article not found');
    }

    const entity = await strapi.services.comment.create({
      authorName: String(authorName).trim().slice(0, 80),
      body: String(body).trim().slice(0, 2000),
      article: articleId,
      approved: false,
    });

    return sanitizeEntity(entity, { model: strapi.models.comment });
  },

  async find(ctx) {
    const query = { ...(ctx.query || {}) };
    if (query.approved === undefined && query._where === undefined) {
      query.approved = true;
    }
    ctx.query = query;
    const entities = await strapi.services.comment.find(ctx.query);
    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.comment })
    );
  },
};

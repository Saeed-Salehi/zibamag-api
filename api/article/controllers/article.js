'use strict';

const { sanitizeEntity } = require('strapi-utils');

module.exports = {
  async view(ctx) {
    const { id } = ctx.params;
    const article = await strapi.query('article').findOne({ id });
    if (!article) return ctx.notFound('Article not found');

    const views = (article.views || 0) + 1;
    const updated = await strapi.query('article').update({ id }, { views });
    return { id: updated.id, views: updated.views };
  },

  async rate(ctx) {
    const { id } = ctx.params;
    const rating = Number((ctx.request.body || {}).rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return ctx.badRequest('rating must be an integer from 1 to 5');
    }

    const article = await strapi.query('article').findOne({ id });
    if (!article) return ctx.notFound('Article not found');

    const ratingSum = (article.ratingSum || 0) + rating;
    const ratingCount = (article.ratingCount || 0) + 1;
    const updated = await strapi.query('article').update(
      { id },
      { ratingSum, ratingCount }
    );

    return sanitizeEntity(updated, { model: strapi.models.article });
  },
};

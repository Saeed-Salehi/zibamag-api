'use strict';

const { sanitizeEntity } = require('strapi-utils');

/**
 * Only allow public submissions of contact form fields.
 * Forces isRead to false so clients cannot mark messages as read.
 */
module.exports = {
  async create(ctx) {
    const { fullName, mobile, message } = ctx.request.body || {};

    if (!fullName || !mobile || !message) {
      return ctx.badRequest('fullName, mobile, and message are required');
    }

    const entity = await strapi.services['contact-message'].create({
      fullName: String(fullName).trim(),
      mobile: String(mobile).trim(),
      message: String(message).trim(),
      isRead: false,
    });

    return sanitizeEntity(entity, { model: strapi.models['contact-message'] });
  },
};

'use strict';

const original = require('strapi-plugin-content-manager/controllers/collection-types');
const { getService } = require('strapi-plugin-content-manager/utils');

const CONTACT_MESSAGE_UID = 'application::contact-message.contact-message';

module.exports = {
  ...original,

  async findOne(ctx) {
    await original.findOne.call(this, ctx);

    if (ctx.status >= 400) {
      return;
    }

    if (ctx.params.model !== CONTACT_MESSAGE_UID) {
      return;
    }

    if (!ctx.body || ctx.body.isRead) {
      return;
    }

    const entityManager = getService('entity-manager');
    const updated = await entityManager.update(ctx.body, { isRead: true }, CONTACT_MESSAGE_UID);

    ctx.body = {
      ...ctx.body,
      ...updated,
      isRead: true,
    };
  },

  async create(ctx) {
    if (ctx.params.model === CONTACT_MESSAGE_UID) {
      return ctx.forbidden(
        'Contact messages can only be created from the website form'
      );
    }

    return original.create.call(this, ctx);
  },
};

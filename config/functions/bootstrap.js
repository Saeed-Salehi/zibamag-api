'use strict';

const fs = require('fs');
const path = require('path');

const CONTACT_MESSAGE_UID = 'application::contact-message.contact-message';

function ensureUploadsDir() {
  const uploadsDir = path.join(strapi.dir, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    strapi.log.info(`Created missing uploads directory at ${uploadsDir}`);
  }
}

async function enablePublicPermission(controller, action) {
  const publicRole = await strapi
    .query('role', 'users-permissions')
    .findOne({ type: 'public' });

  if (!publicRole) return;

  const permission = await strapi.query('permission', 'users-permissions').findOne({
    role: publicRole.id,
    type: 'application',
    controller,
    action,
  });

  if (!permission) return;

  if (!permission.enabled) {
    await strapi
      .query('permission', 'users-permissions')
      .update({ id: permission.id }, { enabled: true });
    strapi.log.info(`Enabled Public ${controller}.${action}`);
  }
}

async function enablePublicSitePermissions() {
  const pairs = [
    ['contact-message', 'create'],
    ['comment', 'create'],
    ['comment', 'find'],
    ['comment', 'findone'],
    ['comment', 'count'],
    ['tag', 'find'],
    ['tag', 'findone'],
    ['tag', 'count'],
    ['article', 'find'],
    ['article', 'findone'],
    ['article', 'count'],
    ['article', 'view'],
    ['article', 'rate'],
    ['category', 'find'],
    ['category', 'findone'],
    ['contributor', 'find'],
    ['contributor', 'findone'],
    ['global', 'find'],
    ['pages', 'find'],
    ['pages', 'findone'],
  ];

  for (const [controller, action] of pairs) {
    await enablePublicPermission(controller, action);
  }
}

async function disableAdminContactMessageCreate() {
  const permissions = await strapi.query('permission', 'admin').find({
    action: 'plugins::content-manager.explorer.create',
    subject: CONTACT_MESSAGE_UID,
    _limit: -1,
  });

  if (!permissions.length) return;

  await strapi.admin.services.permission.deleteByIds(permissions.map((p) => p.id));
  strapi.log.info(
    'Disabled admin create permission for Contact Message (website form only)'
  );
}

module.exports = async () => {
  ensureUploadsDir();
  await enablePublicSitePermissions();

  const roleService = strapi.admin.services.role;
  const originalReset = roleService.resetSuperAdminPermissions.bind(roleService);

  roleService.resetSuperAdminPermissions = async () => {
    await originalReset();
    await disableAdminContactMessageCreate();
  };
};

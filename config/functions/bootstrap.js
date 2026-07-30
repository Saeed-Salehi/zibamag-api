'use strict';

const fs = require('fs');
const path = require('path');

const CONTACT_MESSAGE_UID = 'application::contact-message.contact-message';

/**
 * Local upload provider writes to public/uploads; ensure the directory exists.
 */
function ensureUploadsDir() {
  const uploadsDir = path.join(strapi.dir, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    strapi.log.info(`Created missing uploads directory at ${uploadsDir}`);
  }
}

/**
 * Enable Public role permission to create contact messages from the website form.
 */
async function enablePublicContactMessageCreate() {
  const publicRole = await strapi
    .query('role', 'users-permissions')
    .findOne({ type: 'public' });

  if (!publicRole) {
    return;
  }

  const permission = await strapi.query('permission', 'users-permissions').findOne({
    role: publicRole.id,
    type: 'application',
    controller: 'contact-message',
    action: 'create',
  });

  if (!permission) {
    return;
  }

  if (!permission.enabled) {
    await strapi
      .query('permission', 'users-permissions')
      .update({ id: permission.id }, { enabled: true });

    strapi.log.info('Enabled Public create permission for contact-message');
  }
}

/**
 * Contact messages must only be created from the website form,
 * so remove Content Manager "create" permission for all admin roles.
 */
async function disableAdminContactMessageCreate() {
  const permissions = await strapi.query('permission', 'admin').find({
    action: 'plugins::content-manager.explorer.create',
    subject: CONTACT_MESSAGE_UID,
    _limit: -1,
  });

  if (!permissions.length) {
    return;
  }

  await strapi.admin.services.permission.deleteByIds(permissions.map((p) => p.id));

  strapi.log.info(
    'Disabled admin create permission for Contact Message (website form only)'
  );
}

module.exports = async () => {
  ensureUploadsDir();
  await enablePublicContactMessageCreate();

  // Admin bootstrap runs AFTER app bootstrap and calls resetSuperAdminPermissions,
  // which would re-grant create. Wrap it so we remove create right after.
  const roleService = strapi.admin.services.role;
  const originalReset = roleService.resetSuperAdminPermissions.bind(roleService);

  roleService.resetSuperAdminPermissions = async () => {
    await originalReset();
    await disableAdminContactMessageCreate();
  };
};

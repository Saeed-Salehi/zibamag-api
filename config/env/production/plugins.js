module.exports = ({ env }) => ({
  // Local disk storage under public/uploads (proxied by Next at /uploads).
  // Cloudinary requires CLOUDINARY_* env vars and is not used in this deploy.
  // sizeLimit is compared against file.size in KB (Strapi 3 quirk) — keep this high.
  upload: {
    provider: 'local',
    providerOptions: {
      sizeLimit: 100 * 1024 * 1024,
    },
  },
});

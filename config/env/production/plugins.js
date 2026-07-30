module.exports = ({ env }) => ({
  // Local disk storage under public/uploads (proxied by Next at /uploads).
  // Cloudinary requires CLOUDINARY_* env vars and is not used in this deploy.
  upload: {
    provider: 'local',
    providerOptions: {},
  },
});

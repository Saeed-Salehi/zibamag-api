module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite')

  if (client === 'postgres') {
    return {
      defaultConnection: 'default',
      connections: {
        default: {
          connector: 'bookshelf',
          settings: {
            client: 'postgres',
            host: env('DATABASE_HOST', 'localhost'),
            port: env.int('DATABASE_PORT', 5432),
            database: env('DATABASE_NAME', 'strapi'),
            username: env('DATABASE_USERNAME', 'strapi'),
            password: env('DATABASE_PASSWORD', 'strapi'),
            schema: 'public',
            ssl: env.bool('DATABASE_SSL', false)
              ? { rejectUnauthorized: false }
              : false,
          },
          options: {},
        },
      },
    }
  }

  // Default for this VPS: same SQLite file as before (do not touch .tmp/data.db)
  return {
    defaultConnection: 'default',
    connections: {
      default: {
        connector: 'bookshelf',
        settings: {
          client: 'sqlite',
          filename: env('DATABASE_FILENAME', '.tmp/data.db'),
        },
        options: {
          useNullAsDefault: true,
        },
      },
    },
  }
}

const urlParser = require('pg-connection-string').parse;
const { knexSnakeCaseMappers } = require('objection');
const Heroku = require('./src/HerokuPlatformAPI');

const {
    NODE_ENV,
    KNEX_CLIENT,
    KNEX_MIGRATION_TABLE,
    KNEX_MIGRATION_SEEDS,
    KNEX_CONNECTION_USER,
    KNEX_CONNECTION_PASSWORD,
    KNEX_CONNECTION_PORT,
    KNEX_CONNECTION_DATABASE,
    KNEX_MAX_POOL_SIZE,
    KNEX_ACQUIRE_TIMEOUT_MILLIS
} = process.env;

const conConfig = {
    client: KNEX_CLIENT,
    searchPath: ['rcg_tms', 'public', 'salesforce'],
    migrations: {
        tableName: KNEX_MIGRATION_TABLE
    },
    seeds: {
        directory: KNEX_MIGRATION_SEEDS
    },
    pool: {
        acquireTimeoutMillis: KNEX_ACQUIRE_TIMEOUT_MILLIS && parseInt(KNEX_ACQUIRE_TIMEOUT_MILLIS) || 30000,
        min: 1,
        max: KNEX_MAX_POOL_SIZE && parseInt(KNEX_MAX_POOL_SIZE) || 50
    },
    ...knexSnakeCaseMappers({ underscoreBetweenUppercaseLetters: true })
};

module.exports = () =>
{
    switch (NODE_ENV)
    {
        case 'pipeline':
            conConfig.client = KNEX_CLIENT;
            conConfig.migrations.tableName = KNEX_MIGRATION_TABLE;
            conConfig.connection = {
                user: KNEX_CONNECTION_USER,
                password: KNEX_CONNECTION_PASSWORD,
                port: KNEX_CONNECTION_PORT,
                database: KNEX_CONNECTION_DATABASE
            };

            break;
        case 'local':
        case 'test':
            conConfig.connection = {
                user: KNEX_CONNECTION_USER,
                password: KNEX_CONNECTION_PASSWORD,
                port: KNEX_CONNECTION_PORT,
                database: KNEX_CONNECTION_DATABASE
            };
            break;
        case 'development':
        case 'dev':
        case 'staging':
        case 'production':
        case 'prod':
            // rejectUnathorized is used for self signed certificates, it still encrypts the data
            conConfig.connection = async () =>
            {
                const base = { ssl: { rejectUnauthorized: false } };
                const c = await Heroku.getConfig();
                return Object.assign(base, urlParser(c.DATABASE_URL));
            };
            break;
        default:
            throw new Error('Unknown environment set : ' + NODE_ENV);
    }
    return conConfig;
};

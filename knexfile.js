const urlParser = require('pg-connection-string').parse;
const Heroku = require('./src/HerokuPlatformAPI');
const { knexSnakeCaseMappers } = require('objection');

const env = process.env.NODE_ENV;
const conConfig = {
    client: process.env.KNEX_CLIENT,
    searchPath: ['rcg_tms', 'public', 'salesforce'],
    migrations: {
        tableName: process.env.KNEX_MIGRATION_TABLE
    },
    seeds: {
        directory: process.env.KNEX_MIGRATION_SEEDS
    },
    ...knexSnakeCaseMappers({ underscoreBetweenUppercaseLetters: true })
};

module.exports = () =>
{
    switch (env)
    {
        case 'pipeline':
            conConfig.client = process.env.KNEX_CLIENT;
            conConfig.migrations.tableName = process.env.KNEX_MIGRATION_TABLE;
            conConfig.connection = {
                user: process.env.KNEX_CONNECTION_USER,
                password: process.env.KNEX_CONNECTION_PASSWORD,
                port: process.env.KNEX_CONNECTION_PORT,
                database: process.env.KNEX_CONNECTION_DATABASE
            };

            break;
        case 'local':
        case 'test':
            conConfig.connection = {
                user: process.env.KNEX_CONNECTION_USER,
                password: process.env.KNEX_CONNECTION_PASSWORD,
                port: process.env.KNEX_CONNECTION_PORT,
                database: process.env.KNEX_CONNECTION_DATABASE
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
            conConfig.pool = { min: 1, max: 25 };
            break;
        default:
            throw new Error('Unknown environment set : ' + env);
    }
    return conConfig;
};

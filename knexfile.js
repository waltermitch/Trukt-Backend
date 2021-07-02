const urlParser = require('pg-connection-string').parse;
const Heroku = require('./Classes/HerokuPlatformAPI');
const { knexSnakeCaseMappers } = require('objection');

require('./local.settings.js');

const env = process.env.NODE_ENV || process.env.ENV;
const conConfig = {
    client: process.env['knex.client'],
    searchPath: ['rcg_tms'],
    migrations: {
        tableName: process.env['knex.migration.table']
    },
    seeds: {
        directory: process.env['knex.migration.seeds']
    },
    ...knexSnakeCaseMappers({ underscoreBetweenUppercaseLetters: true, underscoreBeforeDigits: true })
};

module.exports = () =>
{
    switch (env)
    {
        case 'local':
        case 'test':
            conConfig.connection = {};
            for (const field of [
                'user',
                'password',
                'port',
                'database'
            ])

                conConfig.connection[field] = process.env[`knex.connection.${field}`];

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
            conConfig.pool = { min: 1, max: 5 };
            break;
        default:
            throw new Error('Unknown environment set : ' + env);
    }
    return conConfig;
};

// Update with your config settings.
const urlParser = require('pg-connection-string');

const url = 'postgres://cicfcrqswbsfal:4e2d97e15dbeee22629fbe00b1f2bb4d0e7d992882e2a45601a02e697db0e527@ec2-54-166-167-192.compute-1.amazonaws.com:5432/dbfms4ghb6oo55';

module.exports = {
    local: {
        client: 'postgresql',
        connection: {
            user: 'postgres',
            password: 'password',
            port: '5432',
            database: 'postgres'
        },
        migrations: {
            tableName: 'knex_migrations'
        }
    },
    development: {
        client: 'postgresql',
        connection: Object.assign({ ssl: { rejectUnauthorized: false } }, urlParser(url)),
        migrations: {
            tableName: 'knex_migrations'
        }
    },

    staging: {
        client: 'postgresql',
        connection: {
            database: 'my_db',
            user: 'username',
            password: 'password'
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations'
        }
    },

    production: {
        client: 'postgresql',
        connection: {
            database: 'my_db',
            user: 'username',
            password: 'password'
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations'
        }
    }

};

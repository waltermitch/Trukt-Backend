// Update with your config settings.

module.exports = {
    local: {
        client: 'postgresql',
        connection: {
            user: 'postgres',
            password: 'Rcgauto202020',
            port: '6776',
            database: 'rcg_trukt'
        },
        searchPath: ['rcg_tms'],
        migrations: {
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './seeds/local'
        }
    },
    development: {
        client: 'postgresql',
        connection: {
            user: 'postgres',
            password: 'password',
            port: '6776',
            database: 'rcg_tms'
        },
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

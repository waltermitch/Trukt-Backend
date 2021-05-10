const urlParser = require('pg-connection-string').parse;
const Heroku = require('./HerokuPlatformAPI');
const knex = require('knex');
const pg = require('pg');

let db;

class PG
{
    constructor()
    { }

    static async connect()
    {
        if(!db)
        {
            // get url
            const res = await Heroku.getConfig();

            // parse url
            const config = urlParser(res.DATABASE_URL);

            // connect
            db = knex(
                {
                    client: 'pg',
                    connection: Object.assign({ ssl: { rejectUnauthorized: false }}, config)
                }).withSchema('salesforce');
        }

        return db;
    }
}

module.exports = PG;
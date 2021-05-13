const urlParser = require('pg-connection-string').parse;
const Heroku = require('./HerokuPlatformAPI');
const knex = require('knex');

let db;

class PG
{
    constructor()
    { }

    static async connect()
    {
        if (!db)
        {
            // get url
            const res = await Heroku.getConfig();

            // parse url and no ssl
            const opts = Object.assign({ ssl: { rejectUnauthorized: false } }, urlParser(res.DATABASE_URL));

            // connect
            db = await knex(
                {
                    client: 'pg',
                    connection: opts,
                    searchPath: 'salesforce'
                });
        }

        return db;
    }

    static async getVariable(value)
    {
        const db = await PG.connect();

        // eslint-disable-next-line
        const res = await db.select(db.raw(`"Data"`)).from('variables').whereRaw(`"Data" ->> 'name' = ?`, value)

        return res;
    }

    static async upsertVariable(payload)
    {
        const db = await PG.connect();

        await db.insert({ 'Data': JSON.stringify(payload) }).into('variables');
    }
}

module.exports = PG;
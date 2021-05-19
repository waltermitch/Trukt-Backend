const urlParser = require('pg-connection-string').parse;
const Heroku = require('./HerokuPlatformAPI');
const knex = require('knex');

let db;

class PG
{
    constructor() { }

    static async connect(searchPath = 'salesforce')
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
                    searchPath: searchPath
                });
        }

        return db;
    }

    static async getVariable(value)
    {
        const db = await PG.connect();

        const res = await db.select('Data').from('variables').where({ Name: value });

        // return the first element and the data object because it comes in a dumb format
        return res?.[0]?.Data;
    }

    static async upsertVariable(payload)
    {
        const db = await PG.connect();

        await db.insert({ 'Data': JSON.stringify(payload), 'Name': payload.name }).into('variables').onConflict('Name').merge();
    }
}

module.exports = PG;
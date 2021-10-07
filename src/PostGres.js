const knexfile = require('../knexfile');
const { Pool } = require('pg');
const Knex = require('knex');

let db;

class PG
{
    static async connect()
    {
        if (!db)
            db = await Knex(knexfile());

        return db;
    }

    static async getRawConnection()
    {
        const db = await PG.connect();

        let config;
        if (Object.prototype.toString.call(db.client.config.connection) === '[object AsyncFunction]')
            config = await db.client.config.connection();
        else
            config = db.client.config.connection;

        const conn = new Pool(config);

        const rawClient = await conn.connect();

        return rawClient;
    }
}

module.exports = PG;
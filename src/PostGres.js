const knexfile = require('../knexfile');
const Knex = require('knex');

let db;

class PG
{
    constructor() { }

    static async connect()
    {
        if (!db)
            db = await Knex(knexfile());

        return db;
    }

    static async getRawConnection()
    {
        const db = await PG.connect();

        return db.client.acquireRawConnection();
    }
}

module.exports = PG;
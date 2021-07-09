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

        return db
    }

    static async getRawConnection()
    {
        const db = await PG.connect();

        return db.client.acquireRawConnection();
    }

    static async getVariable(value)
    {
        const db = await PG.connect();

        const res = await db.select('data').from('variables').where({ name: value });

        // return the first element and the data object because it comes in a dumb format
        return res?.[0]?.data || {};
    }

    static async upsertVariable(payload)
    {
        const db = await PG.connect();

        await db.insert({ 'data': JSON.stringify(payload), 'name': payload.name }).into('variables')
            .onConflict('name')
            .merge();
    }

    static getRecordTypeId(objectName, recordTypeName)
    {
        return config.SF.RecordTypeIds?.[`${objectName}`]?.[`${recordTypeName}`];
    }
}

module.exports = PG;
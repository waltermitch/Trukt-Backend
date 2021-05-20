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

    static async getAccountByType(type, searchString)
    {
        // connect
        const db = await PG.connect();

        // get record type
        const recordTypeId = PG.getRecordTypeId('Account', type);

        // compose query based on account type
        let query = `name like '%${searchString}%' `;

        // default list of fields to select
        const fieldsToSelect = ['name', 'email__c as email', 'phone'];

        // query for different things based on account type
        switch (type)
        {
            case 'Client':
                break;
            case 'Carrier':
                fieldsToSelect.push('dot_number__c as dotNumber');
                query += `or dot_number__c like '${searchString}%'`
                break;

        }

        // something
        // const res = await db.select(...fieldsToSelect)
        //     .from('account')
        //     .whereRaw(query)
        //     .andWhere({ recordtypeid: recordTypeId })
        //     .union([db.select('firstname', 'lastname', 'phone').from({ 'contacts': 'contact' }).whereRaw(`accountid = account.id`)])

        return await db.raw(`select row_to_json(res) as accounts from
                            (select a.name, 
                                (select json_agg(contacts) as contacts from 
                                (select firstname, lastname, phone 
                                    from salesforce.contact c where a.sfid = c.accountid) 
                                    as contacts)  
                                    from salesforce.account a
                                    where a.name like 'LKQ Cor%') 
                                as res`)

        return db.select(...fieldsToSelect)
            .from('account')
            .whereRaw(query)
            .andWhere({ recordtypeid: recordTypeId })
            .union([db.select('firstname', 'lastname', 'phone').from({ 'contacts': 'contact' }).whereRaw(`accountid = account.id`)]).toSQL();

        // .andWhere({ 'RecordTypeId': recordTypeId });

        return res;
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

        await db.insert({ 'Data': JSON.stringify(payload), 'Name': payload.name }).into('variables')
            .onConflict('Name')
            .merge();
    }

    static getRecordTypeId(objectName, recordTypeName)
    {
        return config.SF.RecordTypeIds?.[`${objectName}`]?.[`${recordTypeName}`];
    }
}

module.exports = PG;
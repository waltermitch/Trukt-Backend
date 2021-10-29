/*
    This migration file is STRICTLY for local database instances.
    Use Heroku Connect to get the correct database for the specific environments.
*/
const allowedEnvs = ['local', 'pipeline'];
const fs = require('fs');

const SALESFORCE_TABLES = ['account', 'contact', 'recordtype'];

exports.up = async function (knex)
{

    if (allowedEnvs.includes(process.env.NODE_ENV))
    {
        const content = fs.readFileSync('./sql/salesforce_schema.sql', { encoding: 'utf-8' });
        return knex.raw(content);
    }
    else
    {
        return knex;
    }

};

exports.down = async function (knex)
{
    if (allowedEnvs.includes(process.env.NODE_ENV))
    {
        let builder = knex.schema.withSchema('salesforce');

        for (const table of SALESFORCE_TABLES)
        {
            builder = builder.dropTableIfExists(table);
        }

        let sequences = await knex.raw('select * from information_schema."sequences" s where sequence_schema = \'salesforce\';');
        sequences = sequences.rows.map((it) => { return it.sequence_name; });

        for (const sequence of sequences)
        {
            builder.raw(`DROP SEQUENCE IF EXISTS ${sequence};`);
        }

        return builder;
    }
    else
    {
        return knex;
    }
};

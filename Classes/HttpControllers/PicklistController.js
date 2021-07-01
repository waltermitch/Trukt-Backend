const HttpRouteController = require('./HttpRouteController');
const fs = require('fs');
const Knex = require('knex');
const knexfile = require('../../knexfile');

const knex = Knex(knexfile());
let picklists;
const localPicklistPath = './picklists.json';

class PicklistController extends HttpRouteController
{

    async handleGet(context, req)
    {
        // first check if the picklist is in memory
        if (!picklists)

            if (!fs.existsSync(localPicklistPath))

                // fetch from database
                await this.handlePut(context, req);

            else

                // fetch from file
                picklists = fs.readFileSync(localPicklistPath, 'utf8');

        const res = {
            body: picklists,
            status: 200
        };

        return res;
    }

    /* eslint-disable no-unused-vars */
    async handlePut(context, req)
    {
        let res = {};
        picklists = await this.getPicklistBod();
        fs.writeFile('picklists.json', JSON.stringify(picklists, null, '    '), err =>
        {
            if (err) res = err;
        });
        return res;
    }

    /**
     *
     * @returns queries the database for all the enum types and any other lookup tables and
     * constructs a more readable json object
     */
    async getPicklistBod()
    {
        const final = {};
        const enums = await knex.raw(`
            select 
                n.nspname as enum_schema,
                t.typname as category,
                e.enumlabel as label,
                e.enumlabel as value
            from pg_type t
            join pg_enum e 
                on t.oid = e.enumtypid
            join pg_catalog.pg_namespace n 
                on n.oid = t.typnamespace`);
        const comTypes = await knex.raw('select \'commodityTypes\' as tableName, id as value, concat(category, \'Types\') as category, type as label from rcg_tms.commodity_types');
        const jobTypes = await knex.raw('select \'jobTypes\' as tableName, id as value, concat(category, \'Types\') as category, type as label from rcg_tms.order_job_types');
        const all = enums.rows.concat(comTypes.rows).concat(jobTypes.rows);

        for (const row of all)
        {
            if (!(row.category in final))

                final[row.category] = [];

            final[row.category].push({
                label: row.label,
                value: row.value
            });
        }

        const finalfinal = {};
        for (const category of Object.keys(final))

            finalfinal[this.setCamelCase(category)] = {
                options: final[category].map(it => { return this.createOptionObject(it.label, it.value); })
            };

        return finalfinal;
    }

    createOptionObject(label, value)
    {
        label = this.cleanUpWhitespace(this.cleanUpCamelCase(this.cleanUpSnakeCase(this.capWord(label))));

        return { label, value };
    }

    /**
     *
     * @param {*} String a string that is in snake case
     * @returns returns the string in camel case
     */
    cleanUpSnakeCase(String)
    {
        return String.replace(/(_[A-Za-z])/g, (word, index) =>
        {
            return word.toUpperCase();
        }).replace(/_/gi, '');
    }

    cleanUpCamelCase(String)
    {
        return String.replace(/(?<=[a-z])([A-Z])/g, (word, index) =>
        {
            return ' ' + word;
        });
    }

    setCamelCase(String)
    {
        return String.replace(/[ _]([A-Za-z])/g, (word, p1) =>
        {
            return p1.toUpperCase();
        }).replace(/^\w/, (word, index) => { return word.toLowerCase(); }).replace(/\s/g, '');
    }

    cleanUpWhitespace(String)
    {
        return String.trim().replace(/\s+/g, ' ');
    }

    /**
     * @description takes a string and capitalizes every word in the string separated by white space and followed by an opening parenthesis
     */
    capWord(str)
    {
        return str.replace(/_/g, ' ').replace(/\b(\w)/g, letter => letter.toUpperCase());

    }
}

const controller = new PicklistController();
module.exports = controller;
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

    async handlePut(context, req)
    {
        let res = {};
        picklists = await this.getPicklistBod();
        fs.writeFile('picklists.json', JSON.stringify(picklists), err =>
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
        const enums = await knex.raw(`select n.nspname as enum_schema,
            t.typname as type,
            e.enumlabel as subtype
                from pg_type t
                    join pg_enum e on t.oid = e.enumtypid
                    join pg_catalog.pg_namespace n ON n.oid = t.typnamespace`);
        const final = {};
        this.mapOptions(enums, final);
        const comTypes = await knex.raw('select id, type, subtype from rcg_tms.commodity_types');
        this.mapOptions(comTypes, final);
        return final;
    }

    /**
     *
     * @param {*} queryResult This is a raw query result that should contain an overlying type with a subtype
     * @param {*} final final object that will have all the values inside of it
     * @returns returns the final object with the types and subtypes split into a more readable json object
     */
    mapOptions(queryResult, final)
    {
        let enu;
        let options = [];
        let name = '';
        for (let i = 0; i < queryResult.rows.length; i++)
        {
            enu = queryResult.rows[i];
            name = this.cleanUpSnakeCase(enu.type);
            if (!(name in final))
            {
                final[name] = {};
                options = [enu.subtype];
                final[name].options = options;
            }
            else
            {
                final[name].options.push(enu.subtype);
            }
        }
    }

    /**
     *
     * @param {*} String a string that is in snake case
     * @returns returns the string in camel case
     */
    cleanUpSnakeCase(String)
    {
        return String.replace(/(?:^[A-Z](?=[^A-Z])|_[a-z])/g, (word, index) =>
        {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/_/gi, '');
    }
}

const controller = new PicklistController();
module.exports = controller;
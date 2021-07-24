const HttpRouteController = require('./HttpRouteController');
const fs = require('fs');
const BaseModel = require('../Models/BaseModel');
const https = require('https');

const knex = BaseModel.knex();

// creating an axios connection directly because this will not be reused
// as far as we can tell for now
const opts = {
    httpsAgent: new https.Agent({ keepAlive: true }),
    baseURL: process.env['azure.loadboard.baseurl'],
    headers: {
        'x-functions-key': process.env['azure.loadboard.funcCode']
    }
};
const lbConn = require('axios').create(opts);

let picklists;
const localPicklistPath = './localdata/picklists.json';

class PicklistController extends HttpRouteController
{
    static async getAll(req, res)
    {
        // first check if the picklist is in memory
        if (!picklists)
        {
            if (!fs.existsSync(localPicklistPath))
            {
                // fetch from database
                await PicklistController.updatePicklists();
            }
            else
            {
                // fetch from file
                picklists = JSON.parse(fs.readFileSync(localPicklistPath, 'utf8'));
            }
        }

        const finalBody = {
            body: picklists,
            status: 200
        };

        res.status(200).json(finalBody);
    }

    static async update(req, res)
    {
        try
        {
            await PicklistController.updatePicklists();
            res.status(201).send();
        }
        catch (err)
        {
            res.status(500).send(err);
        }
    }

    static async updatePicklists()
    {
        picklists = await PicklistController.getPicklistBod();
        const lbs = await lbConn.get('/equipmenttypes');
        Object.assign(picklists, lbs.data);

        // const payment_terms = await knex('rcgTms.invoice_bill_payment_terms').select('*');
        // const payment_methods = await knex('rcgTms.invoice_bill_payment_methods').select('*');
        // const equipment_types = await knex('rcgTms.equipment_types').select('id', 'name').whereNot({ 'is_deprecated': true });

        // const paymentTerms = PicklistController.createPicklistObject(payment_terms);
        // const paymentMethods = PicklistController.createPicklistObject(payment_methods);
        // const equipmentTypes = PicklistController.createPicklistObject(equipment_types);

        const paymentTerms = PicklistController.createPicklistObject(await knex('rcgTms.invoice_bill_payment_terms').select('*'));
        const paymentMethods = PicklistController.createPicklistObject(await knex('rcgTms.invoice_bill_payment_methods').select('*'));
        const equipmentTypes = PicklistController.createPicklistObject(await knex('rcgTms.equipment_types').select('id', 'name').whereNot({ 'is_deprecated': true }));

        Object.assign(picklists, { paymentMethods, paymentTerms, equipmentTypes });

        // since the localdata folder does not get tracked in git and not get pushed to the server,
        // check if the folder exists first; create it if it does not exist.
        if (!fs.existsSync('./localdata'))
        {
            fs.mkdirSync('./localdata');
        }

        // at this point the folder should definately exist, so it is safe to write to the file.
        fs.writeFile(localPicklistPath, JSON.stringify(picklists, null), err =>
        {
            if (err) throw err;
        });
    }

    /**
     *
     * @returns queries the database for all the enum types and any other lookup tables and
     * constructs a more readable json object
     */
    static async getPicklistBod()
    {
        const picklists = {};
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

        // this lookup table needed a different category compared to the others because there is already an enum type called expense_types, which conflicts with the results
        // from this query, so the solution was to make this category unique so it does not conflict anymore
        const lineItems = await knex.raw('select \'lineItems\' as tableName, id as value, concat(type, \'LookupTypes\') as category, name as label from rcg_tms.invoice_bill_line_items where is_deprecated is false');

        const all = enums.rows.concat(comTypes.rows).concat(jobTypes.rows).concat(lineItems.rows);

        for (const row of all)
        {
            const category = this.setCamelCase(row.category);
            if (!(category in picklists))
            {
                picklists[category] = { options: [] };
            }
            picklists[category].options.push(this.createOptionObject(row.label, row.value));
        }

        return picklists;
    }

    /**
     * gets a list of raw query data and transforms it into an object
     */
    static createPicklistObject(queryData)
    {
        return {
            options: queryData.map((option) =>
            {
                return this.createOptionObject(option.name, option.id);
            })
        };
    }

    static createOptionObject(label, value)
    {
        label = PicklistController.cleanUpWhitespace(PicklistController.cleanUpCamelCase(PicklistController.cleanUpSnakeCase(PicklistController.capWord(label))));

        return { label, value };
    }

    /**
     *
     * @param {*} String a string that is in snake case
     * @returns returns the string in camel case
     */
    static cleanUpSnakeCase(String)
    {
        return String.replace(/(_[A-Za-z])/g, (word, index) =>
        {
            return word.toUpperCase();
        }).replace(/_/gi, '');
    }

    /**
     *
     * @param {*} String a string that is in camel case
     * @returns the same string with spaces before the capital letters i.e fooBar -> foo Bar
     */
    static cleanUpCamelCase(String)
    {
        return String.replace(/(?<=[a-z])([A-Z])/g, (word, index) =>
        {
            return ' ' + word;
        });
    }

    /**
     *
     * @param {*} String a string with words separated by spaces
     * @returns the string in camel case form i.e foo bar => fooBar
     */
    static setCamelCase(String)
    {
        return String.replace(/[ _]([A-Za-z])/g, (word, p1) =>
        {
            return p1.toUpperCase();
        }).replace(/^\w/, (word, index) => { return word.toLowerCase(); }).replace(/\s/g, '');
    }

    /**
     *
     * @param {*} String a string with more than one space in the middle of the string
     * @returns the string without trailing spaces and removed double spaces in the middle of the string
     */
    static cleanUpWhitespace(String)
    {
        return String.trim().replace(/\s+/g, ' ');
    }

    /**
     * @description takes a string and capitalizes every word in the string separated by white space and followed by an opening parenthesis
     */
    static capWord(str)
    {
        return str.replace(/_/g, ' ').replace(/\b(\w)/g, letter => letter.toUpperCase());

    }
}

const controller = new PicklistController();
module.exports = controller;
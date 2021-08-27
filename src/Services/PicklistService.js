const InvoiceLineItem = require('../Models/InvoiceLineItem');
const CommodityType = require('../Models/CommodityType');
const LoadboardContact = require('../Models/LoadboardContact');
const BaseModel = require('../Models/BaseModel');
const HTTPS = require('../AuthController');
const fs = require('fs');

const knex = BaseModel.knex();

// creating an axios connection directly because this will not be reused
// as far as we can tell for now
const opts = {
    url: process.env['azure.loadboard.baseurl'],
    headers: {
        'x-functions-key': process.env['azure.loadboard.funcCode']
    }
};
const lbConn = new HTTPS(opts).connect();

let picklists;
const localPicklistPath = './localdata/picklists.json';

// this exists to filter out invoice bill line items that are also locksmith
// job types and to create a new picklist with locksmith job types from invoice line items
const locksmithJobNames = [
    'duplicate car keys',
    'laser-cut transponder key',
    'mechanical key',
    'program car remotes',
    'program keys',
    'proximity fob w/last cut key override',
    'remote/key combo',
    'replace car fobs',
    'replace car remotes',
    'self programmable remote',
    'sell car remotes',
    'tibbe key',
    'transponder key'
];

const conditionTypes = {
    options: [
        {
            label: 'Inoperable',
            value: 'yes'
        },
        {
            label: 'Operable',
            value: 'no'
        },
        {
            label: 'Not Verified',
            value: 'unknown'
        }
    ]
};

class PicklistService
{
    static async updatePicklists()
    {
        picklists = await PicklistService.getPicklistBod();

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

        return picklists;
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
        const jobTypes = await knex.raw('select \'jobTypes\' as tableName, id as value, concat(category, \'Types\') as category, type as label from rcg_tms.order_job_types');

        // this lookup table needed a different category compared to the others because there is already an enum type called expense_types, which conflicts with the results
        // from this query, so the solution was to make this category unique so it does not conflict anymore
        const lineItems = await knex.raw('select \'lineItems\' as tableName, id as value, type as category, name as label from rcg_tms.invoice_bill_line_items where is_deprecated is false');
        for (const lineItem of lineItems.rows)
        {
            lineItem.category = 'expenseItems';
        }

        // this api endpoint calls the loadboards function app that
        // gathers loadboard picklist information and sends it back
        // as a response.
        const loadboardData = (await lbConn.get('/equipmenttypes')).data;

        for (const contact of (await LoadboardContact.query()))
        {
            const newContact = { id: contact.id, name: contact.name, phone: contact.phone, email: contact.email };
            if (loadboardData[`${contact.loadboard}`].contacts == null)
            {
                loadboardData[`${contact.loadboard}`].contacts = [newContact];
            }
            else
            {
                loadboardData[`${contact.loadboard}`].contacts.push(newContact);
            }
        }

        const paymentTerms = PicklistService.createPicklistObject(await knex('rcgTms.invoice_bill_payment_terms').select('*'));
        const paymentMethods = PicklistService.createPicklistObject(await knex('rcgTms.invoice_bill_payment_methods').select('*'));
        const equipmentTypes = PicklistService.createPicklistObject(await knex('rcgTms.equipment_types').select('id', 'name').whereNot({ 'is_deprecated': true }));
        const locksmithJobTypes = PicklistService.createPicklistObject(await InvoiceLineItem.query().whereIn('name', locksmithJobNames).andWhere({ 'is_deprecated': false }));
        const commodityTypes = PicklistService.createCommodityTypes(await CommodityType.query().select('id', 'category', 'type as name'));

        const all = enums.rows.concat(jobTypes.rows).concat(lineItems.rows);

        for (const row of all)
        {
            const category = this.setCamelCase(row.category);
            if (!(category in picklists))
            {
                picklists[category] = { options: [] };
            }
            picklists[category].options.push(this.createOptionObject(row.label, row.value));
        }

        Object.assign(picklists, {
            paymentMethods,
            paymentTerms,
            equipmentTypes,
            locksmithJobTypes,
            loadboardData,
            commodityTypes,
            conditionTypes
        });
        return picklists;
    }

    /**
     * @description this method exists purely because Brad wants the vehicle commodity type
     * labeled as 'vehicles'. This called for a hard coded solution
     * @param {*} commTypes a raw objection query result of the commoditiy types
     * @returns an object with vehicles and freight options
     */
    static createCommodityTypes(commTypes)
    {
        const types = { vehicles: { options: [] }, freight: { options: [] } };
        types.commodityTypes = { options: [{ label: 'Vehicles', value: 'vehicle' }, { label: 'Freight', value: 'freight' }] };
        for (const type of commTypes)
        {
            if (type.category === 'vehicle')
            {
                types.vehicles.options.push(PicklistService.createOptionObject(type.name, type.id));
            }
            else if (type.category === 'freight')
            {
                types.freight.options.push(PicklistService.createOptionObject(type.name, type.id));
            }
        }
        return types;
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
        label = PicklistService.cleanUpWhitespace(PicklistService.cleanUpCamelCase(PicklistService.cleanUpSnakeCase(PicklistService.capWord(label))));

        return { label, value };
    }

    /**
     *
     * @param {*} String a string that is in snake case
     * @returns returns the string in camel case
     */
    static cleanUpSnakeCase(String)
    {
        return String.replace(/(_[A-Za-z])/g, (word) =>
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
        return String.replace(/(?<=[a-z])([A-Z])/g, (word) =>
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
        }).replace(/^\w/, (word) => { return word.toLowerCase(); }).replace(/\s/g, '');
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

module.exports = PicklistService;
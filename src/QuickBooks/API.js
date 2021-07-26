const SFAccount = require('../Models/SFAccount');
const HTTPS = require('../AuthController');
const NodeCache = require('node-cache');
const Vendor = require('./Vendor');
const Client = require('./Client');
const Mongo = require('../Mongo');

const tokenName = process.env['quickbooks.tokenName'];
const url = process.env['quickbooks.apiUrl'];

// storing dynamic values in this one
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 60 * 60 * 24, arrayValueSize: 20 });

let qb;

class QBO
{
    static async connect()
    {
        if (!qb?.expCheck())
        {
            const opts = { url, tokenName: 'qb_access_token' };

            const token = await Mongo.getSecret({ 'name': tokenName });

            qb.exp = token.exp;

            if (!qb?.instance)
            {
                qb = new HTTPS(opts);

                qb.connect();
            }

            qb.setToken(token.value);
        }

        return qb.instance;
    }

    static async batch(arr)
    {
        // TODO validation
        // const errors = Validator.evalSchema('quickbooksBatch', arr)

        // if (errors?.length > 0)
        // {
        //     console.log(errors)
        //     throw { 'status': 400, 'data': errors };
        // }
        // else
        // {

        const api = await QBO.connect();

        const results = [];

        // qb has limit of 30 objects per batch
        // break down into groups of 30
        for (let i = 0, j = arr.length; i < j; i += 30)
        {
            const temp = arr.slice(i, i + 30);

            const res = await api.post('/batch', { 'BatchItemRequest': temp });

            // add results to array
            results.push(res.data.BatchItemResponse);
        }

        return results;

        // }
    }

    static async upsertClient(data)
    {
        const client = new Client(data);

        const api = await QBO.connect();

        // get client types
        const clientTypes = await QBO.getClientTypes();

        // set client type
        client.setBusinessType(data.businessType, clientTypes);

        if (!data.qbId)
        {
            // create
            const res = await api.post('/client', client);

            // save qbid in database
            await SFAccount.query().patch({ qbId: res.data.Client.Id }).where('guid', data?.guid);
        }
        else
        {
            // update
            const SyncToken = await QBO.getSyncToken('Client', data.qbId);

            client.SyncToken = SyncToken;
            client.Id = data.qbId;

            await api.post('/client', client);
        }
    }

    static async upsertVendor(data)
    {
        const vendor = new Vendor(data);

        const api = await QBO.connect();

        if (!data.qbId)
        {
            // create
            const res = await api.post('/vendor', vendor);

            // save qbid in database
            await SFAccount.query().patch({ qbId: res.data.Vendor.Id }).where('sfId', data?.sfId);
        }
        else
        {
            // update
            const SyncToken = await QBO.getSyncToken('Vendor', data.qbId);

            vendor.SyncToken = SyncToken;
            vendor.Id = data.qbId;

            await api.post('/vendor', vendor);
        }
    }

    static async getSyncToken(objectName, objectId)
    {
        const api = await QBO.connect();

        const res = await api.get(`/${objectName?.toLowerCase()}/${objectId}`);

        return res.data[`${objectName}`].SyncToken;
    }

    static async getItemTypes()
    {
        const items = cache.get('itemTypes');

        if (items)
            return items;

        const api = await QBO.connect();

        // get items
        const res = await api.get('/query?query=Select * from Item');

        const arr = res.data.QueryResponse.Item;

        const obj = {};

        for (let i = 0; i < arr.length; i++)
            obj[`${arr[i].Name}`] = arr[i];

        // add to cache
        cache.set('itemTypes', obj);

        return obj;
    }

    static async getClientTypes()
    {
        const clientTypes = cache.get('clientTypes');

        if (clientTypes)
            return clientTypes;

        const api = await QBO.connect();

        // get customer type
        const res = await api.get('/query?query=Select * from CustomerType');

        const arr = res.data.QueryResponse.CustomerType;

        const obj = {};

        for (let i = 0; i < arr.length; i++)
            obj[`${arr[i].Name}`] = arr[i];

        // add to cache
        cache.set('clientTypes', obj);

        return obj;
    }
}

module.exports = QBO;
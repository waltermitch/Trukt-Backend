const SFAccount = require('../Models/SFAccount');
const HTTPS = require('../AuthController');
const NodeCache = require('node-cache');
const Mongo = require('../Mongo');
const Vendor = require('./Vendor');
const Client = require('./Client');

const tokenName = process.env['quickbooks.tokenName'];
const url = process.env['quickbooks.apiUrl'];

//storing dynamic values in this one
const cache = new NodeCache({ deleteOnExpire: false, stdTTL: 60 * 60 * 24 })

let qb;

class QBO
{
    static async connect()
    {
        if (!qb?.expCheck())
        {
            const opts = { url, tokenName };

            const token = await Mongo.getSecret({ 'name': tokenName });

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

        if (!data.qbId)
        {
            // create
            const res = await api.post('/client', client);

            // save qbid in database
            await SFAccount.query().patch({ qbId: res.data.Client.Id }).where('sfId', data?.sfId);
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
        if (!api)
    }
}

module.exports = QBO;
const InvoicePaymentMethod = require('../Models/InvoicePaymentMethod');
const QBPaymentTerm = require('../Models/QBPaymentTerm');
const QBAccount = require('../Models/QBAccount');
const HTTPS = require('../AuthController');
const NodeCache = require('node-cache');
const Mongo = require('../Mongo');

const url = process.env['quickbooks.apiUrl'];
const tokenName = 'qb_access_token';

// store client types (for now)
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 60 * 60 * 24 });

let qb;

class QBO
{
    static async connect(keepAlive = true)
    {
        if (!qb?.expCheck())
        {
            const opts = { url, tokenName };

            const token = await Mongo.getSecret(tokenName);

            if (!token)
                throw { 'data': 'No QBO Access Token Found' };

            if (!qb?.instance)
            {
                qb = new HTTPS(opts);

                qb.connect(keepAlive);
            }

            qb.exp = token.exp;

            qb.setToken(token.value);
        }

        return qb.instance;
    }

    static async batch(arr)
    {
        const api = await QBO.connect();

        const results = [];

        // qb has limit of 30 objects per batch
        // break down into groups of 30
        for (let i = 0, j = arr.length; i < j; i += 30)
        {
            const temp = arr.slice(i, i + 30);

            const res = await api.post('/batch', { 'BatchItemRequest': temp });

            // add results to array
            results.push(...res.data.BatchItemResponse);
        }

        return results;
    }

    static async upsertClient(client)
    {
        const api = await QBO.connect();

        const res = await api.post('/customer', client);

        return res.data;
    }

    static async upsertVendor(vendor)
    {
        const api = await QBO.connect();

        const res = await api.post('/vendor', vendor);

        return res.data;
    }

    static async getSyncToken(objectName, objectId)
    {
        const { SyncToken } = await QBO.get(objectName, objectId);

        return SyncToken;
    }

    static async get(objectName, objectId)
    {
        if (!objectName || !objectId)
            throw { 'status': 400, 'error': 'Missing Object Name/Id' };

        const api = await QBO.connect();

        const res = await api.get(`/${objectName?.toLowerCase()}/${objectId}`);

        return res.data[`${objectName}`];
    }

    static async getClientByName(name)
    {
        const api = await QBO.connect();

        const res = await api.get(`/query?query=Select * from Customer where DisplayName = '${name}'`);

        return res.data.QueryResponse.Customer;
    }

    static async getVendorByName(name)
    {
        const api = await QBO.connect();

        const res = await api.get(`/query?query=Select * from Vendor where DisplayName = '${name}'`);

        return res.data.QueryResponse.Vendor;
    }

    static async syncListsToDB(keepAlive = true)
    {
        let [accounts, methods, terms] = await Promise.all([QBO.getAccounts(keepAlive), QBO.getPaymentMethods(keepAlive), QBO.getPaymentTerms(keepAlive)]);

        accounts = accounts.filter((it) => it?.Description?.includes('EXTERNAL'))
            .map((e) => { return { 'name': e.Name, 'id': e.Id }; });

        methods = methods.map((e) => { return { 'name': e.Name, 'externalId': e.Id, 'externalSource': 'QBO' }; });
        terms = terms.map((e) => { return { 'name': e.Name, 'id': e.Id }; });

        const trx = await QBAccount.startTransaction();

        try
        {
            await Promise.all([QBAccount.query(trx).insert(accounts).onConflict('id').merge(), QBPaymentTerm.query(trx).insert(terms).onConflict('id').merge(), InvoicePaymentMethod.query(trx).insert(methods).onConflict('externalId').merge()]);
            await trx.commit();
        }
        catch (err)
        {
            await trx.rollback();
        }
    }

    static async getItemTypes()
    {
        const api = await QBO.connect();

        const res = await api.get('/query?query=Select * from Item');

        return res.data.QueryResponse.Item;
    }

    static async getPaymentMethods(keepAlive = true)
    {
        const api = await QBO.connect(keepAlive);

        const res = await api.get('/query?query=Select * from PaymentMethod');

        return res.data.QueryResponse.PaymentMethod;
    }

    static async getPaymentTerms(keepAlive = true)
    {
        const api = await QBO.connect(keepAlive);

        const res = await api.get('/query?query=Select * from Term');

        return res.data.QueryResponse.Term;
    }

    static async getClientTypes()
    {
        const clientTypes = cache.get('clientTypes');

        if (clientTypes)
            return clientTypes;

        const api = await QBO.connect();

        // get customer type
        const res = await api.get('/query?query=Select * from CustomerType');

        const arr = res.data.QueryResponse?.CustomerType;

        const obj = {};

        for (let i = 0; i < arr?.length; i++)
            obj[`${arr[i].Name}`] = arr[i];

        // add to cache
        cache.set('clientTypes', obj);

        return obj;
    }

    static async getAccounts(keepAlive = true)
    {
        const api = await QBO.connect(keepAlive);

        const res = await api.get('/query?query=Select * from Account maxresults 1000');

        return res.data.QueryResponse.Account;
    }
}

module.exports = QBO;
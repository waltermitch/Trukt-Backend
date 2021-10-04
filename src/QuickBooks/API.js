const InvoicePaymentMethod = require('../Models/InvoicePaymentMethod');
const InvoicePaymentTerm = require('../Models/InvoicePaymentTerm');
const QBAccount = require('../Models/QBAccount');
const HTTPS = require('../AuthController');
const NodeCache = require('node-cache');
const Mongo = require('../Mongo');
const axios = require('axios');

const authConfig =
{
    headers:
    {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': process.env['quickbooks.basicAuth']
    }
};
const authUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const url = process.env['quickbooks.apiUrl'];
const tokenName = 'qb_access_token';
const refreshTokenName = 'qb_refresh_token';

// store client types (for now)
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 60 * 60 * 24 });

let qb;

class QBO
{
    static async connect()
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

                qb.connect();
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
            results.push(res.data.BatchItemResponse);
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

    static async syncListsToDB()
    {
        const proms = await Promise.all([QBO.getAccounts(), QBO.getPaymentMethods(), QBO.getPaymentTerms()]);

        const accounts = [];
        proms[0].map((e) =>
        {
            if (e?.Description?.includes('EXTERNAL'))
                accounts.push({ 'name': e.Name, 'id': e.Id });
        });

        const methods = proms[1].map((e) => { return { 'name': e.Name, 'externalId': e.Id, 'externalSource': 'QBO' }; });
        const terms = proms[2].map((e) => { return { 'name': e.Name, 'externalId': e.Id, 'externalSource': 'QBO' }; });

        await Promise.all([QBAccount.query().insert(accounts).onConflict('id').merge(), InvoicePaymentTerm.query().insert(terms).onConflict('externalId').merge(), InvoicePaymentMethod.query().insert(methods).onConflict('externalId').merge()]);
    }

    static async getItemTypes()
    {
        const api = await QBO.connect();

        const res = await api.get('/query?query=Select * from Item');

        return res.data.QueryResponse.Item;
    }

    static async getPaymentMethods()
    {
        const api = await QBO.connect();

        const res = await api.get('/query?query=Select * from PaymentMethod');

        return res.data.QueryResponse.PaymentMethod;
    }

    static async getPaymentTerms()
    {
        const api = await QBO.connect();

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

    static async getAccounts()
    {
        const api = await QBO.connect();

        const res = await api.get('/query?query=Select * from Account maxresults 1000');

        return res.data.QueryResponse.Account;
    }

    static async refreshToken()
    {
        // get refrsh token
        const refreshToken = await Mongo.getSecret(refreshTokenName);

        const payload = `grant_type=refresh_token&refresh_token=${refreshToken.value}`;

        // ask for new stuff
        const res = await axios.post(authUrl, payload, authConfig);

        // update old access tkn and refresh tokn
        const ATData =
        {
            'name': tokenName,
            'value': res.data.access_token,
            'exp': HTTPS.setExpTime(30)
        };

        const RTData =
        {
            'name': 'qb_refresh_token',
            'value': res.data.refresh_token,
            'exp': HTTPS.setExpTime(60 * 24 * 30)
        };

        await Promise.all([Mongo.updateSecret(ATData.name, ATData), Mongo.updateSecret(RTData.name, RTData)]);
    }
}

module.exports = QBO;
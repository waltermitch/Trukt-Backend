const InvoicePaymentMethod = require('../Models/InvoicePaymentMethod');
const InvoicePaymentTerm = require('../Models/InvoicePaymentTerm');
const LineItemMdl = require('../Models/InvoiceLineItem');
const OrderStop = require('../Models/OrderStop');
const HTTPS = require('../AuthController');
const NodeCache = require('node-cache');
const Invoice = require('./Invoice');
const Vendor = require('./Vendor');
const Client = require('./Client');
const Mongo = require('../Mongo');
const axios = require('axios');
const Bill = require('./Bill');

const authConfig = { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': process.env['quickbooks.basicAuth'] } };
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

    static async createBills(jobs)
    {
        const bills = [];

        for (const job of jobs)
            for (const bill of job.invoices)
            {
                bill.vendorId = bill.vendor.qbId;
                bill.orderNumber = job.number;

                for (const lineItem of bill.lines)
                {
                    const commodity = lineItem.commodity;

                    if (commodity)
                    {

                        const stops = OrderStop.firstAndLast(commodity?.stops);

                        const pTerminal = stops[0]?.terminal;
                        const dTerminal = stops[1]?.terminal;

                        lineItem.description = QBO.composeDescription(pTerminal, dTerminal, lineItem);
                    }
                    else
                        lineItem.description = lineItem.notes || '';
                }

                const payload =
                {
                    'bId': bill.guid,
                    'operation': 'create',
                    'Bill': new Invoice(bill)
                };

                bills.push(payload);
            }

        const res = await QBO.batch(bills);

        return res;
    }

    static async batchBills(array)
    {
        // this way we take in arrays and singular objects
        if (!Array.isArray(array))
            array = [array];

        const bills = [];

        for (const e of array)
        {
            const bill = new Bill(e);

            const payload =
            {
                'bId': e.guid,
                'operation': 'create',
                'Bill': bill
            };

            bills.push(payload);
        }

        const res = await QBO.batch(bills);

        return res;
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
            const res = await api.post('/customer', client);

            return { qbId: res.data.Customer.Id };
        }
        else
        {
            // update
            const SyncToken = await QBO.getSyncToken('Customer', data.qbId);

            client.SyncToken = SyncToken;
            client.Id = data.qbId;

            await api.post('/customer', client);
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

            return { qbId: res.data.Vendor.Id };
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

    static async syncListsToDB()
    {
        const proms = await Promise.all([QBO.getItemTypes(), QBO.getPaymentMethods(), QBO.getPaymentTerms()]);

        const items = proms[0];
        const methods = proms[1];
        const terms = proms[2];

        console.log(methods);
        console.log(terms);

        for (const method of methods)
            await InvoicePaymentMethod.query().insert({ name: method.Name, externalSource: 'QBO', 'externalId': method.Id }).onConflict('externalId').merge();

        for (const term of terms)
            await InvoicePaymentTerm.query().insert({ name: term.Name, externalSource: 'QBO', externalId: term.Id }).onConflict('externalId').merge();

        for (const item of items)
            await LineItemMdl.query().insert({ name: item.Name, isAccessorial: false, isDeprecated: false, externalSourceGuid: item.Id, externalSource: 'QB' }).onConflict('name').merge();
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
const InvoicePaymentMethod = require('../Models/InvoicePaymentMethod');
const QBPaymentTerm = require('../Models/QBPaymentTerm');
const QBAccount = require('../Models/QBAccount');
const HTTPS = require('../AuthController');
const DB = require('../Mongo');

const url = process.env.QUICKBOOKS_APIURL;
const tokenName = 'qb_access_token';

let qb;

class QBO
{
    static async connect(keepAlive = true)
    {
        if (!qb?.expCheck())
        {
            const opts = { url, tokenName };

            const token = await DB.getSecret(tokenName);

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

    static async syncListsToDB(keepAlive = true)
    {
        let [methods, terms] = await Promise.all([QBO.getPaymentMethods(keepAlive), QBO.getPaymentTerms(keepAlive)]);

        methods = methods.map((e) => { return { 'name': e.Name, 'externalId': e.Id, 'externalSource': 'QBO' }; });
        terms = terms.map((e) => { return { 'name': e.Name, 'id': e.Id }; });

        const trx = await QBAccount.startTransaction();

        try
        {
            await Promise.all([QBPaymentTerm.query(trx).insert(terms).onConflict('id').merge(), InvoicePaymentMethod.query(trx).insert(methods).onConflict('externalId').merge()]);
            await trx.commit();
        }
        catch (err)
        {
            await trx.rollback();
        }
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
}

module.exports = QBO;
const HTTPS = require('../AuthController');
const Invoice = require('./Invoice');
const x2j = require('xml2js');

const opts =
{
    url: 'https://lkqcorp.coupahost.com',
    headers: { 'Content-Type': 'application/xml' }
};

const api = new HTTPS(opts).connect();

class Coupa
{
    static async sendInvoice(data)
    {
        const invoice = new Invoice(data);

        const res = await api.post('/cxml/invoices', invoice);

        const parsedRes = await Coupa.parseXML(res.data);

        return { 'status': parsedRes.cXML.Response[0].Status[0].$.code, 'data': res.data };
    }

    static async parseXML(xml)
    {
        return await x2j.parseStringPromise(xml);
    }
}

module.exports = Coupa;
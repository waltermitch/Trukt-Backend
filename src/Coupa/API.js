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
    static async sendInvoices(invoices)
    {
        const res = await Promise.allSettled(invoices.map(invoice => Coupa.sendInvoice(invoice)));

        return res;
    }

    static async sendInvoice(data)
    {
        const invoice = new Invoice(data);

        const res = await api.post('/cxml/invoices', invoice);

        console.log(res.data);

        const parsedRes = await Coupa.parseXML(res.data);

        console.log(parsedRes.cXML.Response[0].Status[0].$.code);

        const response = {};
        if (parsedRes?.cXML?.Response?.[0]?.Status?.[0]?._?.includes('Unable to find order with PO Number'))
        {
            response.error = 'Invalid PO # - Update Super Order';
            response.status = 404;
        }
        else if (res.status == 200 || res.status == 417)
        {
            response.status = 200;
            response.CoupaInvoice = parsedRes?.cXML?.Response?.[0]?.Status?.[0];
            response.guid = invoice.guid;
        }
        else
        {
            response.status = 400;
            response.error = parsedRes?.cXML?.Response?.[0]?.Status?.[0];
        }

        return response;
    }

    static async parseXML(xml)
    {
        return await x2j.parseStringPromise(xml);
    }
}

module.exports = Coupa;
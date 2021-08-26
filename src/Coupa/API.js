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
    static async sendInvoices(orders)
    {
        for (const order of orders)
            for (const invoice of order.invoices)
                if (invoice?.commodity?.identifier)
                {
                    invoice.orderNumber = order.number;
                    invoice.description = order.commodities[0].description;
                    invoice.vin = order.commodities[0].identifier;

                    await Coupa.sendInvoice(invoice);
                }

    }

    static async sendInvoice(data)
    {
        console.log('Sending Coupa Invoice');

        const invoice = new Invoice(data);

        const res = await api.post('/cxml/invoices', invoice);

        console.log(res.data);

        const parsedRes = await Coupa.parseXML(res.data);

        console.log(parsedRes.cXML.Response[0].Status[0].$.code);

        return { 'status': parsedRes.cXML.Response[0].Status[0].$.code, 'data': res.data };
    }

    static async parseXML(xml)
    {
        return await x2j.parseStringPromise(xml);
    }
}

module.exports = Coupa;
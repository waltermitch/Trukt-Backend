const Coupa = require('../Coupa/API');

class CoupaService
{
    static async createInvoices(invoices)
    {
        const batch = [];
        for (const invoice of invoices)
            if (invoice.lines[0]?.commodity?.identifier && invoice.externalSourceData?.coupa?.invoice)
            {
                invoice.orderNumber = invoice.number;
                invoice.description = invoice.lines[0].commodity.description;
                invoice.vin = invoice.lines[0].commodity.identifier;

                batch.push(invoice);
            }

        const response = await Coupa.sendInvoices(batch);

        return response;
    }
}

module.exports = CoupaService;
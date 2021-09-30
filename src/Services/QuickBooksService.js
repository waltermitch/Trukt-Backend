const Invoice = require('../QuickBooks/Invoice');
const OrderStop = require('../Models/OrderStop');
const QBO = require('../QuickBooks/API');

class QuickBooksService
{
    static async createInvoices(array)
    {
        // this way we take in arrays and singular objects
        if (!Array.isArray(array))
            array = [array];

        const invoices = [];

        for (const order of array)
            for (const invoice of order.invoices)
            {
                // if no consignee use client
                const client = invoice?.cosignee || order?.client;

                invoice.clientId = client?.qbId;
                invoice.orderNumber = order.number;

                for (const lineItem of invoice.lines)
                {
                    const commodity = lineItem.commodity;

                    if (commodity)
                    {
                        const stops = OrderStop.firstAndLast(commodity?.stops);

                        const pTerminal = stops[0]?.terminal;
                        const dTerminal = stops[1]?.terminal;

                        lineItem.description = QuickBooksService.composeDescription(pTerminal, dTerminal, lineItem);
                    }
                    else
                        lineItem.description = lineItem.notes || '';
                }

                const payload =
                {
                    'bId': invoice.guid,
                    'operation': 'create',
                    'Invoice': new Invoice(invoice)
                };

                console.log(payload);

                invoices.push(payload);
            }

        console.log(invoices.length);

        const res = await QBO.batch(invoices);

        console.log(res);

        return res;
    }

    static composeDescription(pTerminal, dTerminal, lineItem)
    {
        const commodity = lineItem.commodity;

        let description = `${pTerminal.city}, ${pTerminal.state} to ${dTerminal.city}, ${dTerminal.state}\n`;

        if (lineItem?.item?.name?.localeCompare('Logistics') || lineItem.item?.name?.includes('Vehicle Shipping'))
        {
            if (commodity.description)
                description += commodity.description + '\n';
            if (commodity.identifier)
                description += `VIN: ${commodity.identifier}`;
        }

        return description;
    }
}

module.exports = QuickBooksService;
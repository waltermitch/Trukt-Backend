const QuickBooksService = require('./QuickBooksService');
const Invoice = require('../Models/InvoiceBill');
const Order = require('../Models/Order');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await Invoice.query()
            .findOne({ 'guid': guid, 'isDeleted': false })
            .withGraphFetched(Invoice.fetch.details);

        return res;
    }

    static async getOrderInvoice(guid)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined({
                invoices: Invoice.fetch.details,
                jobs: { bills: Invoice.fetch.details }
            });

        // order was not found, return undefined
        if (res == undefined)
        {
            return undefined;
        }

        // assigning orderId and Number to order invoice
        Object.assign(res.invoices[0], {
            order: {
                guid: res.guid,
                number: res.number
            }
        });

        // object to return array of bills and invoices
        const invoiceObject = {
            invoices: res.invoices,

            // flatten all the bills and assign job guid and number to each bill
            bills: res.jobs.reduce((bills, job) =>
            {
                const jobObject = {
                    guid: job.guid,
                    number: job.number
                };
                bills.push(...job.bills.map((bill) =>
                {
                    bill.job = jobObject;
                    return bill;
                }));
                return bills;
            }, [])
        };

        return invoiceObject;
    }

    static async createInvoices(arr)
    {
        // query to get all the orders with related objects
        const qb = Order.query().withGraphFetched('[invoices.[consignee, lines.[commodity.[stops.[terminal]], item.qbAccount]], client]');

        // append all the order guids
        for (const guid of arr)
            qb.orWhere('guid', '=', guid);

        // get all the orders
        const orders = await qb;

        // decide which system they will be invoiced in
        const QBInvoices = [];
        const CoupaInvoices = [];
        for (const order of orders)
        {
            // add logic to determine type of invoice to make
            if (['LKQ Corporation', 'LKQ Self Service']?.includes(order?.client?.name))
                CoupaInvoices.push(order);
            else
                QBInvoices.push(order);

            const res = await QuickBooksService.createInvoices(QBInvoices);

            // submit coupa PO's don't await
            // temporary commenting out
            // Coupa.sendInvoices(CoupaInvoices);

            return res;
        }
    }

    static async searchInvoices(orderGuid)
    {
        const search = orderGuid.replace(/%/g, '');

        const res = await Invoice.query().where('order_guid', '=', search).withGraphJoined('lines');

        return res;
    }
}

module.exports = InvoiceService;
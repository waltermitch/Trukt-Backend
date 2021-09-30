const Invoice = require('../QuickBooks/Invoice');
const OrderStop = require('../Models/OrderStop');
const Client = require('../QuickBooks/Client');
const Vendor = require('../QuickBooks/Vendor');
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

                invoices.push(payload);
            }

        const res = await QBO.batch(invoices);

        return res;
    }

    static async createBills(jobs)
    {
        const bills = [];

        for (const job of jobs)
            for (const bill of job.bills)
            {
                if (!bill.vendor)
                    throw { 'data': 'No Vendor Assigned To Job' };

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

                        lineItem.description = QuickBooksService.composeDescription(pTerminal, dTerminal, lineItem);
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

    static async upsertClient(data)
    {
        const client = new Client(data);

        // get client types
        const clientTypes = await QBO.getClientTypes();

        // set client type
        client.setBusinessType(data.businessType, clientTypes);

        if (!data.qbId)
        {
            // if duplicates, just update existing record :)
            try
            {
                const res = await QBO.upsertClient(client);

                return { qbId: res.data.Customer.Id };
            }
            catch (e)
            {
                // 6240 is QB error code for duplicates
                if (e.response.data?.Fault?.Error[0].code == 6240)
                {
                    // find client by name
                    const res = await QBO.getClientByName(client.DisplayName);

                    return { qbId: res[0].Id };
                }
                else
                    throw e;
            }

        }
        else
        {
            // update
            const SyncToken = await QBO.getSyncToken('Customer', data.qbId);

            client.SyncToken = SyncToken;
            client.Id = data.qbId;

            await QBO.upsertClient(client);
        }
    }

    static async upsertVendor(data)
    {
        const vendor = new Vendor(data);

        if (!data.qbId)
        {
            // if duplicates, just update existing record :)
            try
            {
                const res = await QBO.upsertVendor(vendor);

                return { qbId: res.data.Vendor.Id };
            }
            catch (e)
            {
                // 6240 is QB error code for duplicates
                if (e.response.data?.Fault?.Error[0].code == 6240)
                {
                    // find vendor by name
                    const res = await QBO.getVendorByName(vendor.DisplayName);

                    // compare DOT numbers

                    return { qbId: res[0].Id };
                }
                else
                    throw e;
            }

        }
        else
        {
            // update
            const SyncToken = await QBO.getSyncToken('Vendor', data.qbId);

            vendor.SyncToken = SyncToken;
            vendor.Id = data.qbId;

            await QBO.upsertVendor(vendor);
        }
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
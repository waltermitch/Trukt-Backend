const Invoice = require('../QuickBooks/Invoice');
const OrderStop = require('../Models/OrderStop');
const Client = require('../QuickBooks/Client');
const Vendor = require('../QuickBooks/Vendor');
const Bill = require('../QuickBooks/Bill');
const QBO = require('../QuickBooks/API');

class QuickBooksService
{
    static async createInvoices(invoices = [])
    {
        // array of results
        const results = [];

        // array to send batch
        const batch = [];
        for (const invoice of invoices)
        {
            // if no consignee use client
            const client = invoice?.consignee || invoice?.client;

            // check if invoice already invoiced
            if (invoice?.externalSourceData?.quickbooks?.invoice)
            {
                results.push({
                    error: `Invoice ${invoice.guid} already invoiced`,
                    system: 'QuickBooks',
                    guid: invoice.guid,
                    externalSourceData: invoice.externalSourceData
                });

                continue;
            }
            else if (invoice?.lines?.length == 0)
            {
                results.push({
                    error: `Invoice ${invoice.guid} has no lines`,
                    system: 'QuickBooks',
                    guid: invoice.guid
                });

                continue;
            }
            else if (!client?.qbId)
            {
                results.push({
                    error: `Invoice ${invoice.guid} client/consignee missing QB ID`,
                    system: 'QuickBooks',
                    guid: invoice.guid
                });

                continue;
            }

            invoice.clientId = client?.qbId;

            // for each line item map out description, and commodity details
            for (const lineItem of invoice.lines)
            {
                if (!lineItem.isPaid)
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
            }

            const payload =
            {
                'bId': invoice.guid,
                'operation': 'create',
                'Invoice': new Invoice(invoice)
            };

            batch.push(payload);
        }

        const res = await QBO.batch(batch);

        results.push(...res);

        return results;
    }

    static async createBills(bills)
    {
        // array of results
        const results = [];

        // array to send batch
        const batch = [];

        for (const bill of bills)
        {
            if (bill?.externalSourceData?.quickbooks?.bill)
            {
                results.push({
                    error: `Bill ${bill.guid} already billed`,
                    system: 'QuickBooks',
                    guid: bill.guid,
                    externalSourceData: bill.externalSourceData
                });

                continue;
            }
            else if (!bill?.vendor?.qbId)
            {
                results.push({
                    error: `Bill ${bill.guid} has no vendor or vendor doesn't have qbId`,
                    system: 'QuickBooks',
                    guid: bill.guid
                });

                continue;
            }
            else if (bill?.lines?.length == 0)
            {
                results.push({
                    error: `Bill ${bill.guid} has no lines`,
                    system: 'QuickBooks',
                    guid: bill.guid
                });

                continue;
            }

            bill.vendorId = bill.vendor.qbId;
            bill.orderNumber = bill.jobNumber;

            for (const lineItem of bill.lines)
            {
                if (!lineItem.isPaid)
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
            }

            const payload =
            {
                'bId': bill.guid,
                'operation': 'create',
                'Bill': new Bill(bill)
            };

            batch.push(payload);
        }

        const res = await QBO.batch(batch);

        results.push(...res);

        return results;
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

                return { qbId: res.Customer.Id };
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

                return { qbId: res.Vendor.Id };
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
            if (commodity.vehicle?.name)
                description += commodity.vehicle.name + '\n';
            if (commodity.identifier)
                description += `VIN: ${commodity.identifier}`;
        }

        return description;
    }
}

module.exports = QuickBooksService;
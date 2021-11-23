const Line = require('../Models/InvoiceLine');
const Invoice = require('../Models/Invoice');
const Order = require('../Models/Order');
const Bill = require('../Models/Bill');

class ExpenseService
{
    static async update(guid, data, user)
    {
        const payload =
        {
            notes: data.notes,
            amount: data.amount,
            itemId: data.itemId,
            isPaid: data?.isPaid,
            commodityGuid: data.commodityGuid,
            updatedByGuid: user,
            dateCharged: data.dateCharged,
            transactionNumber: data.transactionNumber
        };

        const res = await Line.query().patch(payload).findOne({ 'guid': guid }).returning('*');

        return res;
    }

    static async create(arr, user)
    {
        const results = [];

        // start transaction
        const trx = await Line.startTransaction();

        try
        {
            for (const data of arr)
            {
                // compose payload
                const payload =
                {
                    notes: data.notes,
                    amount: data.amount,
                    itemId: data.itemId,
                    isPaid: data?.isPaid,
                    commodityGuid: data.commodityGuid || undefined,
                    createdByGuid: user,
                    dateCharged: data.dateCharged,
                    transactionNumber: data.transactionNumber
                };

                let res;

                // check if there is a reimbursement
                // removing reimbursement for now - not MVP
                // if (data.reimbursement && data.orderGuid && data.jobGuid)
                // {
                //     // find an invoice and a bill
                //     const proms = await Promise.all(
                //         [Bill.query().findOne({ 'job_guid': data.jobGuid }), Invoice.query().findOne({ 'order_guid': data.orderGuid })]);

                //     // compose 2 payloads
                //     const bill = Object.assign({ invoiceGuid: proms[0].billGuid }, payload);
                //     const invoice = Object.assign({ invoiceGuid: proms[1].invoiceGuid }, payload);

                //     // set invoice amount to reimbursement amount
                //     invoice.amount = data.reimbursement;

                //     // create 2 lines
                //     res = await Promise.all([Line.query().insert(bill), Line.query().insert(invoice)]);
                // }

                // create line for either job or order
                if (data.jobGuid)
                {
                    const bill = await Bill.query().findOne({ 'job_guid': data.jobGuid });

                    if (!bill)
                        throw { status: 400, data: `No bill found for Job: ${data.jobGuid}` };

                    payload.invoiceGuid = bill.billGuid;

                    res = await Line.query().insert(payload);
                }
                else if (data.orderGuid)
                {
                    const invoice = await Invoice.query().findOne({ 'order_guid': data.orderGuid });

                    if (!invoice)
                        throw { status: 400, data: `No invoice found for Order: ${data.orderGuid}` };

                    payload.invoiceGuid = invoice.invoiceGuid;

                    res = await Line.query().insert(payload);
                }
                else
                {
                    // throw error
                    throw { 'status': 400, 'data': 'Job or Order Guid Required' };
                }

                results.push(res);
            }

            // commit transaction
            await trx.commit();

            return results;
        }
        catch (err)
        {
            // undo transaction
            await trx.rollback();

            // throw error
            throw err;
        }
    }

    // mark expense as deleted
    static async delete(guid, currentUser)
    {
        // clean
        guid = guid.replace(/%/g, '');

        const payload =
        {
            deletedByGuid: currentUser,
            isDeleted: true
        };

        // update
        await Line.query().patch(payload).findById(guid);

        return;
    }

    static async find(guid)
    {
        // clean
        guid = guid.replace(/%/g, '');

        const res = await Line.query()
            .findOne({ 'invoice_bill_lines.guid': guid, 'invoice_bill_lines.isDeleted': false })
            .withGraphJoined('invoiceBill.[order.client,job.vendor]').withGraphJoined('item');

        if (res.invoiceBill.job)
        {
            res.jobNumber = res.invoiceBill.job.number;
            res.vendor = res.invoiceBill.job.vendor.name;
        }
        else
        {
            res.orderNumber = res.invoiceBill.order.number;
            res.client = res.invoiceBill.order.client.name;
        }

        // remove invoiceBill
        delete res.invoiceBill;

        return res;
    }

    // search by order guid
    static async search(orderGuid)
    {
        if (!orderGuid)
            throw { 'status': 400, 'data': 'Order Guid Required' };

        // clean
        orderGuid = orderGuid.replace(/%/g, '');

        // get order with jobs and invoices and bills and lines
        const order = await Order.query().skipUndefined().findById(orderGuid)
            .withGraphJoined('jobs.[bills.lines.item, vendor]').withGraphJoined('[invoices.[lines.item], client]');

        // get all lines
        let expenses = [];

        // map lines
        for (const invoice of order.invoices)
            expenses = expenses.concat(invoice.lines.map((e) =>
            {
                e.orderNumber = order.number;
                e.client = order.client.name;
                return e;
            }));

        // map lines
        for (const job of order.jobs)
            for (const bill of job.bills)
                expenses = expenses.concat(bill.lines.map((e) =>
                {
                    e.jobNumber = job.number;
                    e.vendor = job.vendor?.name;
                    return e;
                }));

        return expenses;
    }
}

module.exports = ExpenseService;
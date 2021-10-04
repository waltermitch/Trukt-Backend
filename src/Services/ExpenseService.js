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
            commodityGuid: data.commodityGuid,
            updatedByGuid: user
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
                    commodityGuid: data.commodityGuid || undefined,
                    createdByGuid: user
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

                    payload.invoiceGuid = bill.billGuid;

                    res = await Line.query().insert(payload);
                }
                else if (data.orderGuid)
                {
                    const invoice = await Invoice.query().findOne({ 'order_guid': data.orderGuid });

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

        const res = await Line.query().findOne({ 'guid': guid, 'isDeleted': false }).withGraphJoined('item');

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
            .withGraphJoined('jobs.bills.lines.item').withGraphJoined('invoices.lines.item');

        // get all lines
        let expenses = [];

        // map lines
        for (const invoice of order.invoices)
            expenses = expenses.concat(invoice.lines);

        // map lines
        for (const job of order.jobs)
            for (const bill of job.bills)
                expenses = expenses.concat(bill.lines);

        return expenses;
    }
}

module.exports = ExpenseService;
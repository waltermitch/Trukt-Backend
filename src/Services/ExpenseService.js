const Line = require('../Models/InvoiceLine');
const Invoice = require('../Models/Invoice');
const Bill = require('../Models/Bill');

class ExpenseService
{
    static async update(guid, data)
    {
        const res = await Line.query().patch(data);

        return res;
    }

    static async create(data, user)
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
        if (data.reimbursement && data.orderGuid && data.jobGuid)
        {
            // find an invoice and a bill
            const proms = await Promise.all(
                [Bill.query().findOne({ 'job_guid': data.jobGuid }), Invoice.query().findOne({ 'order_guid': data.orderGuid })]);

            // comose 2 payloads
            const bill = Object.assign({ invoiceGuid: proms[0].billGuid }, payload);
            const invoice = Object.assign({ invoiceGuid: proms[1].invoiceGuid }, payload);

            // set invoice amount to reimbursement amount
            invoice.amount = data.reimbursement;

            // create 2 lines
            res = await Promise.all([Line.query().insert(bill), Line.query().insert(invoice)]);
        }
        else if (data.jobGuid)
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
            throw { 'status': 400, 'data': 'Job or Order Guid Required' };
        }

        return res;
    }

    static async find(guid)
    {
        // clean
        guid = guid.replace(/%/g, '');

        const res = await Line.query().findOne({ 'guid': guid });

        return res;
    }
}

module.exports = ExpenseService;
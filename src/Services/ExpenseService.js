const Line = require('../Models/InvoiceLine');

class ExpenseService
{
    static async update(guid, data)
    {
        const res = await Line.query().patch(data);

        return res;
    }

    static async create(data)
    {
        // find related invoice/bill
        const res = await Line.query().insert(data);

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
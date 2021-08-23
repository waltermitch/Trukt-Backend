const ExpenseService = require('../Services/ExpenseService');

class ExpenseController
{
    static async get(req, res)
    {
        const result = await ExpenseService.find(req.params.expenseId);

        if (result)
        {
            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(404);
            res.json({ 'error': 'No Matches Found' });
        }
    }

    static async post(req, res)
    {
        const result = await ExpenseService.create(req.body);

        if (result)
        {
            res.status(200);
            res.json(result);
        }
    }

    static async patch(req, res)
    {
        const guid = req?.body?.guid || req?.params?.expenseId;

        if (!guid)
            throw { 'status': 400, 'data': 'Missing Guid' };

        const result = await ExpenseService.update(req.body);

        if (result)
        {
            res.status(200);
            res.json(result);
        }
    }
}

module.exports = ExpenseController;
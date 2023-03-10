const { MissingDataError } = require('../ErrorHandling/Exceptions');
const ExpenseService = require('../Services/ExpenseService');

class ExpenseController
{
    static async get(req, res)
    {
        const result = await ExpenseService.find(req.params.expenseId);

        if (!result)
        {
            res.status(404);
            res.json({ 'error': 'No Matches Found' });

        }
        else if (result.isDeleted)
        {
            res.status(404);
            res.json({ 'error': 'Expense Deleted' });
        }
        else
        {
            res.status(200);
            res.json(result);
        }
    }

    static async post(req, res)
    {
        const result = await ExpenseService.create(req.body, req.session.userGuid);

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
            throw new MissingDataError('Missing Guid');

        const result = await ExpenseService.update(guid, req.body, req.session.userGuid);

        if (result)
            res.status(200).json(result);

    }

    static async delete(req, res)
    {
        const guid = req?.body?.guid || req?.params?.expenseId;

        if (!guid)
            throw new MissingDataError('Missing Guid');

        await ExpenseService.delete(guid, req.session.userGuid);

        res.status(204).send();
    }

    static async search(req, res)
    {
        const result = await ExpenseService.search(req.query.order);

        res.status(200);
        res.json(result);
    }
}

module.exports = ExpenseController;
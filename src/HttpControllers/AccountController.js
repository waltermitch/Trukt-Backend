const AccountService = require('../Services/AccountService');

class AccountController
{
    static async getAccount(req, res)
    {
        const result = await AccountService.getById(req.params.accountType, req.params.accountId);

        if (result.length > 0)
        {
            res.status(200);
            res.json(result[0]);
        }
        else
        {
            res.status(404);
            res.send();
        }
    }

    static async searchAccount(req, res)
    {
        if (req.query?.search)
        {
            const result = await AccountService.searchByType(req.params.accountType, req.query);
            res.status(200);
            res.send(result);
        }
        else
        {
            res.status(400);
            res.json({ message: 'missing search query field' });
        }
    }
}

module.exports = AccountController;
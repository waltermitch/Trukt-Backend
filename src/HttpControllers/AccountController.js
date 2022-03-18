const AccountService = require('../Services/AccountService');

class AccountController
{
    static async getAccount(req, res, next)
    {
        try
        {
            const result = await AccountService.getById(req.params.accountType, req.params.accountId);
            res.status(200);
            res.json(result);

        }
        catch (error)
        {
            next(error);
        }
    }

    static async searchAccount(req, res, next)
    {
        try
        {
            const result = await AccountService.searchByType(req.params.accountType, req.query);
            res.status(200);
            res.send(result);
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = AccountController;
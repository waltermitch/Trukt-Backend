const { NotFoundError, MissingDataError } = require('../ErrorHandling/Exceptions');
const AccountService = require('../Services/AccountService');

class AccountController
{
    static async getAccount(req, res, next)
    {
        try
        {
            const result = await AccountService.getById(req.params.accountType, req.params.accountId);
    
            if (result.length > 0)
            {
                res.status(200);
                res.json(result[0]);
            }
            else
                throw new NotFoundError();
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
            if (req.query?.search)
            {
                const result = await AccountService.searchByType(req.params.accountType, req.query);
                res.status(200);
                res.send(result);
            }
            else
                throw new MissingDataError('missing search query field');
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = AccountController;
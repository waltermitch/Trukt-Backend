const HttpRouteController = require('./HttpRouteController');
const AccountService = require('../Services/AccountService');
const { uuidRegex } = require('../Utils/Regexes');

class AccountController extends HttpRouteController
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

    /**
     * TODO: deprecated
     */
    async handleGet(context, req)
    {
        const res = {};
        if (!('accountId' in req.params) && this.searchQueryCriteria(req.query))
        {
            res.body = await AccountService.searchByType(req.params.accountType, req.query);
        }
        else if (('accountId' in req.params) && uuidRegex.test(req.params.accountId))
        {
            const result = await AccountService.getById(req.params.accountType, req.params.accountId);
            if (result.length > 0)
            {
                res.status = 200;
                res.body = result[0];
            }
            else
            {
                res.status = 404;
            }
        }
        else
        {
            res.status = 400;
        }
        return res;
    }

    searchQueryCriteria(query)
    {
        const clone = Object.assign({}, query);
        delete clone.pg;
        delete clone.rc;
        return Object.keys(clone).length > 0;
    }
}

const controller = new AccountController();

module.exports = controller;
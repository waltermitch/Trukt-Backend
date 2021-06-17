const HttpRouteController = require('./HttpRouteController');
const AccountService = require('../Services/AccountService');

class SearchAccountsController extends HttpRouteController
{
    async handleGet(context, req)
    {
        return await AccountService.searchByType(req.params.type, req.params.query);
    }
}

const controller = new SearchAccountsController();

module.exports = controller;
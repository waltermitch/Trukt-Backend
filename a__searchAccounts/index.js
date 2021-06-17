const Account = require('../Classes/Account');
const App = require('../Classes/HttpControllers/HttpRouteController');

module.exports = async (context, req) => await App.next(context, getAccount, req);

async function getAccount(context, req)
{
    return await Account.searchAccountByType(req.params.type, req.params.query);
}
const Account = require('../Classes/Account');

module.exports = async (context, req) => await App.next(context, getAccount, req);

async function getAccount(context, req)
{
    return await Account.searchAccountByType(req.params.type, req.params.query);
}
const Account = require('../Classes/Account');

module.exports = async (context, req) => await App.next(context, getAccount, req);

async function getAccount(context, req)
{
    return await Account.getAccountByType(req.params.type, req.params.query);
}
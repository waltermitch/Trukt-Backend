const PG = require('../Classes/PostGres');

module.exports = async (context, req) => await App.next(context, getAccount, req);

async function getAccount(context, req)
{
    return await PG.getAccountByType(req.params.type, req.params.query);
}
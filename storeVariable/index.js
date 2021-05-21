const PG = require('../Classes/PostGres');

module.exports = async (context, req) => await App.next(context, storeVar, req);

async function storeVar(context, req)
{
    if (!req?.body.name)
        return { 'status': 400, 'data': 'Variable Must Have Name' };

    await PG.upsertVariable(req.body);

    return { 'status': 200 };
}
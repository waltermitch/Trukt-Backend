const PG = require('../Classes/PostGres');

module.exports = async (context, req) => App.next(context, getVar, req);

async function getVar(context, req)
{
    return await PG.getVariable(req?.params?.name);
}
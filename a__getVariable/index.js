const PG = require('../Classes/PostGres');
const App = require('../Classes/HttpControllers/HttpRouteController');

module.exports = async (context, req) => App.next(context, getVar, req);

async function getVar(context, req)
{
    return await PG.getVariable(req?.params?.name);
}
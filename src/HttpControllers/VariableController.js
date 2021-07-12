const HttpRouteController = require('./HttpRouteController');

class VariableController extends HttpRouteController
{
    async handleGet(context, req)
    {
        context.log(req?.body);
    }

    async handlePost(context, req)
    {
        context.log(req?.body);
    }
}

const controller = new VariableController();

module.exports = controller;
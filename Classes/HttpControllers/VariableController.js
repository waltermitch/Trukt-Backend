const HttpRouteController = require('./HttpRouteController');

class VariableController extends HttpRouteController
{
    async handleGet(context, req)
    {

    }

    async handlePost(context, req)
    {

    }
}

const controller = new VariableController();

module.exports = controller;
const HttpRouteController = require('./HttpRouteController')
const PubSub = require('../Azure/PubSub');

class PubSubController extends HttpRouteController
{
    async handleGet(context, req)
    {
        return await PubSub.getSubToken(req.query.groupName, req.query.user);
    }
}

const controller = new PubSubController();

module.exports = controller;
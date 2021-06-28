const HttpRouteController = require('./HttpRouteController')
const PubSub = require('../Azure/PubSub');

class PubSubController extends HttpRouteController
{
    async handleGet(context, req)
    {
        if (!('groupName' in req.query) || !('user' in req.query))
            return { 'status': 400, 'error': 'Missing groupName Or user' }

        return await PubSub.getSubToken(req.query.groupName, req.query.user);
    }
}

const controller = new PubSubController();

module.exports = controller;
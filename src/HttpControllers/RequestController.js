const { query } = require('../Mongo');
const HttpRouteController = require('./HttpRouteController');

class RequestController extends HttpRouteController
{
    async handleGet(contextm, req)
    {
        if (!req?.body?.requestGUID)
        {
            return { 'status': 400, 'data': 'Missing ID' };
        }
        return { body: await RequestService.searchByID(req?.query?.requestGUID) };
    }

    async handlePost(context, req)
    {
        if (!req?.body?.jobGUID)
        {
            return { 'status': 400, 'data': 'Missing ID' };
        }
        return { body: await RequestService.searchByJobGUD(req?.body?.requestGUID) };
    }
}

const controller = new RequestController();

module.exports = controller;
const HttpRouteController = require('./HttpRouteController');
const AttachmentService = require('../Services/AttachmentService');

class AttachmentController extends HttpRouteController
{
    async handleGet(context, req)
    {
        if (!req.query?.parent || !req.query?.parentType)
            return { 'status': 400, 'data': 'Missing Query Params' };

        context.res.body = await AttachmentService.searchByParent(req.query.parent, req.query.parentType, req.query?.attachmentType);
    }

    async handlePost(context, req)
    {
        if (!req.query?.parent || !req.query?.parentType || !req?.query?.attachmentType)
            return { 'status': 400, 'data': 'Missing Query Params' };

        context.res.body = await AttachmentService.insert(req.body, req.headers, req.query);
    }
}

const controller = new AttachmentController();
module.exports = controller;
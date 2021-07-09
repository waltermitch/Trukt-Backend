const AttachmentService = require('../Services/AttachmentService');
const HttpRouteController = require('./HttpRouteController');

class AttachmentController extends HttpRouteController
{
    static async search(req, res)
    {
        // TODO: this requires some middleware configuration to work properly
        res.status(501);
        res.json();

        // if (!req.query?.parent || !req.query?.parentType)
        // {
        //     res.status(400);
        //     res.send('missing query params');
        // }
        // else
        // {
        //     const result = await AttachmentService.searchByParent(req.query.parent, req.query.parentType, req.query?.attachmentType);
        //     res.status(200);
        //     res.json(result);
        // }
    }

    static async store(req, res)
    {
        // TODO: this requires some middleware configuration to work properly
        res.status(501);
        res.json();

        // if (!req.query?.parent || !req.query?.parentType || !req?.query?.attachmentType)
        // {
        //     res.status(400);
        //     res.send('missing query params');
        //     return;
        // }
        // console.log(req.body);

        // if (!req.body)
        // {
        //     res.status(400);
        //     res.send('missing attachment in body');
        //     return;
        // }

        // const result = await AttachmentService.insert(req.body, req.headers, req.query);
        // res.status(200);
        // res.json(result);

    }

    // TODO: deprecated
    async handleGet(context, req)
    {
        if (!req.query?.parent || !req.query?.parentType)
            return { 'status': 400, 'data': 'Missing Query Params' };

        return { body: await AttachmentService.searchByParent(req.query.parent, req.query.parentType, req.query?.attachmentType) };
    }

    // TODO: deprecated
    async handlePost(context, req)
    {
        if (!req.query?.parent || !req.query?.parentType || !req?.query?.attachmentType)
            return { 'status': 400, 'data': 'Missing Query Params' };

        return { body: await AttachmentService.insert(req.body, req.headers, req.query) };
    }
}

const controller = new AttachmentController();
module.exports = controller;
const AttachmentService = require('../Services/AttachmentService');
const HttpRouteController = require('./HttpRouteController');

class AttachmentController extends HttpRouteController
{
    static async search(req, res)
    {
        if (!req.query?.parent || !req.query?.parentType)
        {
            res.status(400);
            res.send({ 'error': 'Missing parent and/or parentType' });
        }
        else
        {
            const result = await AttachmentService.searchByParent(req.query.parent, req.query.parentType, req.query?.attachmentType);

            res.status(200);
            res.json(result);
        }
    }

    static async store(req, res)
    {
        if (!req.query?.parent || !req.query?.parentType || !req?.query?.attachmentType)
        {
            res.status(400);
            res.json({ 'error': 'Missing parent and/or parentType and/or attachmentType' });
            return;
        }
        else if (!req.files)
        {
            res.status(400);
            res.json({ 'error': 'Missing Attachment(s) In Body' });
            return;
        }
        else
        {
            const result = await AttachmentService.insert(req.files, req.headers, req.query);
            res.status(200);
            res.json(result);
        }
    }
}

const controller = new AttachmentController();
module.exports = controller;
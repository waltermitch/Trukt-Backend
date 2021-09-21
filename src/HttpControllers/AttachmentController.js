const AttachmentService = require('../Services/AttachmentService');

class AttachmentController
{
    static async get(req, res)
    {
        const result = await AttachmentService.get(req.params.attachmentId);

        if (result)
            res.status(200).json(result);
        else
            res.status(404).send({ 'error': 'Attachment Not Found' });
    }

    static async search(req, res)
    {
        if (!req.query?.parent || !req.query?.parentType)
        {
            res.status(400);
            res.send({ 'error': 'Missing Query Params' });
        }
        else
        {
            const result = await AttachmentService.searchByParent(req.query);

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
            const result = await AttachmentService.insert(req.files, req.query);
            res.status(201);
            res.json(result);
        }
    }

    static async update(req, res)
    {
        if (!req.body)
        {
            res.status(400);
            res.send({ 'error': 'Missing Body' });
        }
        else
        {
            const result = await AttachmentService.update(req.params.attachmentId, req.body);

            res.status(200);
            res.json(result);
        }
    }

    static async delete(req, res)
    {
        await AttachmentService.delete(req.params.attachmentId);

        res.status(204).send();
    }
}

module.exports = AttachmentController;
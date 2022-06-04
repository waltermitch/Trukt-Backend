const { ValidationError, NotFoundError } = require('../ErrorHandling/Exceptions');
const AttachmentService = require('../Services/AttachmentService');

class AttachmentController
{
    static async get(req, res, next)
    {
        try
        {
            const result = await AttachmentService.get(req.params.attachmentId);

            if (!result)
                throw new NotFoundError('Attachment Not Found');
            else if (result.isDeleted)
                throw new NotFoundError('Attachment Deleted');
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async search(req, res, next)
    {
        try
        {
            if (!req.query?.parent || !req.query?.parentType)
                throw new ValidationError('Missing Query Params');
            else
            {
                const result = await AttachmentService.searchByParent(req.query);

                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async store(req, res, next)
    {
        try
        {
            // based on content-type we can know if it's a file or url
            if (req.headers['content-type'] === 'application/json')
            {
                const result = await AttachmentService.attachExistingFiles(req.query, req.body, req.session?.userGuid);

                res.status(200);
                res.json(result);
            }
            else
            {
                if (!req.query?.parent || !req.query?.parentType)
                    throw new ValidationError('Missing parent and/or parentType');
                else if (!req.files)
                    throw new ValidationError('Missing Attachment(s) In Body');
                else
                {
                    const result = await AttachmentService.insert(req.files, req.query, req.session?.userGuid);
                    res.status(201);
                    res.json(result);
                }
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async update(req, res, next)
    {
        try
        {
            if (!req.body)
                throw new ValidationError('Missing Body');
            else
            {
                const result = await AttachmentService.update(req.params.attachmentId, req.body, req.session?.userGuid);

                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async delete(req, res, next)
    {
        try
        {
            await AttachmentService.delete(req.params.attachmentId, req.session?.userGuid);

            res.status(204).send();
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = AttachmentController;
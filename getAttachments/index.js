const Attachments = require('../Classes/Attachments');

module.exports = async (context, req) => await App.next(context, addAttachment, req);

async function addAttachment(context, req)
{
    if (!req.query?.parent || !req.query?.parentType)
        return { 'status': 400, 'data': 'Missing Query Params' };

    return await Attachments.get(req.query.parent, req.query.parentType, req.query?.attachmentType);
}
const Attachments = require('../Classes/Attachments');

module.exports = async (context, req) => await App.next(context, addAttachment, req);

async function addAttachment(context, req)
{
    if (!req.query?.parentGUID || !req.query?.parentType)
        return { 'status': 400, 'data': 'Specify Parent GUID and Type' };

    return await Attachments.store(req, req.query);
}
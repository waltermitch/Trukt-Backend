const Attachment = require('../Models/Attachment');
const AzureStorage = require('../Azure/Storage');
const { DateTime } = require('luxon');
const uuid = require('uuid');

const baseURL = AzureStorage.getBaseUrl();

class AttachmentService
{

    static async get(guid)
    {
        const attachment = await Attachment.query().findById(guid);

        if (!attachment)
            return null;

        // get sas
        const sas = AzureStorage.getSAS();

        // append security key
        attachment.url += sas;

        // convert visbililty to array
        attachment.visibility = AttachmentService.convertArray(attachment.visibility);

        return attachment;
    }

    static async searchByParent({ parent, parentType, attachmentType, visibility })
    {
        const builder = Attachment.query()
            .where('parent', '=', `${parent}`)
            .where('parent_table', '=', `${parentType}`)
            .where('is_deleted', '=', false);

        if (attachmentType)
            builder.where('type', '=', attachmentType);

        if (visibility)
            builder.where('visibility', '@>', visibility);

        const attachments = await builder;

        // get sas
        const sas = AzureStorage.getSAS();

        // append security key
        for (const atch of attachments)
        {
            atch.visibility = AttachmentService.convertArray(atch.visibility);
            atch.url += sas;
        }

        return attachments;
    }

    static async insert(files, opts, currentUser)
    {
        if (['job'].includes(opts.parentType))
            return { 'status': 400, 'data': 'Not An Allowed parentType' };

        // get sas
        const sas = AzureStorage.getSAS();

        // array of urls and respective files
        const urls = [];

        // compose path
        const path = `${opts.parentType}/${opts.parent}`;

        for (let i = 0; i < files.length; i++)
        {
            const guid = uuid.v4();

            const file =
            {
                'guid': guid,
                'type': opts.attachmentType,
                'url': `${baseURL}/${path}/${guid}/${files[i].originalname}`,
                'extension': files[i].mimetype,
                'name': files[i].originalname,
                'parent': opts.parent,
                'parent_table': opts.parentType,
                'visibility': opts.visibility,
                'createdByGuid': currentUser
            };

            // compose full path of file
            const fullPath = `${path}/${guid}/${file.name}`;

            const res = await Promise.all([AzureStorage.storeBlob(fullPath, files[i].buffer), Attachment.query().insert(file)]);

            urls.push({ 'url': res[1].url + sas, 'name': res[1].name, 'guid': res[1].guid, 'extension': res[1].extension, 'type': res[1].type, 'visibility': res[1].visibility || ['internal'], 'createdByGuid': res[1].createdByGuid, 'dateCreated': DateTime.utc().toString() });
        }

        return urls;
    }

    static async update(guid, data, currentUser)
    {
        const payload =
        {
            type: data?.type,
            visibility: Array.isArray(data?.visibility) ? data?.visibility : data?.visibility?.split(','),
            updatedByGuid: currentUser
        };

        const res = await Attachment.query().patchAndFetchById(guid, payload);

        // convert visibility to array
        res.visibility = AttachmentService.convertArray(res.visibility);

        return res;
    }

    static async delete(guid, currentUser)
    {
        const payload =
        {
            deletedByGuid: currentUser,
            is_deleted: true
        };

        const res = await Attachment.query().patchAndFetchById(guid, payload);

        return res;
    }

    // converts PostGres String array to JS array
    static convertArray(string)
    {
        string = string.replace(/{|}/g, '');

        return string.split(',');
    }
}

module.exports = AttachmentService;
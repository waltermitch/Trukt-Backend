const Attachment = require('../Models/Attachment');
const AzureStorage = require('../Azure/Storage');
const multipart = require('parse-multipart');
const uuid = require('uuid');

const baseURL = AzureStorage.getBaseUrl();

class AttachmentService
{
    static async searchByParent(parent, parentType, attachmentType)
    {
        const attachments = await Attachment.query().where('parent', '=', `${parent}`).where('parent_table', '=', `${parentType}`).where(builder =>
        {
            if (attachmentType)
                builder.where('type', '=', `${attachmentType}`);
        });

        // get sas
        const sas = AzureStorage.getSAS();

        // append security key
        for (const atchs of attachments)
            atchs.url += sas;

        return attachments;
    }

    static async insert(body, headers, opts)
    {
        if (['job'].includes(opts.parentType))
            return { 'status': 400, 'data': 'Not An Allowed parentType' };

        // parse form data into buffer
        const files = AttachmentService.parse(body, headers);

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
                'url': `${baseURL}/${path}/${guid}/${files[i].filename}`,
                'extension': files[i].type,
                'name': files[i].filename,
                'parent': opts.parent,
                'parent_table': opts.parentType
            };

            // compose full path of file
            const fullPath = `${path}/${guid}/${file.name}`;

            await Promise.all([AzureStorage.storeBlob(fullPath, files[i].data), Attachment.query().insert(file)]);

            urls.push({ 'url': file.url + sas, 'name': file.name, 'guid': guid });
        }

        return urls;
    }

    static parse(body, headers)
    {
        // get boundary from headers
        const boundary = multipart.getBoundary(headers['content-type']);

        // convert to buffer
        const parsedBody = Buffer.from(body);

        // break down buffer
        const arr = multipart.Parse(parsedBody, boundary);

        return arr;
    }
}

module.exports = AttachmentService;
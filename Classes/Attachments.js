const multipart = require('parse-multipart');
const Storage = require('./AzureStorage');
const PG = require('./PostGres');

const uuid = require('uuid');

const baseURL = Storage.getBaseUrl();

class Attachments
{
    constructor()
    { }

    static async store(req, opts)
    {
        if (!req.body)
            return { 'status': 400, 'data': 'No Files Attached' };

        if (['job'].includes(opts.parentType))
            return { 'status': 400, 'data': 'Not An Allowed parentType' };

        // parse form data into buffer
        const files = Attachments.parse(req);

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

            await Promise.all([Storage.storeBlob(fullPath, files[i].data), Attachments.insert(file)]);

            urls.push({ 'url': file.url, 'name': file.name });
        }

        return urls;
    }

    static async insert(opts)
    {
        const db = await PG.connect();

        const res = await db('attachments').insert(opts);

        return res;
    }

    // async get(relatedObject, relatedId)
    // {

    // }

    static parse(req)
    {
        // get boundary from headers
        const boundary = multipart.getBoundary(req.headers['content-type']);

        // convert to buffer
        const body = Buffer.from(req.body);

        // break down buffer
        const arr = multipart.Parse(body, boundary);

        return arr;
    }
}

module.exports = Attachments;
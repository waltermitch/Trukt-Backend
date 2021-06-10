const multipart = require('parse-multipart');
const Storage = require('./AzureStorage');

// const PG = require('./PostGres');
const uuid = require('uuid');

class Attachments
{
    constructor()
    { }

    static async store(req, opts)
    {
        if (!req.body)
            return { 'status': 400, 'data': 'No Files Attached' };

        // parse form data into buffer
        const files = Attachments.parse(req);

        // array of urls and respective files
        const urls = [];

        // compose path
        const basePath = `${opts.parentType}/${opts.parentGUID}`;

        for (let i = 0; i < files.length; i++)
        {
            // compose full path of file
            const fullPath = `${basePath}/${uuid.v4()}/${files[i].filename}`;

            // store it
            const url = await Storage.storeBlob(fullPath, files[i].data);

            urls.push({ 'url': url, 'name': files[i].filename });
        }

        return urls;

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
const Storage = require('./AzureStorage');
const PG = require('./PostGres');

class Attachment
{
    constructor(data)
    {
        this.name = data.fileName;
        this.type = data.fileType;
    }

    async store()
    {

    }

    // async get(relatedObject, relatedId)
    // {

    // }
}

module.exports = Attachment;
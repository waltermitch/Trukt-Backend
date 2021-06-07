const Storage = require('./AzureStorage');
const PG = require('./PostGres');

class Attachment
{
    constructor(data)
    {
        this.name = data.fileName;
    }
}

module.exports = Attachment;
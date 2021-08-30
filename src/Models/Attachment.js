const BaseModel = require('./BaseModel');

class Attachment extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.attachments';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = Attachment;
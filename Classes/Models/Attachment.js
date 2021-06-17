const BaseModel = require('./BaseModel');

class Attachment extends BaseModel
{
    static get tableName()
    {
        return 'rcg_tms.attachments';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = Attachment;
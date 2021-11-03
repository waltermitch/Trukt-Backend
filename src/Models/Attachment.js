const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
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

Object.assign(Attachment.prototype, RecordAuthorMixin);

module.exports = Attachment;
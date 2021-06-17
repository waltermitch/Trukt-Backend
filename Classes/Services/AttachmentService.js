const Attachment = require('../Models/Attachment');

class AttachmentService
{
    static async searchByParent(parent, parentType, attachmentType)
    {
        const queryBuilder = Attachment.query().where('parent', '=', `'${parent}'`).where('parent_table', '=', `'${parentType}'`);

        if (attachmentType)
            queryBuilder.where('type', '=', `'${attachmentType}'`);

        const attachments = await queryBuilder();

        return attachments;
    }
}

module.exports = AttachmentService;
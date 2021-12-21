const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');

class LoadboardRequest extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.loadboardRequests';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const relations = {
            posting: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./LoadboardPost'),
                join: {
                    from: 'rcgTms.loadboardRequests.loadboardPostGuid',
                    to: 'rcgTms.loadboardPosts.guid'
                }
            }
        };
        return relations;
    }

    static get modifiers()
    {
        return {
            accepted(builder)
            {
                builder.where({ isValid: true, isAccepted: true });
            },
            validActive(builder)
            {
                builder.where({ 'loadboardRequests.isValid': true, 'loadboardRequests.isSynced': true, 'loadboardRequests.isDeleted': false });
            }
        };
    }

}
Object.assign(LoadboardRequest.prototype, RecordAuthorMixin);
module.exports = LoadboardRequest;
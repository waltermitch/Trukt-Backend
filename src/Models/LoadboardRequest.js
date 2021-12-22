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

    static createStatusPayload(userGuid)
    {
        return {
            deleted: {
                status: 'deleted',
                isValid: false,
                isAccepted: false,
                isDeclined: false,
                isCanceled: false,
                isSynced: false,
                isDeleted: true,
                deletedByGuid: userGuid
            },
            unposted: {
                status: 'unposted',
                isValid: false,
                isAccepted: false,
                isDeclined: false,
                isCanceled: false,
                isSynced: false,
                isDeleted: false,
                updatedByGuid: userGuid
            }
        };
    }

}
Object.assign(LoadboardRequest.prototype, RecordAuthorMixin);
module.exports = LoadboardRequest;
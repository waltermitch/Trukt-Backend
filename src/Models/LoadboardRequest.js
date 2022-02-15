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

    static DECLINE_REASON = {
        UNPOSTED: 'Unposted from Loadboard',
        PUT_ON_HOLD: 'Job set to On Hold',
        CARRIER_CANCEL: 'Canceled by Carrier'
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
            canceled: {
                status: 'canceled',
                isValid: false,
                isAccepted: false,
                isDeclined: false,
                isCanceled: true,
                isSynced: false,
                isDeleted: false,
                updatedByGuid: userGuid
            },
            declined: {
                status: 'declined',
                isValid: false,
                isAccepted: false,
                isDeclined: true,
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
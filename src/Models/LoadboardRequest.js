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
                builder.where({ 'loadboardRequests.isValid': true, 'loadboardRequests.isDeleted': false });
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

    setDeleted()
    {
        this.status = 'deleted';
        this.isValid = false;
        this.isAccepted = false;
        this.isDeclined = false;
        this.isCanceled = false;
        this.isSynced = false;
        this.isDeleted = true;
    }

    setDeclined(reason)
    {
        this.status = 'declined';
        this.isValid = false;
        this.isAccepted = false;
        this.isDeclined = true;
        this.isCanceled = false;
        this.isSynced = false;
        this.isDeleted = false;
        this.declineReason = reason || 'no reason provided';
    }

    setCanceled()
    {
        this.status = 'canceled';
        this.isValid = false;
        this.isAccepted = false;
        this.isDeclined = false;
        this.isCanceled = true;
        this.isSynced = false;
        this.isDeleted = false;
        this.declineReason = LoadboardRequest.DECLINE_REASON.CARRIER_CANCEL;
    }

    setAccepted()
    {
        this.status = 'accepted';
        this.isValid = false;
        this.isAccepted = true;
        this.isDeclined = false;
        this.isCanceled = false;
        this.isSynced = false;
        this.isDeleted = false;
    }

    setNew()
    {
        this.status = 'new';
        this.isValid = true;
        this.isCanceled = false;
        this.isAccepted = false;
        this.isDeclined = false;
        this.isSynced = false;
        this.isDeleted = false;
    }
}

Object.assign(LoadboardRequest.prototype, RecordAuthorMixin);
module.exports = LoadboardRequest;
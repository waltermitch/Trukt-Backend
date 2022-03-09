const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');

class LoadboardPost extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.loadboardPosts';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const relations = {
            job: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.loadboardPosts.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            },
            dispatches: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJobDispatch'),
                join: {
                    from: 'rcgTms.loadboardPosts.guid',
                    to: 'rcgTms.orderJobDispatches.loadboardPostGuid'
                }
            },
            requests: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./LoadboardRequest'),
                join: {
                    from: 'rcgTms.loadboardPosts.guid',
                    to: 'rcgTms.loadboardRequests.loadboardPostGuid'
                }
            }
        };
        return relations;
    }

    static get modifiers()
    {
        return {
            getFromList(builder, loadboardNames)
            {
                builder.whereIn('loadboard', loadboardNames);
            },

            getPosted(builder)
            {
                builder.where(builder =>
                {
                    builder.where({ status: 'posted' }).orWhere({ isPosted: true });
                });
            },

            getValid(builder)
            {
                builder.whereNot({ externalGuid: null, hasError: true }).andWhere({ isSynced: true });
            },

            getValidFromList(builder, loadboardNames)
            {
                builder
                    .whereIn('loadboard', loadboardNames)
                    .whereNot({ externalGuid: null, hasError: true })
                    .andWhere({ isSynced: true });
            },

            getNotDeleted(builder)
            {
                builder.where(builder =>
                {
                    builder.whereNot({ status: 'removed' }).whereNot({ isDeleted: true });
                });
            }
        };
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        return json;
    }

    posted()
    {
        return this.isPosted && this.isSynced && !this.hasError;
    }

    static getEmptyPost(jobGuid, loadboard)
    {
        return {
            jobGuid: jobGuid,
            loadboard: loadboard,
            externalGuid: null,
            externalPostGuid: null,
            instructions: null,
            status: null,
            isCreated: false,
            isPosted: false,
            isSynced: true,
            hasError: false,
            apiError: null,
            values: null,
            dateCreated: null,
            dateUpdated: null,
            dateDeleted: null,
            isDeleted: false,
            createdByGuid: null,
            updatedByGuid: null,
            deletedByGuid: null,
            guid: null
        };
    }

    setToCreated(externalGuid)
    {
        this.externalGuid = externalGuid;
        this.externalPostGuid = null;
        this.status = 'created';
        this.isCreated = true;
        this.isSynced = true;
        this.isPosted = false;
        this.isDeleted = false;
        this.dateDeleted = null;
        this.deletedByGuid = null;
        this.apiError = null;
        this.hasError = false;
    }

    setToPosted(externalGuid)
    {
        this.externalGuid = externalGuid;
        this.externalPostGuid = externalGuid;
        this.status = 'posted';
        this.isCreated = true;
        this.isSynced = true;
        this.isPosted = true;
        this.isDeleted = false;
        this.dateDeleted = null;
        this.deletedByGuid = null;
        this.apiError = null;
        this.hasError = false;
    }

    setToUnposted()
    {
        this.status = 'unposted';
        this.isSynced = true;
        this.isPosted = false;
        this.isDeleted = false;
        this.dateDeleted = null;
        this.deletedByGuid = null;
        this.hasError = false;
        this.apiError = null;
        this.isCreated = true;

        // This is the "posting" in the external system
        this.externalPostGuid = null;
        if (this.loadboard != 'SUPERDISPATCH' &&
            this.loadboard != 'SHIPCARS' &&
            this.loadboard != 'CARDELIVERYNETWORK')
        {
            // This is the "load" or "order" in the external system
            this.externalGuid = null;
        }
    }

    setToRemoved()
    {
        this.status = 'removed';
        this.isCreated = false;
        this.isSynced = true;
        this.isPosted = false;
        this.isDeleted = true;
        this.hasError = false;
        this.apiError = null;

        // This is the "posting" in the external system
        this.externalPostGuid = null;
        if (this.loadboard != 'SUPERDISPATCH' &&
            this.loadboard != 'SHIPCARS' &&
            this.loadboard != 'CARDELIVERYNETWORK')
        {
            // This is the "load" or "order" in the external system
            this.externalGuid = null;
        }
    }

    setAPIError(error)
    {
        this.isSynced = true;
        this.hasError = true;
        this.apiError = error;
    }
}

Object.assign(LoadboardPost.prototype, FindOrCreateMixin);
Object.assign(LoadboardPost.prototype, RecordAuthorMixin);
module.exports = LoadboardPost;
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
}

Object.assign(LoadboardPost.prototype, FindOrCreateMixin);
Object.assign(LoadboardPost.prototype, RecordAuthorMixin);
module.exports = LoadboardPost;
const BaseModel = require('./BaseModel');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const { RecordAuthorMixin, AuthorRelationMappings, isNotDeleted } = require('./Mixins/RecordAuthors');

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
        return {
            relation: BaseModel.BelongsToOneRelation,
            modelClass: require('./OrderJob'),
            join: {
                from: 'rcgTms.loadboardPosts.jobGuid',
                to: 'rcgTms.orderJobs.guid'
            }
        };
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
}

Object.assign(LoadboardPost.prototype, FindOrCreateMixin);
Object.assign(LoadboardPost.prototype, RecordAuthorMixin);
module.exports = LoadboardPost;
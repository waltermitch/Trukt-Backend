const BaseModel = require('./BaseModel');

class LoadboardPost extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.loadboardPosts';
    }

    static get idColumn()
    {
        return 'id';
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

}

module.exports = LoadboardPost;
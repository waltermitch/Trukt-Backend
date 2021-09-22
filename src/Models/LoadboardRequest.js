const BaseModel = require('./BaseModel');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

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

}
Object.assign(LoadboardRequest.prototype, RecordAuthorMixin);
module.exports = LoadboardRequest;
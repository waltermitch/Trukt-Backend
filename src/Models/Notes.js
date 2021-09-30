const BaseModel = require('./BaseModel');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

class Notes extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.genericNotes';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const relations = {
            order: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.genericNotes.guid',
                    through: {
                        from: 'rcgTms.orderNotes.noteGuid',
                        to: 'rcgTms.orderNotes.orderGuid'
                    },
                    to: 'rcgTms.orders.guid'
                }
            },
            job: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.genericNotes.guid',
                    through: {
                        from: 'rcgTms.orderJobNotes.noteGuid',
                        to: 'rcgTms.orderJobNotes.jobGuid'
                    },
                    to: 'rcgTms.orderJobs.guid'
                }
            }
        };
        return relations;
    }
}

Object.assign(Notes.prototype, RecordAuthorMixin);
module.exports = Notes;
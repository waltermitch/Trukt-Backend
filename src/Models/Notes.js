const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');

class Notes extends BaseModel
{
    static NOTES_TYPES = {
        LEAD: 'lead',
        UPDATE: 'update',
        FLAG: 'flag'
    }

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
            case: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./Case'),
                join: {
                    from: 'rcgTms.genericNotes.guid',
                    through: {
                        from: 'rcgTms.caseNotes.noteGuid',
                        to: 'rcgTms.caseNotes.caseGuid'
                    },
                    to: 'rcgTms.cases.guid'
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
            },
            createdBy: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./User'),
                join: {
                    from: 'rcgTms.genericNotes.createdByGuid',
                    to: 'rcgTms.tmsUsers.guid'
                }
            }
        };
        return relations;
    }

    static modifiers =
        {
            notDeleted(query)
            {
                query.where({ 'is_deleted': false });
            }
        }
}

Object.assign(Notes.prototype, RecordAuthorMixin);
module.exports = Notes;
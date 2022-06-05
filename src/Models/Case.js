const { RecordAuthorMixin, AuthorRelationMappings } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');

class Case extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.cases';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const CaseLabel = require('./CaseLabel');
        const relations = {
            label: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: CaseLabel,
                join: {
                    from: 'rcgTms.cases.caseLabelId',
                    to: 'rcgTms.caseLabels.id'
                }
            },
            notes: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Notes'),
                join: {
                    from: 'rcgTms.cases.guid',
                    through: {
                        from: 'rcgTms.caseNotes.caseGuid',
                        to: 'rcgTms.caseNotes.noteGuid'
                    },
                    to: 'rcgTms.genericNotes.guid'
                }
            },
            orderJob: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.cases.guid',
                    through: {
                        from: 'rcgTms.orderJobCases.caseGuid',
                        to: 'rcgTms.orderJobCases.jobGuid'
                    },
                    to: 'rcgTms.orderJobs.guid'
                }
            },
            order: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.cases.guid',
                    through: {
                        from: 'rcgTms.orderCases.caseGuid',
                        to: 'rcgTms.orderCases.orderGuid'
                    },
                    to: 'rcgTms.orders.guid'
                }
            },
            resolvedBy: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./User'),
                join: {
                    from: 'rcgTms.cases.resolvedByGuid',
                    to: 'rcgTms.tmsUsers.guid'
                }
            }
        };
        Object.assign(relations, AuthorRelationMappings(this.tableName));
        return relations;
    }
}

Object.assign(Case.prototype, RecordAuthorMixin);
module.exports = Case;
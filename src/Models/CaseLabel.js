const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require("./BaseModel");

class CaseLabel extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.caseLabels';
    }

    static get idColumn()
    {
        return 'id';
    }
    static get relationMappings()
    {
        const relations = {
            cases: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./Case'),
                join: {
                    from: 'rcgTms.cases.caseLabelId',
                    to: 'rcgTms.caseLabels.id'
                }
            },
            stat: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./CaseStat'),
                join: {
                    from: 'rcgTms.caseLabelStats.caseLabelId',
                    to: 'rcgTms.caseLabels.id'
                }
            }
        }
        return relations;
    }
}

Object.assign(CaseLabel.prototype, RecordAuthorMixin);
module.exports = CaseLabel;
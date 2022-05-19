const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require("./BaseModel");

class CaseStat extends BaseModel
{
    static get tableName() {
        return 'rcgTms.caseLabelStats';
    }

    static get idColumn() {
        return 'guid';
    }

    static get relationMappings() {
        const CaseLabel = require('./CaseLabel');
        const relations = {
            label: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: CaseLabel,
                join: {
                    from: 'rcgTms.caseLabelStats.caseLabelId',
                    to: 'rcgTms.caseLabels.id'
                }
            }
        }
        return relations;
    }
}

Object.assign(CaseStat.prototype, RecordAuthorMixin);
module.exports = CaseStat;
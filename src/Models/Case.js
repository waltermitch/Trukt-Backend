const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require("./BaseModel");

class Case extends BaseModel
{
    static get tableName() {
        return 'rcgTms.cases';
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
                    from: 'rcgTms.cases.caseLabelId',
                    to: 'rcgTms.caseLabels.id'
                }
            }
        }
        return relations;
    }
}

Object.assign(Case.prototype, RecordAuthorMixin);
module.exports = Case;
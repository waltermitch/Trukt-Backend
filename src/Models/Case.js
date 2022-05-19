const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require("./BaseModel");
const { Base } = require('applicationinsights/out/Declarations/Contracts');

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
            }
        }
        return relations;
    }
}

Object.assign(Case.prototype, RecordAuthorMixin);
module.exports = Case;
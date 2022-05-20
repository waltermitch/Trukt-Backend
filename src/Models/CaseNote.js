const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require("./BaseModel");

class CaseNote extends BaseModel
{
    static get tableName() {
        return 'rcgTms.caseNotes';
    }
    
}

module.exports = CaseNote;
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require("./BaseModel");

class CaseLabel extends BaseModel
{

}

Object.assign(CaseLabel.prototype, RecordAuthorMixin);
module.exports = CaseLabel;
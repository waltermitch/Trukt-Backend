const BaseModel = require('./BaseModel');

class LineLink extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoice_bill_line_links';
    }
    
    static get idColumn()
    {
        return ['line1Guid', 'line2Guid'];
    }
}

module.exports = LineLink;
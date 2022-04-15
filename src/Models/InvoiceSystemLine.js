const BaseModel = require('./BaseModel');

class InvoiceSystemLines extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobSystemInvoiceLines';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            job:
            {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.OrderJobs.typeId',
                    to: 'rcgTms.orderJobSystemInvoiceLines.jobTypeId'
                }
            },
            jobType:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJobType'),
                join: {
                    from: 'rcgTms.OrderJobsTypes.id',
                    to: 'rcgTms.orderJobSystemInvoiceLines.jobTypeId'
                }
            },
            line:
            {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./InvoiceLine'),
                join: {
                    from: 'rcgTms.invoiceBillLines.itemId',
                    to: 'rcgTms.orderJobSystemInvoiceLines.lineItemId'
                }
            },
            lineItem:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceLineItem'),
                join: {
                    from: 'rcgTms.invoiceBillLineItems.id',
                    to: 'rcgTms.orderJobSystemInvoiceLines.lineItemId'
                }
            }

            // NOTE: System USAGE relationship to invoice lines
        };
    }
}

module.exports = InvoiceSystemLines;
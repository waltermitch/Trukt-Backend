const BaseModel = require('./BaseModel');

class Invoice extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoices';
    }

    static get idColumn()
    {
        return ['invoiceGuid', 'orderGuid', 'relationTypeId'];
    }

    static get relationMappings()
    {
        return {
            order:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.invoices.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            invoiceBill:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.invoices.invoiceGuid',
                    to: 'rcgTms.invoiceBills.guid'
                }
            },
            relation:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceBillRelationType'),
                join: {
                    from: 'rcgTms.invoices.relationTypeId',
                    to: 'rcgTms.invoiceBillRelationTypes.id'
                }
            }
        };
    }
}

module.exports = Invoice;
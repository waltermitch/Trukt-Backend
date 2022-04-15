const BaseModel = require('./BaseModel');

class InvoiceBillRelationType extends BaseModel
{
    static TYPES = {
        CLIENT: 1,
        CONSIGNEE: 2,
        REFERRER: 3,
        VENDOR: 4,
        CARRIER: 5
    }

    static get tableName()
    {
        return 'rcgTms.invoiceBillRelationTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            orders: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.invoiceBillRelationTypes.id',
                    through: {
                        from: 'rcgTms.invoices.relationTypeId',
                        to: 'rcgTms.invoices.orderGuid'
                    },
                    to: 'rcgTms.orders.guid'
                }
            },
            jobs: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.invoiceBillRelationTypes.id',
                    through: {
                        from: 'rcgTms.bills.relationTypeId',
                        to: 'rcgTms.bills.jobGuid'
                    },
                    to: 'rcgTms.orderJobs.guid'
                }
            },
            invoices: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.invoiceBillRelationTypes.id',
                    through: {
                        from: 'rcgTms.invoices.relationTypeId',
                        to: 'rcgTms.invoices.invoiceGuid'
                    },
                    to: 'rcgTms.invoiceBills.guid'
                }
            },
            bills: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.invoiceBillRelationTypes.id',
                    through: {
                        from: 'rcgTms.bills.relationTypeId',
                        to: 'rcgTms.bills.invoiceGuid'
                    },
                    to: 'rcgTms.invoiceBills.guid'
                }
            }
        };
    }
}

module.exports = InvoiceBillRelationType;
const BaseModel = require('./BaseModel');

/**
 * This class represents an invoice or a bill
 */
class InvoiceBill extends BaseModel
{

    static get tableName()
    {
        return 'rcgTms.invoiceBills';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const SFAccount = require('./SFAccount');
        const Order = require('./Order');
        const OrderJob = require('./OrderJob');
        return {
            lines: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./InvoiceLine'),
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    to: 'rcgTms.invoiceBillLines.invoiceGuid'
                }
            },
            client: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.invoiceBills.externalPartyGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            vendor: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.invoiceBills.externalPartyGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            order: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    through: {
                        from: 'rcgTms.invoices.invoiceGuid',
                        to: 'rcgTms.invoices.orderGuid'
                    },
                    to: 'rcgTms.orders.guid'
                }
            },
            job: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: OrderJob,
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    through: {
                        from: 'rcgTms.bills.billGuid',
                        to: 'rcgTms.bills.jobGuid'
                    },
                    to: 'rcgTms.orderJobs.guid'
                }
            }
        };
    }
}

module.exports = InvoiceBill;
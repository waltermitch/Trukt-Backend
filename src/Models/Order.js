const BaseModel = require('./BaseModel');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

class Order extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orders';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const SFAccount = require('./SFAccount');
        const SFContact = require('./SFContact');
        const User = require('./User');
        return {
            client: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orders.clientGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            clientContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orders.clientContactGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            owner: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'rcgTms.orders.ownerGuid',
                    to: 'rcgTms.tmsUsers.guid'
                }
            },
            jobs: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.orderJobs.orderGuid'
                }
            },
            commodities: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.orderGuid',
                        extra: ['lotNumber'],
                        to: 'rcgTms.orderStopLinks.commodityGuid'
                    },
                    to: 'rcgTms.commodities.guid'
                }
            },
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.orderStopLinks.orderGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            stopLinks: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderStopLink'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.orderStopLinks.orderGuid'
                }
            },
            cosignee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orders.cosigneeGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            invoices: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.invoices.orderGuid',
                        to: 'rcgTms.invoices.invoiceGuid'
                    },
                    to: 'rcgTms.invoiceBills.order'
                }
            },
            referrer: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orders.referrerGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            salesperson: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orders.salespersonGuid',
                    to: 'salesforce.accounts.guid'
                }
            }
        };
    }
}

Object.assign(Order.prototype, RecordAuthorMixin);
module.exports = Order;
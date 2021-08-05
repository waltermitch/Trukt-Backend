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
            dispatcher: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'rcgTms.orders.dispatcherGuid',
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
            consignee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orders.consigneeGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            invoices: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.invoices.orderGuid',
                        to: 'rcgTms.invoices.invoiceGuid'
                    },
                    to: 'rcgTms.invoiceBills.guid'
                },
                modify: 'invoice'
            },
            bills: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.invoices.orderGuid',
                        to: 'rcgTms.invoices.invoiceGuid'
                    },
                    to: 'rcgTms.invoiceBills.guid'
                },
                modify: 'bill'
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

    static get fetch()
    {
        return {
            'payload': {
                client: {
                    $modify: ['byType']
                },
                consignee: {
                    $modify: ['byType']
                },
                clientContact: true,
                dispatcher: true,
                referrer: {
                    $modify: ['byType']
                },
                salesperson: {
                    $modify: ['byType']
                },
                stopLinks:
                {
                    commodity: {
                        vehicle: true,
                        commType: true
                    },
                    stop: {
                        terminal: true,
                        primaryContact: true,
                        alternativeContact: true
                    }
                },
                invoices: {
                    lines: { item: true }
                },
                bills: {
                    lines: { item: true }
                },
                jobs: {
                    vendor: true,
                    vendorAgent: true,
                    vendorContact: true,
                    jobType: true,
                    stopLinks: {
                        commodity: {
                            vehicle: true,
                            commType: true
                        },
                        stop: {
                            terminal: true,
                            primaryContact: true,
                            alternativeContact: true
                        }
                    },
                    bills: {
                        lines: { item: true }
                    }
                }
            }
        };
    }

    static allStops(order)
    {
        let stops = order.stops;
        for (const job of order.jobs || [])
        {
            stops = stops.concat(job.stops);
        }
        return stops;
    }
}

Object.assign(Order.prototype, RecordAuthorMixin);
module.exports = Order;
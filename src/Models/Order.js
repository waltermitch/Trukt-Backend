const BaseModel = require('./BaseModel');
const { RecordAuthorMixin, AuthorRelationMappings } = require('./Mixins/RecordAuthors');
const OrderJob = require('./OrderJob');
const OrderJobType = require('./OrderJobType');
const { DateTime } = require('luxon');
const currency = require('currency.js');

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
        const relations = {
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
            },
            statusLogs: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./StatusLog'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.statusLogs.orderGuid'
                }
            },
            ediData: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./EDIData'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.ediData.orderGuid'
                }
            },
            notes:
            {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Notes'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.orderNotes.orderGuid',
                        to: 'rcgTms.orderNotes.noteGuid'
                    },
                    to: 'rcgTms.genericNotes.guid'
                }
            }
        };
        Object.assign(relations, AuthorRelationMappings('rcgTms.orders'));
        return relations;
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
                    vendor: {
                        $modify: ['byType']
                    },
                    vendorAgent: true,
                    vendorContact: true,
                    dispatcher: true,
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
                        lines: { item: true, link: true }
                    }
                }
            },
            'stopsPayload': {
                jobs: {
                    stops: {
                        $modify: ['distinct'],
                        terminal: true
                    }
                },
                stops: {
                    $modify: ['distinct'],
                    terminal: true
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

    setClientNote(note, user)
    {
        if (note && note.length > 3000)
        {
            throw new Error('Client notes cannot exceed 3000 characters');
        }
        this.clientNotes = {
            note,
            updatedByGuid: user,
            dateUpdated: DateTime.utc().toString()
        };
    }

    static filterIsTender(query, isTender)
    {
        return isTender !== undefined ? query.andWhere('isTender', isTender) : query;
    }

    static filterJobCategories(query, jobCategories = [])
    {
        if (jobCategories.length > 0)
        {
            const ordersWithJobsByCategory = Order.query().select('guid').whereIn('guid',
                OrderJob.query().select('orderGuid').whereIn('typeId',
                    OrderJobType.getJobTypesByCategories(jobCategories)
                )
            );
            return query.whereIn('guid', ordersWithJobsByCategory);
        }
        return query;
    }

    static modifiers = {
        filterIsTender: this.filterIsTender,
        filterJobCategories: this.filterJobCategories
    };

    calculateEstimatedRevenueAndExpense()
    {
        if (this.jobs)
        {
            let orderEstimatedRevenue = currency(0);
            let orderEstimatedExpense = currency(0);

            for (const { estimatedRevenue, estimatedExpense } of this.jobs)
            {
                orderEstimatedRevenue = orderEstimatedRevenue.add(currency(estimatedRevenue));
                orderEstimatedExpense = orderEstimatedExpense.add(currency(estimatedExpense));
            }
            this.estimatedRevenue = orderEstimatedRevenue.value;
            this.estimatedExpense = orderEstimatedExpense.value;
        }
    }

}

Object.assign(Order.prototype, RecordAuthorMixin);
module.exports = Order;
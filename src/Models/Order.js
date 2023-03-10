const { RecordAuthorMixin, AuthorRelationMappings } = require('./Mixins/RecordAuthors');
const { ValidationError } = require('../ErrorHandling/Exceptions');
const BaseModel = require('./BaseModel');
const currency = require('currency.js');
const { DateTime } = require('luxon');

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

    static STATUS = {
        NEW: 'new',
        SUBMITTED: 'submitted',
        VERIFIED: 'verified',
        READY: 'ready',
        ON_HOLD: 'on hold',
        SCHEDULED: 'scheduled',
        PICKED_UP: 'picked up',
        DELIVERED: 'delivered',
        CANCELED: 'canceled',
        DELETED: 'deleted',
        COMPLETED: 'completed'

    };

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
            invoices: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        modelClass: require('./Invoice'),
                        from: 'rcgTms.invoices.orderGuid',
                        to: 'rcgTms.invoices.invoiceGuid',
                        extra: ['relationTypeId']
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
                        modelClass: require('./Invoice'),
                        from: 'rcgTms.invoices.orderGuid',
                        to: 'rcgTms.invoices.invoiceGuid',
                        extra: ['relationTypeId']
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
            activityLogs: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./ActivityLogs'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.activityLogs.orderGuid'
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
            },
            cases: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Case'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.orderCases.orderGuid',
                        to: 'rcgTms.orderCases.caseGuid'
                    },
                    to: 'rcgTms.cases.guid'
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
                    $modify: ['orderOnly'],
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
                    relationInvoice: true,
                    lines: { item: true },
                    consignee: {
                        $modify: ['byType']
                    }
                },
                bills: {
                    relationInvoice: true,
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
                            vehicle:
                            {
                                weightClass: true
                            },
                            commType: true
                        },
                        stop: {
                            terminal: true,
                            primaryContact: true,
                            alternativeContact: true
                        }
                    },
                    bills: {
                        relationBill: true,
                        lines: { item: true, link: true }
                    }
                }
            },
            'stopsPayload': {
                jobs: {
                    stops: {
                        $modify: ['distinctAllData'],
                        terminal: true
                    }
                },
                stops: {
                    $modify: ['distinctAllData'],
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
            throw new ValidationError('Client notes cannot exceed 3000 characters');
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
        const OrderJobType = require('./OrderJobType');
        const OrderJob = require('./OrderJob');

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

    static getOrdersFields(builder)
    {
        return builder.select(
            'guid',
            'number',
            'instructions',
            'status',
            'distance',
            'estimatedExpense',
            'estimatedRevenue',
            'quotedRevenue',
            'actualRevenue',
            'actualExpense',
            'dateExpectedCompleteBy',
            'dateCompleted',
            'dateCreated',
            'dateUpdated',
            'createdByGuid',
            'updatedByGuid',
            'referenceNumber',
            'inspectionType',
            'isTender',
            'estimatedDistance',
            'bol',
            'bolUrl',
            'estimatedIncome',
            'actualIncome',
            'isReady',
            'isOnHold',
            'isCanceled',
            'isComplete',
            'grossProfitMargin',
            'clientNotes'
        );
    }

    static modifiers = {
        filterIsTender: this.filterIsTender,
        filterJobCategories: this.filterJobCategories,
        getOrdersFields: this.getOrdersFields
    };

    async $beforeInsert(queryContext)
    {
        this.calculateRevenueAndExpense();
        await super.$beforeInsert(queryContext);
    }

    /**
     * For order creation. given that all invoices have "transport", the actual and estimated expense and revenue have the same values
     */
    calculateRevenueAndExpense()
    {
        if (this.jobs)
        {
            let revenue = currency(0);
            let expense = currency(0);

            for (const { estimatedRevenue, estimatedExpense } of this.jobs)
            {
                revenue = revenue.add(currency(estimatedRevenue));
                expense = expense.add(currency(estimatedExpense));
            }
            this.estimatedRevenue = revenue.value;
            this.actualRevenue = revenue.value;

            this.estimatedExpense = expense.value;
            this.actualExpense = expense.value;
        }
    }

    static createStatusPayload(userGuid)
    {
        return {
            deleted: {
                status: 'deleted',
                isOnHold: false,
                isReady: false,
                is_canceled: false,
                isDeleted: true,
                deletedByGuid: userGuid
            },
            undeleted: {
                status: 'ready',
                isOnHold: false,
                isReady: true,
                is_canceled: false,
                isDeleted: false,
                updated_by_guid: userGuid
            }
        };
    }
}

Object.assign(Order.prototype, RecordAuthorMixin);
module.exports = Order;
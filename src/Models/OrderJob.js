const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const OrderJobType = require('./OrderJobType');
const BaseModel = require('./BaseModel');

const jobTypeFields = ['category', 'type'];

class OrderJob extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobs';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const OrderStopLink = require('./OrderStopLink');
        const SFAccount = require('./SFAccount');
        const SFContact = require('./SFContact');
        const Order = require('./Order');
        const User = require('./User');

        return {
            vendor: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orderJobs.vendorGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            vendorContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobs.vendorContactGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.orderJobs.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            stopLinks: {
                relation: BaseModel.HasManyRelation,
                modelClass: OrderStopLink,
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.orderStopLinks.jobGuid'
                }
            },
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: OrderStopLink,
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            commodities: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: OrderStopLink,
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.commodityGuid',
                        extra: ['stopGuid']
                    },
                    to: 'rcgTms.commodities.guid'
                }
            },
            loadboardPosts: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./LoadboardPost'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.loadboardPosts.jobGuid'
                }
            },
            jobType: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJobType'),
                join: {
                    from: 'rcgTms.orderJobs.typeId',
                    to: 'rcgTms.orderJobTypes.id'
                }
            },
            vendorAgent: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobs.vendorAgentGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            driver: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobs.vendorAgentGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            dispatcher: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'rcgTms.orderJobs.dispatcherGuid',
                    to: 'rcgTms.tmsUsers.guid'
                }
            },
            equipmentType: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./EquipmentType'),
                join: {
                    from: 'rcgTms.orderJobs.equipmentTypeId',
                    to: 'rcgTms.equipmentTypes.id'
                }
            },
            bills: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        from: 'rcgTms.bills.jobGuid',
                        to: 'rcgTms.bills.billGuid'
                    },
                    to: 'rcgTms.invoiceBills.guid'
                }
            },
            dispatches: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJobDispatch'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.orderJobDispatches.jobGuid'
                }
            },
            notes:
            {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Notes'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        from: 'rcgTms.orderJobNotes.jobGuid',
                        to: 'rcgTms.orderJobNotes.noteGuid'
                    },
                    to: 'rcgTms.genericNotes.guid'
                }
            },
            type:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJobType'),
                join: {
                    from: 'rcgTms.orderJobs.typeId',
                    to: 'rcgTms.orderJobTypes.id'
                }
            }
        };
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        // inflate the jobType
        // TODO: create flatten method on BaseModel class
        if (!(json?.jobType))
        {
            const jobType = jobTypeFields.reduce((jobType, field) =>
            {
                if (field in json)
                {
                    jobType[field] = json[field];
                    delete json[field];
                }

                return jobType;
            }, {});

            if (json.typeId)
            {
                jobType.id = json.typeId;
            }

            if (Object.keys(jobType).length > 0)
            {
                json.jobType = jobType;
            }
        }

        json = this.mapIndex(json);
        return json;
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);

        if (json?.jobType)
        {
            delete json.jobType.id;
            Object.assign(json, json.jobType);
            delete json.jobType;
        }

        return json;
    }

    setIndex(index)
    {
        const newIndex = 'job_' + Date.now() + index;
        super.setIndex(newIndex);
    }

    /**
     * @param {OrderJobType} type
     */
    setIsTransport(type)
    {
        this.isTransport = (type.category === 'transport');
    }

    static filterIsTender(query, isTender)
    {
        const Order = require('./Order');
        return isTender !== undefined ?
            query.whereIn('orderGuid', Order.query().select('guid').where('isTender', isTender))
            : query;
    }

    static filterJobCategories(query, jobCategories = [])
    {
        if (jobCategories.length > 0)
            return query.whereIn('typeId', OrderJobType.getJobTypesByCategories(jobCategories));
        return query;
    }

    static sorted(query, sortField = {})
    {
        const { field, order } = sortField;
        const sortFieldQuery = OrderJob.customSort(field);

        return query.orderBy(sortFieldQuery, order || 'ASC');
    }

    static customSort(sortField = 'number')
    {
        const SFAccount = require('./SFAccount');
        const Order = require('./Order');
        const Terminal = require('./Terminal');
        const OrderStop = require('./OrderStop');
        const OrderStopLink = require('./OrderStopLink');
        const User = require('./User');

        switch (sortField)
        {
            case 'clientName':
                return SFAccount.query().select('name').where('guid',
                    Order.query().select('clientGuid').whereRaw('guid = order_guid')
                );
            case 'dispatcherName':
                return User.query().select('name').where('guid',
                    Order.query().select('dispatcher_guid').whereRaw('guid = order_guid')
                ).toKnexQuery();
            case 'salespersonName':
                return SFAccount.query().select('name').where('guid',
                    Order.query().select('salespersonGuid').whereRaw('guid = order_guid')
                );
            case 'pickupTerminal':
                return Terminal.query().select('name').where('guid',
                    OrderStop.query().select('terminalGuid').whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "rcg_tms"."order_jobs"."guid"')
                    ).andWhere('stopType', 'pickup').orderBy('dateRequestedStart').limit(1)
                );
            case 'deliveryTerminal':
                return Terminal.query().select('name').where('guid',
                    OrderStop.query().select('terminalGuid').whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "rcg_tms"."order_jobs"."guid"')
                    ).andWhere('stopType', 'delivery').orderBy('dateRequestedStart', 'desc').limit(1)
                );
            case 'requestedPickupDate':
                return OrderStop.query().min('dateRequestedStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "rcg_tms"."order_jobs"."guid"')
                    ).andWhere('stopType', 'pickup');
            case 'requestedDeliveryDate':
                return OrderStop.query().max('dateRequestedStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "rcg_tms"."order_jobs"."guid"')
                    ).andWhere('stopType', 'delivery');
            case 'scheduledPickupDate':
                return OrderStop.query().min('dateScheduledStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "rcg_tms"."order_jobs"."guid"')
                    ).andWhere('stopType', 'pickup');
            case 'scheduledDeliveryDate':
                return OrderStop.query().max('dateScheduledStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "rcg_tms"."order_jobs"."guid"')
                    ).andWhere('stopType', 'delivery');
            default:
                return sortField;
        }
    }

    static globalSearch(query, keyword)
    {
        // requiring in here to avoid circular dependency
        const OrderStopLink = require('./OrderStopLink');
        const OrderStop = require('./OrderStop');
        const SFAccount = require('./SFAccount');
        const SFContact = require('./SFContact');
        const Commodity = require('./Commodity');
        const Terminal = require('./Terminal');
        const Vehicle = require('./Vehicle');
        const Order = require('./Order');

        query

            // search by job number
            .orWhere('number', 'ilike', `%${keyword}%`)

            // search stoplink
            .orWhereIn('guid', OrderStopLink.query().select('jobGuid')

                // search stop
                .whereIn('stopGuid', OrderStop.query().select('guid')

                    // search terminal
                    .whereIn('terminalGuid', Terminal.query().select('guid')
                        .where('city', 'ilike', `%${keyword}%`)
                        .orWhere('state', 'ilike', `%${keyword}%`)
                        .orWhere('zipCode', 'ilike', `%${keyword}%`)))

                // search commodity and vehicle
                .orWhereIn('commodityGuid', Commodity.query().select('guid')
                    .where('identifier', 'ilike', `%${keyword}%`)
                    .orWhereIn('vehicleId', Vehicle.query().select('id')
                        .where('name', 'ilike', `%${keyword}%`))))

            // search vendor attributes
            .orWhereIn('vendorGuid', SFAccount.query().select('guid').where('name', 'ilike', `%${keyword}%`))

            // search client and client contact attributes
            .orWhereIn('orderGuid', Order.query().select('guid')
                .whereIn('clientContactGuid', SFContact.query().select('guid').where('email', 'ilike', `%${keyword}%`))
                .orWhereIn('clientGuid', SFAccount.query().select('guid').where('name', 'ilike', `%${keyword}%`))
                .orWhere('referenceNumber', 'ilike', `%${keyword}%`));
    }

    static modifiers = {
        filterIsTender: this.filterIsTender,
        filterJobCategories: this.filterJobCategories,
        sorted: this.sorted,
        globalSearch: this.globalSearch,
        filterStatus: (queryBuilder, status) => { return queryBuilder.whereIn('status', status); },
        statusOnHold: (queryBuilder) => { queryBuilder.orWhere({ 'isOnHold': true, 'isDeleted': false, 'isCanceled': false }); },
        statusNew: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('order', { alias: 'order' })
                .orWhere({
                    'order.isTender': false,
                    'job.isReady': false,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
                });
        },
        statusTender: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('order', { alias: 'order' })
                .orWhere({
                    'order.isTender': true,
                    'job.isReady': false,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
                });
        },
        statusComplete: (queryBuilder) => { queryBuilder.orWhere({ 'isCompleted': true }); },
        statusCanceled: (queryBuilder) => { queryBuilder.orWhere({ 'isCanceled': true }); },
        statusDeleted: (queryBuilder) => { queryBuilder.orWhere({ 'isDeleted': true }); },
        statusDispatched: (queryBuilder) =>
        {
            queryBuilder
                .orWhere({
                    'isReady': true,
                    'isOnHold': false,
                    'isDeleted': false,
                    'isCanceled': false
                })
                .whereNotNull('vendorGuid');
        },
        statusPosted: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('loadboardPosts', { alias: 'post' })
                .orWhere({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'post.isPosted': true
                })
                .whereNull('job.vendorGuid');
        },
        statusPending: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('dispatches', { alias: 'dispatch' })
                .orWhere({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'dispatch.isPending': true
                })
                .whereNull('job.vendorGuid');
        }
    };

    findInvocieLineByCommodityAndType(commodityGuid, lineTypeId)
    {
        for (const bill of this.bills)
        {
            const lineFound = bill.lines?.find(line => line.commodityGuid === commodityGuid && line.itemId == lineTypeId);
            if (lineFound) return lineFound;
        }
        return {};
    }
}

Object.assign(OrderJob.prototype, RecordAuthorMixin);
module.exports = OrderJob;
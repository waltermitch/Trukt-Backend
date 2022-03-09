const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const { ref, raw } = require('objection');
const BaseModel = require('./BaseModel');
const { snakeCaseString } = require('../Utils');
const { DataConflictError, MissingDataError } = require('../ErrorHandling/Exceptions');

const jobTypeFields = ['category', 'type'];
const EDI_DEFAULT_INSPECTION_TYPE = 'standard';
const EDI_DEFAULT_EQUIPMENT_TYPE_ID = 3;

class OrderJob extends BaseModel
{
    static STATUS = {
        NEW: 'new',
        READY: 'ready',
        ON_HOLD: 'on hold',
        POSTED: 'posted',
        PENDING: 'pending',
        DECLINED: 'declined',
        DISPATCHED: 'dispatched',
        PICKED_UP: 'picked up',
        DELIVERED: 'delivered',
        CANCELED: 'canceled',
        DELETED: 'deleted',
        COMPLETED: 'completed'
    }

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
            },
            requests:
            {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./LoadboardRequest'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        from: 'rcgTms.LoadboardPosts.jobGuid',
                        to: 'rcgTms.LoadboardPosts.guid'
                    },
                    to: 'rcgTms.loadboardRequests.loadboardPostGuid'
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

    static filterJobCategories(query, jobCategories = [])
    {
        const OrderJobType = require('./OrderJobType');

        if (jobCategories.length > 0)
            return query.whereIn('typeId', OrderJobType.getJobTypesByCategories(jobCategories));
        return query;
    }

    static sorted(query, sortField = {})
    {
        const { field, order } = sortField;
        const sortFieldQuery = OrderJob.customSort(field);

        const rawSortQuery = raw(`(${sortFieldQuery}) ${order || 'asc'} nulls last`);
        return query.orderByRaw(rawSortQuery);
    }

    static customSort(sortField = 'number')
    {
        const OrderStopLink = require('./OrderStopLink');
        const SFAccount = require('./SFAccount');
        const OrderStop = require('./OrderStop');
        const SFContact = require('./SFContact');
        const Terminal = require('./Terminal');
        const Order = require('./Order');
        const User = require('./User');

        switch (sortField)
        {
            case 'clientName':
                return SFAccount.query().select('name').where('guid',
                    Order.query().select('clientGuid').whereRaw('guid = "job".order_guid')
                ).toKnexQuery().toString();
            case 'dispatcherName':
                return User.query().select('name').whereRaw('guid = "job".dispatcher_guid').toKnexQuery().toString();
            case 'salespersonName':
                return SFAccount.query().select('name').where('guid',
                    Order.query().select('salespersonGuid').whereRaw('guid = "job".order_guid')
                ).toKnexQuery().toString();
            case 'pickupTerminal':
                return Terminal.query().select('name').where('guid',
                    OrderStop.query().select('terminalGuid').whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "job"."guid"')
                    ).andWhere('stopType', 'pickup').orderBy('dateRequestedStart').limit(1)
                ).toKnexQuery().toString();
            case 'deliveryTerminal':
                return Terminal.query().select('name').where('guid',
                    OrderStop.query().select('terminalGuid').whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "job"."guid"')
                    ).andWhere('stopType', 'delivery').orderBy('dateRequestedStart', 'desc').limit(1)
                ).toKnexQuery().toString();
            case 'requestedPickupDate':
                return OrderStop.query().min('dateRequestedStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "job"."guid"')
                    ).andWhere('stopType', 'pickup').toKnexQuery().toString();
            case 'requestedDeliveryDate':
                return OrderStop.query().max('dateRequestedStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "job"."guid"')
                    ).andWhere('stopType', 'delivery').toKnexQuery().toString();
            case 'scheduledPickupDate':
                return OrderStop.query().min('dateScheduledStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "job"."guid"')
                    ).andWhere('stopType', 'pickup').toKnexQuery().toString();
            case 'scheduledDeliveryDate':
                return OrderStop.query().max('dateScheduledStart')
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid').whereRaw('job_guid = "job"."guid"')
                    ).andWhere('stopType', 'delivery').toKnexQuery().toString();
            case 'clientContactEmail':
                return SFContact.query().select('email').where('guid',
                    Order.query().select('client_contact_guid').whereRaw('guid = "job".order_guid')
                ).toKnexQuery().toString();
            case 'carrierName':
                return SFAccount.query().select('name').whereRaw('guid = "job".vendor_guid').toKnexQuery().toString();
            case 'clientContactName':
                return SFContact.query().select('name').where('guid',
                    Order.query().select('clientContactGuid').whereRaw('guid = "job".order_guid')
                ).toKnexQuery().toString();
            default:
                return snakeCaseString(sortField);
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

        query.where(
            builder =>
            {
                // search by job number
                builder.orWhere('job.number', 'ilike', `%${keyword}%`)

                    // search stoplink
                    .orWhereIn('job.guid', OrderStopLink.query().select('jobGuid')

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
                            .orWhereIn('vehicleId', Vehicle.query().alias('vehicle').select('vehicle.id')
                                .where('vehicle.name', 'ilike', `%${keyword}%`))))

                    // search vendor attributes
                    .orWhereIn('vendorGuid', SFAccount.query().alias('vendor').select('vendor.guid').where('vendor.name', 'ilike', `%${keyword}%`))

                    // search client and client contact attributes
                    .orWhereIn('job.orderGuid', Order.query().select('guid')
                        .whereIn('clientContactGuid', SFContact.query().select('guid').where('email', 'ilike', `%${keyword}%`))
                        .orWhereIn('clientGuid', SFAccount.query().alias('client').select('client.guid').where('client.name', 'ilike', `%${keyword}%`))
                        .orWhere('referenceNumber', 'ilike', `%${keyword}%`));
            }
        );
    }

    static modifiers = {
        filterJobCategories: this.filterJobCategories,
        sorted: this.sorted,
        globalSearch: this.globalSearch,
        transportJob: (queryBuilder) =>
        {
            const OrderJobType = require('./OrderJobType');

            queryBuilder.whereIn('typeId', OrderJobType.getJobTypesByCategories(['transport']));
        },
        serviceJob: (queryBuilder) =>
        {
            const OrderJobType = require('./OrderJobType');

            queryBuilder.whereIn('typeId', OrderJobType.getJobTypesByCategories(['service']));
        },
        statusActive: (queryBuilder) =>
        {
            const Order = require('./Order');
            queryBuilder
                .alias('job')
                .where({
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereExists(Order.query().alias('o').where({ 'o.guid': ref('job.order_guid'), 'o.isTender': false }));
        },
        statusOnHold: (queryBuilder) => { queryBuilder.alias('job').where({ 'job.isOnHold': true, 'job.isDeleted': false, 'job.isCanceled': false }); },
        statusNew: (queryBuilder) =>
        {
            const Order = require('./Order');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': false,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
                })
                .whereExists(Order.query().alias('o').where({ 'o.guid': ref('job.order_guid'), 'o.isTender': false }));
        },
        statusTender: (queryBuilder) =>
        {
            const Order = require('./Order');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': false,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
                })
                .whereExists(Order.query().alias('o').where({ 'o.guid': ref('job.order_guid'), 'o.isTender': true }));
        },
        statusComplete: (queryBuilder) => { queryBuilder.alias('job').where({ 'job.isComplete': true }); },
        statusCanceled: (queryBuilder) => { queryBuilder.alias('job').where({ 'job.isCanceled': true }); },
        statusDeleted: (queryBuilder) => { queryBuilder.alias('job').where({ 'job.isDeleted': true }); },
        statusDispatched: (queryBuilder) =>
        {
            const orderStopLinks = require('./OrderStopLink');
            queryBuilder
                .where({
                    'isReady': true,
                    'isOnHold': false,
                    'isDeleted': false,
                    'isCanceled': false
                })
                .whereExists(orderStopLinks.query().joinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'pickup',
                        'links.isStarted': false,
                        'links.stop_guid': ref('stop.guid'),
                        'links.job_guid': ref('job.guid')
                    }))
                .whereExists(orderStopLinks.query().joinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'delivery',
                        'links.isStarted': false,
                        'links.stop_guid': ref('stop.guid'),
                        'links.job_guid': ref('job.guid')
                    }))
                .whereNotNull('vendorGuid');
        },
        statusPosted: (queryBuilder) =>
        {
            const LoadboardPost = require('./LoadboardPost');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNull('job.vendorGuid')
                .whereExists(LoadboardPost.query().alias('lp').where({ 'job.guid': ref('lp.job_guid'), 'lp.isPosted': true }));
        },
        statusPending: (queryBuilder) =>
        {
            const OrderJobDispatch = require('./OrderJobDispatch');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNull('job.vendorGuid')
                .whereExists(OrderJobDispatch.query().alias('ojd').where({ 'job.guid': ref('ojd.job_guid'), 'ojd.isPending': true }));
        },
        statusDeclined: (queryBuilder) =>
        {
            const OrderJobDispatch = require('./OrderJobDispatch');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNull('job.vendorGuid')
                .whereExists(OrderJobDispatch.query().alias('ojd').where({ 'job.guid': ref('ojd.job_guid'), 'ojd.isDeclined': true }));
        },
        statusRequests: (queryBuilder) =>
        {
            const loadboardRequest = require('./LoadboardRequest');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereExists(loadboardRequest.query().joinRelated('posting').alias('req')
                    .where({
                        'posting.isPosted': true,
                        'req.isValid': true,
                        'posting.job_guid': ref('job.guid')
                    }))
                .whereNull('job.vendorGuid');
        },
        statusPickedUp: (queryBuilder) =>
        {
            const orderStopLinks = require('./OrderStopLink');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNotNull('job.vendorGuid')
                .whereNotExists(orderStopLinks.query().rightJoinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'pickup',
                        'links.isCompleted': false,
                        'links.stopGuid': ref('stop.guid'),
                        'links.job_guid': ref('job.guid')
                    }))
                .whereExists(orderStopLinks.query().rightJoinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'delivery',
                        'links.isCompleted': false,
                        'links.stopGuid': ref('stop.guid'),
                        'links.job_guid': ref('job.guid')
                    }));
        },
        statusDelivered: (queryBuilder) =>
        {
            const orderStopLinks = require('./OrderStopLink');
            queryBuilder
                .alias('job')
                .whereNotExists(orderStopLinks.query().rightJoinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'delivery',
                        'links.isCompleted': false,
                        'links.stopGuid': ref('stop.guid'),
                        'links.job_guid': ref('job.guid')
                    }))
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNotNull('job.vendorGuid');
        },
        statusReady: (queryBuilder) =>
        {
            const Order = require('./Order');
            const loadboardPost = require('./LoadboardPost');
            const orderJobDispatches = require('./OrderJobDispatch');
            queryBuilder
                .alias('job')
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
                })
                .whereNull('job.vendorGuid')
                .whereExists(Order.query().alias('o').where({ 'o.guid': ref('job.order_guid'), 'o.isTender': false }))
                .whereNotExists(loadboardPost.query().alias('post')
                    .where({
                        'post.isPosted': true,
                        'post.jobGuid': ref('job.guid')
                    }))
                .whereNotExists(orderJobDispatches.query().alias('ojd')
                    .where({
                        'ojd.isValid': true,
                        'ojd.jobGuid': ref('job.guid')
                    }));
        },
        statusInProgress: (queryBuilder) =>
        {
            queryBuilder.alias('job')
                .whereNotNull('job.vendorGuid')
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                });
        },
        areAllOrderJobsDeleted: this.areAllOrderJobsDeleted,
        filterAccounting: this.filterAccounting,
        isBilled: (queryBuilder) =>
        {
            const InvoiceLine = require('./InvoiceLine');
            const billAndLinesPaid = InvoiceLine.query()
                .select(raw('bill.job_guid, bool_and(invoice_bill.is_paid = true) as all_bills_paid, bool_and(invoice_bill_lines.is_paid = true) as all_lines_paid'))
                .joinRelated({ bill: true, invoiceBill: true })
                .groupBy('bill.jobGuid');

            return queryBuilder
                .select(raw('(CASE WHEN all_bills_paid = true and bill_and_lines_paid.all_lines_paid = true THEN true ELSE false END) AS is_billed'))
                .with('billAndLinesPaid', billAndLinesPaid)
                .leftJoin('billAndLinesPaid', 'billAndLinesPaid.jobGuid', 'job.guid');
        },
        isInvoiced: (queryBuilder) =>
        {
            const InvoiceLine = require('./InvoiceLine');
            const invoicesAndLinesPaid = InvoiceLine.query()
                .select(raw('invoice.order_guid, bool_and(invoice_bill.is_paid = true) as all_invoices_paid, bool_and(invoice_bill_lines.is_paid = true) as all_lines_paid'))
                .joinRelated({ invoice: true, invoiceBill: true })
                .groupBy('invoice.order_guid');

            return queryBuilder
                .select(raw('(CASE WHEN all_invoices_paid = true and invoices_and_lines_paid.all_lines_paid = true THEN true ELSE false END) AS is_invoiced'))
                .with('invoicesAndLinesPaid', invoicesAndLinesPaid)
                .leftJoin('invoicesAndLinesPaid', 'invoicesAndLinesPaid.orderGuid', 'job.orderGuid');
        },
        filterByDispatcher: this.filterByDispatcher,
        filterByCustomer: this.filterByCustomer,
        filterBySalesperson: this.filterBySalesperson,
        filterByCarrier: this.filterByCarrier,
        canServiceJobMarkAsCanceled: (queryBuilder) =>
        {
            queryBuilder.select(raw(`bool_and(
                vendor_guid is null 
                and (is_deleted = false and is_canceled = false and is_complete = false)
                and date_completed is null
            ) as canBeMarkAsCanceled
            `));
        },

        // Uses OrderJob alias as OJ
        isServiceJob: (queryBuilder) =>
        {
            queryBuilder.select(raw('(case when o_j_t.category=\'service\' then true else false END) as isServiceJob'))
                .innerJoin('rcgTms.orderJobTypes as OJT', 'OJ.typeId', 'OJT.id');
        },

        // Uses OrderJob alias as OJ
        vendorName: (queryBuilder) =>
        {
            queryBuilder.select('V.name as vendorName')
                .leftJoin('salesforce.accounts as V', 'OJ.vendorGuid', 'V.guid');

        }
    };

    static filterByCarrier(queryBuilder, carrierList = [])
    {
        return carrierList?.length
            ? queryBuilder.whereIn('vendorGuid', carrierList) : queryBuilder;
    }

    static filterByDispatcher(queryBuilder, dispatcherList = [])
    {
        return dispatcherList?.length
            ? queryBuilder.whereIn('job.dispatcherGuid', dispatcherList) : queryBuilder;
    }

    static filterByCustomer(queryBuilder, customerList = [])
    {
        const Order = require('../Models/Order');
        return customerList?.length
            ? queryBuilder.whereIn('job.orderGuid',
                Order.query().select('guid').whereIn('clientGuid', customerList)
            ) : queryBuilder;
    }

    static filterBySalesperson(queryBuilder, salespersonList = [])
    {
        const Order = require('../Models/Order');
        return salespersonList?.length
            ? queryBuilder.whereIn('job.orderGuid',
                Order.query().select('guid').whereIn('salespersonGuid', salespersonList)
            ) : queryBuilder;
    }

    findInvocieLineByCommodityAndType(commodityGuid, lineTypeId)
    {
        for (const bill of this.bills)
        {
            const lineFound = bill.lines?.find(line => line.commodityGuid === commodityGuid && line.itemId == lineTypeId);
            if (lineFound) return lineFound;
        }
        return {};
    }

    validateJobForDispatch()
    {
        if (this.isDummy)
            throw new DataConflictError('Cannot dispatch dummy job');

        if (this.type.category != 'transport' && this.type.type != 'transport' && this.isTransport)
            throw new DataConflictError('Cannot dispatch non transport job');

        if (this.isOnHold)
            throw new DataConflictError('Cannot dispatch job that is on hold');

        if (!this.dispatcherGuid)
            throw new MissingDataError('Cannot dispatch job that has no dispatcher');

        if (!this.isReady)
            throw new DataConflictError('Cannot dispatch job that is not ready');

        if (this.isDeleted)
            throw new DataConflictError('Cannot dispatch deleted job');

        if (this.isCanceled)
            throw new DataConflictError('Cannot dispatch canceled job');

        if (this.order.isTender)
            throw new DataConflictError('Cannot dispatch job for tender order');

        if (this.dispatches?.length > 0)
            throw new DataConflictError('Cannot dispatch job with already active load offer');

        if (this.bills.length === 0)
            throw new MissingDataError('Job bill missing. Bill is required in order to set payment method and payment terms');
    }

    validateJobForAccepting()
    {
        if (!this.isReady)
            throw new DataConflictError('Job is not ready');
        if (Number(this.validDispatchesCount) > 1)
            throw new DataConflictError('Job has more than one valid pending dispatch');
        if (Number(this.validDispatchesCount) === 0)
            throw new DataConflictError('Job has no valid pending dispatch');
    }

    static get fetch()
    {
        return {
            // fields that job will return
            getOrdersPayload: [
                'job.guid',
                'job.number',
                'job.estimatedExpense',
                'job.estimatedRevenue',
                'job.status',
                'job.dateCreated',
                'job.actualRevenue',
                'job.actualExpense',
                'job.dateUpdated',
                'job.grossProfitMargin'
            ]
        };
    }

    static areAllOrderJobsDeleted(query, orderGuid)
    {
        return query.select(raw('bool_and(is_deleted) as deleteOrder')).where('orderGuid', orderGuid);
    }

    static filterAccounting(query, accountingType)
    {
        const Bill = require('./Bill');
        const InvoiceBill = require('./InvoiceBill');
        const Invoice = require('./Invoice');
        const Order = require('./Order');

        switch (accountingType)
        {
            case 'not_invoiced':
                const ordersWithInvoicesNotFullPaid = OrderJob.accountingNotFullPaid(Invoice, InvoiceBill, 'orderGuid', 'invoiceGuid', 'guid');

                return query.whereIn('job.orderGuid', ordersWithInvoicesNotFullPaid);
            case 'invoiced':
                const ordersWithAllInvoicesFullPaid = OrderJob.ordersWithInvoicesPaidQuery(Invoice);
                const ordersWithAllLinesFullPaid = OrderJob.ordersWithLinesPaidQuery(Invoice);

                return query.whereIn('job.guid', ordersWithAllInvoicesFullPaid)
                    .whereIn('job.guid', ordersWithAllLinesFullPaid);
            case 'billed':
                const jobsWithAllBillsFullPaid = OrderJob.jobsWithBillsPaidQuery(Bill);
                const jobsWithAllLinesFullPaid = OrderJob.jobsWithLinesPaidQuery(Bill);

                return query.whereIn('job.guid', jobsWithAllBillsFullPaid)
                    .whereIn('job.guid', jobsWithAllLinesFullPaid);
            case 'not_billed':
                const jobsWithBillsNotFullPaid = OrderJob.accountingNotFullPaid(Bill, InvoiceBill, 'jobGuid', 'billGuid', 'guid');

                return query.whereIn('job.guid', jobsWithBillsNotFullPaid);
            case 'part_invoiced':
                const ordersWithPartialPaidInvoices = Order.query().select('guid').whereIn('guid',
                    Invoice.query().select('orderGuid').whereIn('invoiceGuid',
                        InvoiceBill.query().select('IB.guid').alias('IB')
                            .innerJoin('rcgTms.invoiceBillLines as IBL', 'IB.guid', 'invoiceGuid')
                            .where('IBL.isPaid', false)
                            .andWhere('IB.isPaid', true)
                    )
                );

                return query.whereIn('job.orderGuid', ordersWithPartialPaidInvoices);
            case 'part_billed':
                const jobsWithPartialPaidBills = OrderJob.relatedQuery('bills').alias('B').select('jobGuid').where('isPaid', true)
                    .whereExists(
                        InvoiceBill.relatedQuery('lines').where('isPaid', false)
                    );

                return query.whereIn('job.guid', jobsWithPartialPaidBills);
            default:
                return query;
        }
    }

    static accountingNotFullPaid(BaseModel, InnerModel, baseColumn, matchingColumn, innerColumn)
    {
        return BaseModel.query().select(baseColumn).whereIn(matchingColumn,
            InnerModel.query().select(innerColumn).where('isPaid', false)
        );
    }

    static baseAccountingGroupByAllPaid(Model, keyColumn, innerTable, leftColumn, rightColumn)
    {
        return Model.query().alias('BMA').select(keyColumn, raw('bool_and(is_paid = true) as all_paid'))
            .innerJoin(`rcg_tms.${innerTable}`, `BMA.${leftColumn}`, rightColumn)
            .groupBy(keyColumn);
    }

    static jobsWithBillsPaidQuery(Model)
    {
        const jobsGroupByBillsPaid = OrderJob.baseAccountingGroupByAllPaid(Model, 'jobGuid', 'invoiceBills', 'billGuid', 'guid');
        return OrderJob.query().with('jobsFullPaid', jobsGroupByBillsPaid)
            .innerJoin('jobsFullPaid', 'guid', 'jobGuid')
            .select('guid').where('all_paid', true);
    }

    static jobsWithLinesPaidQuery(Model)
    {
        const jobsGroupByLinesPaid = OrderJob.baseAccountingGroupByAllPaid(Model, 'jobGuid', 'invoiceBillLines', 'billGuid', 'invoiceGuid');
        return OrderJob.query().with('jobsFullPaid', jobsGroupByLinesPaid)
            .innerJoin('jobsFullPaid', 'guid', 'jobGuid')
            .select('guid').where('all_paid', true);
    }

    static ordersWithInvoicesPaidQuery(Model)
    {
        const ordersGroupByInvoicesPaid = OrderJob.baseAccountingGroupByAllPaid(Model, 'orderGuid', 'invoiceBills', 'invoiceGuid', 'guid');
        return OrderJob.query().alias('OJ').with('ordersFullPaid', ordersGroupByInvoicesPaid)
            .innerJoin('ordersFullPaid as OFP', 'OFP.orderGuid', 'OJ.orderGuid')
            .select('guid').where('all_paid', true);
    }

    static ordersWithLinesPaidQuery(Model)
    {
        const ordersGroupByLinesPaid = OrderJob.baseAccountingGroupByAllPaid(Model, 'orderGuid', 'invoiceBillLines as IBL', 'invoiceGuid', 'IBL.invoiceGuid');
        return OrderJob.query().alias('OJ').with('orderLinesFullPaid', ordersGroupByLinesPaid)
            .innerJoin('orderLinesFullPaid as OFP', 'OJ.orderGuid', 'OFP.orderGuid')
            .select('guid').where('all_paid', true);
    }

    /**
     * @description This is for EDI orders that do not provide the inspection type or equipment type on the job
     */
    setDefaultValues(isTender = false)
    {
        if (isTender && !this.inspectionType)
            this.inspectionType = EDI_DEFAULT_INSPECTION_TYPE;

        if (isTender && !this.equipmentTypeId)
            this.equipmentTypeId = EDI_DEFAULT_EQUIPMENT_TYPE_ID;
    }

    /**
     * Use OrderJob modifier "isServiceJob" to get the property "isservicejob".
     * Use OrderJob modifier "canServiceJobMarkAsCanceled" to get the property "canServiceJobMarkAsCanceled"
     * Use OrderJob modifier "vendorName" to get the property "vendorName"
     */
    validateJobForCanceling()
    {
        // Validation for service jobs
        if (this.isservicejob)
        {
            if (this.vendorGuid)
                throw new DataConflictError(`Please un-dispatch the vendor '${this.vendorName}' before canceling the job`);
            if (!this.canServiceJobMarkAsCanceled)
                throw new DataConflictError(`Cannot cancel job because it is '${this.status}'`);

        }

        // Validation for transport jobs
        else
        {
            if (this.isDeleted)
                throw new DataConflictError('This Order is deleted and can not be canceled.');
            if (this.jobIsDispatched)
                throw new DataConflictError('Please un-dispatch the Order before canceling');
        }
    }
}

Object.assign(OrderJob.prototype, RecordAuthorMixin);
module.exports = OrderJob;

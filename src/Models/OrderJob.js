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
            },
            requests:
            {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./LoadboardRequest'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        from: 'rcgTms.LoadboardPosts.guid',
                        to: 'rcgTms.LoadboardPosts.jobGuid'
                    },
                    to: 'rcgTms.loadboardRequests.guid'
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
                return User.query().select('name').whereRaw('guid = dispatcher_guid');
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
            .orWhere('job.number', 'ilike', `%${keyword}%`)

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
        filterJobCategories: this.filterJobCategories,
        sorted: this.sorted,
        globalSearch: this.globalSearch,
        transportJob: (queryBuilder) => { queryBuilder.whereIn('typeId', OrderJobType.getJobTypesByCategories(['transport'])); },
        serviceJob: (queryBuilder) => { queryBuilder.whereIn('typeId', OrderJobType.getJobTypesByCategories(['service'])); },
        statusActive: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('order', { alias: 'order' })
                .where({
                    'order.isTender': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                });
        },
        statusOnHold: (queryBuilder) => { queryBuilder.where({ 'isOnHold': true, 'isDeleted': false, 'isCanceled': false }); },
        statusNew: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('order', { alias: 'order' })
                .where({
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
                .where({
                    'order.isTender': true,
                    'job.isReady': false,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
                });
        },
        statusComplete: (queryBuilder) => { queryBuilder.where({ 'isComplete': true }); },
        statusCanceled: (queryBuilder) => { queryBuilder.where({ 'isCanceled': true }); },
        statusDeleted: (queryBuilder) => { queryBuilder.where({ 'isDeleted': true }); },
        statusDispatched: (queryBuilder) =>
        {
            queryBuilder
                .where({
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
                .where({
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
                .where({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'dispatch.isPending': true
                })
                .whereNull('job.vendorGuid');
        },
        statusDeclined: (queryBuilder) =>
        {
            queryBuilder
                .alias('job')
                .joinRelated('dispatches', { alias: 'dispatch' })
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'dispatch.isDeclined': true
                })
                .whereNull('job.vendorGuid');
        },
        statusRequests: (queryBuilder) =>
        {
            const loadboardRequest = require('./LoadboardRequest');
            queryBuilder
                .alias('job')
                .whereExists(loadboardRequest.query().joinRelated('posting').alias('req')
                    .where({
                        'posting.isPosted': true,
                        'req.isValid': true
                    })
                    .whereRaw('"posting"."job_guid" = "job"."guid"'))
                .where({
                    'job.isReady': true,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNull('job.vendorGuid');
        },
        statusPickedUp: (queryBuilder) =>
        {
            const orderStopLinks = require('./OrderStopLink');
            queryBuilder
                .alias('job')
                .whereNotExists(orderStopLinks.query().joinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'pickup',
                        'links.isCompleted': false
                    })
                    .whereRaw('"links"."stop_guid" = "stop"."guid" AND "links"."job_guid" = "job"."guid"'))
                .whereExists(orderStopLinks.query().joinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'delivery',
                        'links.isCompleted': false
                    })
                    .whereRaw('"links"."stop_guid" = "stop"."guid" AND "links"."job_guid" = "job"."guid"'))
                .where({
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false
                })
                .whereNotNull('job.vendorGuid');
        },
        statusDelivered: (queryBuilder) =>
        {
            const orderStopLinks = require('./OrderStopLink');
            queryBuilder
                .alias('job')
                .whereNotExists(orderStopLinks.query().joinRelated('stop').alias('links')
                    .where({
                        'stop.stopType': 'delivery',
                        'links.isCompleted': false
                    })
                    .whereRaw('"links"."stop_guid" = "stop"."guid" AND "links"."job_guid" = "job"."guid"'))
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
            const loadboardPost = require('./LoadboardPost');
            const orderJobDispatches = require('./OrderJobDispatch');
            queryBuilder
                .alias('job')
                .joinRelated('order', { alias: 'order' })
                .whereNotExists(loadboardPost.query().alias('post')
                    .where({
                        'post.isPosted': false
                    })
                    .whereRaw('"job"."guid" = "post"."job_guid"'))
                .whereNotExists(orderJobDispatches.query().alias('ojd')
                    .where({
                        'ojd.isAccepted': false,
                        'ojd.isPending': false
                    })
                    .whereRaw('"job"."guid" = "ojd"."job_guid"'))
                .where({
                    'order.isTender': false,
                    'job.isReady': true,
                    'job.isOnHold': false,
                    'job.isDeleted': false,
                    'job.isCanceled': false,
                    'job.isComplete': false
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
const R = require('ramda');
const NodeCache = require('node-cache');

const Order = require('../Models/Order');
const OrderStop = require('../Models/OrderStop');
const OrderStopLink = require('../Models/OrderStopLink');
const OrderJob = require('../Models/OrderJob');
const OrderJobType = require('../Models/OrderJobType');
const SFAccount = require('../Models/SFAccount');
const SFContact = require('../Models/SFContact');
const RecordType = require('../Models/RecordType');
const Commodity = require('../Models/Commodity');
const CommodityType = require('../Models/CommodityType');
const Vehicle = require('../Models/Vehicle');
const Terminal = require('../Models/Terminal');
const Contact = require('../Models/TerminalContact');
const InvoiceBill = require('../Models/InvoiceBill');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const Expense = require('../Models/Expense');
const ComparisonType = require('../Models/ComparisonType');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');

const { MilesToMeters } = require('./../Utils');

const isUseful = R.compose(R.not, R.anyPass([R.isEmpty, R.isNil]));
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 3600 });

let dateFilterComparisonTypes;

class OrderService
{
    static async getOrders({
        pickup,
        delivery,
        status,
        customer,
        carrier,
        dispatcher,
        salesperson,
        dates,
        isTender,
        jobCategory
    }, page, rowCount)
    {

        dateFilterComparisonTypes = dates && await OrderService.getComparisonTypesCached();

        const baseOrderQuery = Order.query().page(page, rowCount);

        const queryFilterPickup = OrderService.addFilterPickups(baseOrderQuery, pickup);
        const queryFilterDelivery = OrderService.addFilterDeliveries(queryFilterPickup, delivery);
        const queryFilterStatus = OrderService.addFilterStatus(queryFilterDelivery, status);
        const queryFilterCustomer = OrderService.addFilterCustomer(queryFilterStatus, customer);
        const queryFilterDispatcher = OrderService.addFilterDispatcher(queryFilterCustomer, dispatcher);
        const queryFilterSalesperson = OrderService.addFilterSalesperson(queryFilterDispatcher, salesperson);
        const queryFilterCarrier = OrderService.addFilterCarrier(queryFilterSalesperson, carrier);
        const queryFilterDates = OrderService.addFilterDates(queryFilterCarrier, dates);
        const queryAllFilters = OrderService.addFilterModifiers(queryFilterDates, { isTender, jobCategory });

        const queryWithGraphModifiers = OrderService.addGraphModifiers(queryAllFilters, jobCategory);

        const { total, results } = await queryWithGraphModifiers.orderBy('number', 'ASC');
        const ordersWithDeliveryAddress = {
            results: OrderService.addDeliveryAddress(results),
            page: page + 1,
            rowCount,
            total
        };

        return ordersWithDeliveryAddress;
    }

    static async getOrderByGuid(orderGuid)
    {
        // TODO split this up so that query is faster and also doesnt give 500 error.
        let order = await Order.query().skipUndefined().findById(orderGuid);
        if (order)
        {
            const trx = await Order.startTransaction();
            try
            {
                order = await Order.fetchGraph(order, Order.fetch.payload, { transaction: trx, skipFetched: true }).skipUndefined();
                await trx.commit();
                order.expenses = [];
                const terminalCache = {};
                order.stops = OrderStopLink.toStops(order.stopLinks);
                delete order.stopLinks;

                for (const stop of order.stops)
                {
                    if (!(stop.terminal.guid in terminalCache))
                    {
                        terminalCache[stop.terminal.guid] = stop.terminal;
                    }
                }

                for (const invoice of [...order.invoices, ...order.bills])
                {
                    for (const line of invoice.lines)
                    {
                        order.expenses.push(Expense.fromInvoiceLine(order, invoice, line));
                    }
                }
                delete order.invoices;
                delete order.bills;

                for (const job of order.jobs)
                {
                    job.stops = OrderStopLink.toStops(job.stopLinks);
                    delete job.stopLinks;

                    for (const stop of job.stops)
                    {
                        if (!(stop.terminal.guid in terminalCache))
                        {
                            terminalCache[stop.terminal.guid] = stop.terminal;
                        }
                    }

                    for (const bill of job.bills)
                    {
                        for (const line of bill.lines)
                        {
                            order.expenses.push(Expense.fromInvoiceLine(job, bill, line));
                        }
                    }

                    delete job.bills;
                }

                // assign unique terminals to the top level
                order.terminals = Object.values(terminalCache);

            }
            catch (err)
            {
                await trx.rollback();
                throw err;
            }

        }

        return order;
    }

    static async create(orderObj, currentUser)
    {

        const trx = await Order.startTransaction();

        try
        {
            // use trx (transaction) because none of the data should be left in the database if any of it fails
            const contactRecordType = await RecordType.query(trx).modify('byType', 'contact').modify('byName', 'account contact');
            const commTypes = await CommodityType.query(trx);
            const jobTypes = await OrderJobType.query(trx);
            const invoiceLineItems = await InvoiceLineItem.query(trx);

            // order object will be used to link OrderStopLink from the job
            let order = Order.fromJson({});
            order.setCreatedBy(currentUser);

            orderObj.client = await SFAccount.query(trx).modify('byType', 'client').findOne(builder =>
            {
                builder.orWhere('guid', orderObj.client.guid)
                    .orWhere('salesforce.accounts.sfId', orderObj.client.guid);
            });

            if (isUseful(orderObj?.consignee))
            {
                orderObj.consignee = await SFAccount.query(trx).findOne(builder =>
                {
                    builder.orWhere('guid', orderObj.consignee.guid)
                        .orWhere('salesforce.accounts.sfId', orderObj.consignee.guid);
                });
            }
            else
            {
                orderObj.consignee = orderObj.client;
            }

            if (isUseful(orderObj?.referrer))
            {
                orderObj.referrer = await SFAccount.query(trx).findById(orderObj.referrer?.guid);
                order.graphLink('referrer', orderObj.referrer);
            }

            // salesperson
            if (isUseful(orderObj?.salesperson))
            {
                orderObj.salesperson = await SFAccount.query(trx).findById(orderObj.salesperson.guid);
                order.graphLink('salesperson', orderObj.salesperson);
            }

            // dispatcher / manager responsible for the order
            if (isUseful(orderObj?.dispatcher))
            {
                const dispatcher = await SFAccount.query(trx).findById(orderObj.dispatcher.guid);
                if (!dispatcher)
                {
                    throw new Error('dispatcher ' + JSON.stringify(orderObj.dispatcher) + ' doesn\'t exist');
                }
                orderObj.dispatcher = dispatcher;
                order.graphLink('dispatcher', orderObj.dispatcher);
            }

            order.graphLink('consignee', orderObj.consignee);
            order.graphLink('client', orderObj.client);

            if (isUseful(orderObj.clientContact))
            {
                const clientContact = SFContact.fromJson(orderObj.clientContact);

                if (orderObj.client)
                    clientContact.linkAccount(orderObj.client);

                clientContact.linkRecordType(contactRecordType);
                const contact = await clientContact.findOrCreate(trx);
                order.graphLink('clientContact', contact);
            }

            const commodities = {};
            for (const commObj of orderObj.commodities || [])
            {
                const commodity = Commodity.fromJson(commObj);
                commodity.setCreatedBy(currentUser);
                const commType = commTypes.find(it => CommodityType.compare(commodity, it));
                if (!commType)
                {
                    throw new Error(`unknown commodity ${commodity.commType?.category} ${commodity.commType?.type}`);
                }
                commodity.graphLink('commType', commType);

                if (commodity.isVehicle())
                {
                    const vehicle = await Vehicle.fromJson(commodity.vehicle).findOrCreate(trx);
                    commodity.graphLink('vehicle', vehicle);
                }
                commodities[commObj['#id']] = commodity;
            }

            const terminals = {};
            for (const terminalObj of orderObj.terminals || [])
            {
                let terminal = Terminal.fromJson(terminalObj);
                terminal.setCreatedBy(currentUser);
                terminal = await terminal.findOrCreate(trx);
                if (!terminal.isResolved)
                {
                    // TODO: check if the terminal is resolved and put it inside of the service-bus queue
                }

                const terminalIndex = terminalObj['#id'];
                terminal.setIndex(terminalIndex);

                // store to use as a cache for later
                terminals[terminalIndex] = terminal;
            }

            const terminalContacts = {};
            const stopswithContacts = Order.allStops(orderObj).filter(it => OrderStop.hasContact(it));

            for (const stop of stopswithContacts)
            {
                const terminal = terminals[stop.terminal];
                for (const contactType of ['primaryContact', 'alternativeContact'])
                {
                    if (stop[contactType])
                    {
                        let contact = Contact.fromJson(stop[contactType]);
                        contact.linkTerminal(terminal);
                        const key = contact.uniqueKey();
                        if (!(key in terminalContacts))
                        {
                            contact.setCreatedBy(currentUser);
                            contact = await contact.findOrCreate(trx);
                            terminalContacts[key] = { '#dbRef': contact.guid };
                        }
                        stop[contactType] = terminalContacts[key];
                    }
                }
            }

            // orders will have defined all the stops that are needed to be completed
            // for this order to be classified as completed as well
            // however, jobs will also use these stops and will have their own stops that will
            // not appear in the orders
            const stopsCache = {};

            const orderStops = [];
            for (const stopObj of orderObj.stops)
            {
                const stop = OrderStop.fromJson(stopObj);
                stop.setCreatedBy(currentUser);
                orderStops.push(stop);
            }
            order.stopLinks = OrderService.buildStopLinksGraph(orderStops, stopsCache, terminals, commodities);

            for (const stopLink of order.stopLinks)
            {
                stopLink.setCreatedBy(currentUser);
            }

            order.jobs = [];

            const numJobs = orderObj.jobs?.length || 0;
            for (let i = 0; i < numJobs; i++)
            {
                const jobObj = orderObj.jobs[i];

                const job = OrderJob.fromJson(jobObj);

                job.status = 'new';
                job.setCreatedBy(currentUser);
                job.bills = [];

                // remove the stops so that they are not re-created in the graph insert
                delete job.stops;

                // vendor and driver are not always known when creating an order
                // most orders created will not have a vendor attached, but on the offchance they might?
                if (isUseful(job.vendor))
                {
                    const vendor = await SFAccount.query(trx).modify('byType', 'carrier').findById(job.vendor.guid);
                    if (!vendor)
                    {
                        throw new Error('vendor doesnt exist');
                    }
                    job.graphLink('vendor', vendor);
                }
                else
                {
                    delete job.vendor;
                }

                if (isUseful(job.vendorContact))
                {
                    const contact = await SFContact.query(trx).findById(job.vendorContact.guid);
                    if (!contact)
                    {
                        throw new Error('vendor contact doesnt exist');
                    }
                    job.graphLink('vendorContact', contact);
                }
                else
                {
                    delete job.vendorContact;
                }

                // this is the driver and what not
                if (isUseful(job.vendorAgent))
                {
                    const contact = await SFContact.query(trx).findById(job.vendorAgent.guid);
                    if (!contact)
                    {
                        throw new Error('vendor agent doesnt exist');
                    }
                    job.graphLink('vendorAgent', contact);
                }
                else
                {
                    delete job.vendorAgent;
                }

                if (isUseful(job.dispatcher))
                {
                    const dispatcher = await SFAccount.query(trx).findById(job.dispatcher.guid);
                    if (!dispatcher)
                    {
                        throw new Error('dispatcher ' + JSON.stringify(job.dispatcher) + ' doesnt exist');
                    }
                    job.graphLink('dispatcher', dispatcher);
                }
                else
                {
                    delete job.dispatcher;
                }

                const jobType = jobTypes.find(it => OrderJobType.compare(job, it));
                if (!jobType)
                {
                    throw new Error(`unknown job type ${job.typeId || job.jobType.category + job.jobType.type}`);
                }
                job.graphLink('jobType', jobType);
                job.setIsTransport(jobType);

                const jobStops = jobObj.stops.map((it) =>
                {
                    const stop = OrderStop.fromJson(it);
                    stop.setCreatedBy(currentUser);
                    return stop;
                });

                job.stopLinks = OrderService.buildStopLinksGraph(jobStops, stopsCache, terminals, commodities);
                for (const stopLink of job.stopLinks)
                {
                    stopLink.setCreatedBy(currentUser);
                }
                order.jobs.push(job);
            }

            if (numJobs == 0)
            {
                // no job was provided in the payload, means create the job based on the order, 1 to 1
                const job = OrderJob.fromJson({
                    category: 'transport',
                    type: 'transport',
                    status: 'new'
                });
                const jobType = jobTypes.find(it => OrderJobType.compare(job, it));
                job.graphLink('jobType', jobType);
                job.setIsTransport(jobType);
                job.setCreatedBy(currentUser);

                job.stopLinks = OrderService.buildStopLinksGraph(orderStops, stopsCache, terminals, commodities);

                for (const stopLink of job.stopLinks)
                {
                    stopLink.setCreatedBy(currentUser);
                }

                if (isUseful(orderObj.dispatcher))
                {
                    job.graphLink('dispatcher', orderObj.dispatcher);
                }
                order.jobs.push(job);
            }

            Object.assign(order, {
                status: 'new',
                instructions: orderObj.instructions || 'no instructions provided',
                referenceNumber: orderObj.referenceNumber,
                bol: orderObj.bol,
                bolUrl: orderObj.bolUrl,
                estimatedDistance: orderObj.estimatedDistance,
                isDummy: orderObj.isDummy || false,

                isTender: orderObj.isTender || false,

                // this field cannot be set by the user
                isDeleted: false,

                // this field cannot be set by the user
                isCompleted: false,
                estimatedExpense: orderObj.estimatedExpense || null,
                estimatedRevenue: orderObj.estimatedRevenue || null,
                quotedRevenue: orderObj.quotedRevenue,
                dateExpectedCompleteBy: order.dateExpectedCompleteBy,
                dateCompleted: null,
                invoices: []
            });

            // this part creates all the financial records for this order
            if (orderObj.expenses.length > 0)
            {
                const actors = {
                    'client': order.consignee,
                    'referrer': order.referrer,
                    'salesperson': order.salesperson,
                    'dispatcher': order.dispatcher
                };

                // there can be many vendors
                for (const job of order.jobs)
                {
                    actors[job.index + 'vendor'] = job.vendor;
                }

                // going to use the actor role name as the key for quick storage
                const invoices = {};

                for (const expense of orderObj.expenses)
                {
                    let invoiceKey = expense.account;
                    if (expense.job)
                    {
                        // this is a job expense, there are many vendors so have to make unique key
                        invoiceKey = expense.job + expense.account;
                    }

                    if (!(invoiceKey in invoices))
                    {
                        const invoiceBill = InvoiceBill.fromJson({
                            // mark as invoice only if it is for the client, everyone else is a bill
                            isInvoice: expense.account === 'client',
                            lines: []
                        });
                        invoiceBill.consignee = actors[invoiceKey];
                        invoiceBill.setCreatedBy(currentUser);
                        invoices[invoiceKey] = invoiceBill;
                    }
                    const invoice = invoices[invoiceKey];
                    const lineItem = invoiceLineItems.find((it) => expense.item === it.name && expense.item);
                    if (!lineItem)
                    {
                        throw new Error('Unknown expense item: ' + expense.item);
                    }
                    const invoiceLine = InvoiceLine.fromJson({
                        amount: expense.amount
                    });
                    invoiceLine.graphLink('item', lineItem);
                    invoiceLine.setCreatedBy(currentUser);

                    if (expense.commodity)
                    {
                        invoiceLine.commodity = commodities[expense.commodity];
                    }

                    invoice.lines.push(invoiceLine);
                }

                const orderInvoices = [];
                const jobInvoices = {};
                Object.keys(invoices).map((it) =>
                {
                    const match = it.match(/(.*?)vendor$/);
                    if (match)
                    {
                        if (match[1])
                        {
                            jobInvoices[match[1]] = invoices[it];
                        }
                        else
                        {
                            throw new Error('expense specifies vendor account but not linked to a job');
                        }
                    }
                    else
                    {
                        orderInvoices.push(invoices[it]);
                    }
                });

                for (const jobIndex of Object.keys(jobInvoices))
                {
                    const job = order.jobs.find((it) => it['#id'] === jobIndex);
                    job.bills.push(jobInvoices[jobIndex]);
                }
                order.invoices = orderInvoices;
            }

            order = await Order.query(trx).skipUndefined()
                .insertGraph(order, {
                    allowRefs: true
                }).returning('guid');

            await trx.commit();

            return order;
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    /**
     * Connects all of the stops, terminals and commodities
     * update the terminals and commodities objects
     * @param {OrderStop[]} stops
     * @param {Object.<string, OrderStop>} stopsCache
     * @param {Object.<string, Terminal>} terminalCache
     * @param {Object.<string, Commodity>} commodityCache
     * @returns {OrderStopLink[]}
     */
    static buildStopLinksGraph(stops, stopsCache, terminalCache, commodityCache)
    {
        const stopLinks = [];
        for (const stop of stops)
        {
            // stops are re-usable, jobs and order can share a stop
            // However, the stop links are not reusable and must be created as new
            // commodities are linked to stops via stop links
            // therefore commodities will be removed from the stopPrime which is the reusable stop
            // and the current stop's commodities will be linked with it
            let stopPrime;
            if (!(stop['#id'] in stopsCache))
            {
                // store a copy into the stopCache
                stopPrime = Object.assign({}, stop);

                // all terminals should be in the database already
                // please use findOrCreate and also the terminal resolution method
                stopPrime.terminal = { '#dbRef': terminalCache[stop.terminal].guid };
                stopsCache[stop['#id']] = stopPrime;
            }

            // get a copy of the stop prime from the cache, this will me manipulated
            // so has to be a copy beccause we want to keep the original re-usable
            stopPrime = Object.assign({}, stopsCache[stop['#id']]);

            // the current stops commodities have priority
            const commodities = stop.commodities || stopPrime.commodities || [];

            // stop should only be defined for the first stopLink, after that use the reference
            // also, retain the commodities for use across jobs and what not
            stopsCache[stop['#id']] = { '#ref': stop['#id'], commodities: commodities };

            // commodities is always a list.
            for (let commodity of commodities)
            {

                // because we are using graph insertion, have to remove the commodities
                // commodities are related through te stop link object
                delete stopPrime.commodities;
                const stopLink = OrderStopLink.fromJson({
                    stop: stopPrime
                });

                // commodity can be the index number or string, or it can be an object with fields
                if (typeof commodity === 'object')
                {
                    stopLink.lotNumber = commodity.lotNumber;
                    commodity = commodity['#id'];
                }

                stopLink.commodity = commodityCache[commodity];
                commodityCache[commodity] = { '#ref': commodity };
                stopPrime = Object.assign({}, stopsCache[stop['#id']]);
                stopLinks.push(stopLink);
            }
        }

        return stopLinks;
    }

    static getSTWithin(latitude, longitude, radius)
    {
        const st = Terminal.st;
        return st.dwithin(
            st.geography(st.makePoint('longitude', 'latitude')),
            st.geography(st.makePoint(longitude, latitude)),
            MilesToMeters(radius)
        );
    }

    static addFilterPickups(baseQuery, pickups)
    {
        const doesPickupsHaveElements = pickups?.length > 0 ? true : false;
        return doesPickupsHaveElements ? baseQuery.whereExists(
            Order.relatedQuery('stops').where('stopType', 'pickup').whereExists(
                OrderService.basePickupDeliveryFilterQuery(pickups)
            )
        ) : baseQuery;
    }

    static addFilterDeliveries(baseQuery, deliveries)
    {
        const isDeliveriesEmpty = deliveries?.length > 0 ? false : true;
        if (isDeliveriesEmpty)
            return baseQuery;

        const deliveryQuery = Order.query().select('guid').whereExists(
            Order.relatedQuery('stops').where('stopType', 'delivery').whereExists(
                OrderService.basePickupDeliveryFilterQuery(deliveries)
            )
        );
        return baseQuery.whereIn('guid', deliveryQuery);
    }

    static basePickupDeliveryFilterQuery(coordinatesList)
    {
        return OrderStop.relatedQuery('terminal').where(function ()
        {
            return coordinatesList.reduce((query, coordinates, index) =>
            {
                const getSTWithinFunction = OrderService.getSTWithin(
                    coordinates.latitude,
                    coordinates.longitude,
                    coordinates.radius);

                return index === 0 ? this.where(
                    getSTWithinFunction
                ) : query.orWhere(
                    getSTWithinFunction
                );
            }, undefined);
        }
        );
    }

    static addFilterStatus(baseQuery, statusList)
    {
        const doesStatusListHaveElements = statusList?.length > 0 ? true : false;
        return doesStatusListHaveElements ?
            baseQuery.whereIn('status', statusList) : baseQuery;
    }

    static addFilterCustomer(baseQuery, customerList)
    {
        const doesCustomerListHaveElements = customerList?.length > 0 ? true : false;
        return doesCustomerListHaveElements ?
            baseQuery.whereIn('clientGuid', customerList) : baseQuery;
    }

    static addFilterDispatcher(baseQuery, dispatcherList)
    {
        const doesDispatcherListHaveElements = dispatcherList?.length > 0 ? true : false;
        return doesDispatcherListHaveElements ?
            baseQuery.whereIn('dispatcherGuid', dispatcherList) : baseQuery;
    }

    static addFilterSalesperson(baseQuery, salespersonList)
    {
        const doesSalespersonListHaveElements = salespersonList?.length > 0 ? true : false;
        return doesSalespersonListHaveElements ? baseQuery.whereIn('salespersonGuid', salespersonList) : baseQuery;
    }

    static addFilterDates(baseQuery, dateList)
    {
        const isDateListEmpty = dateList?.length > 0 ? false : true;
        if (isDateListEmpty)
            return baseQuery;

        const datesQuery = dateList.reduce((query, { date, status, comparison }, index) =>
        {
            const comparisonValue = dateFilterComparisonTypes[comparison] || dateFilterComparisonTypes.equal;
            const comparisonDateAndStatus = function ()
            {
                this.whereRaw(`date_created::date ${comparisonValue} ?`, [date]).
                    andWhere('statusId', status);
            };
            return index === 0 ? query.where(comparisonDateAndStatus) : query.orWhere(comparisonDateAndStatus);
        }, Order.relatedQuery('statusLogs').select('orderGuid'));

        return baseQuery.whereIn('guid', datesQuery);
    }

    static addFilterCarrier(baseQuery, carrierList)
    {
        const doesCarrierListHaveElements = carrierList?.length > 0 ? true : false;
        return doesCarrierListHaveElements ?
            baseQuery.whereIn('guid', Order.relatedQuery('jobs').select('orderGuid')
                .whereIn('vendorGuid', carrierList)) : baseQuery;
    }

    static async getComparisonTypesCached()
    {
        if (!cache.has('comparisonTypes'))
        {
            const comparisonTypesDB = await ComparisonType.query().select('label', 'value');
            const comparisonTypes = comparisonTypesDB.reduce((comparisonObj, { label, value }) =>
            {
                comparisonObj[label] = value;
                return comparisonObj;
            }, {});
            cache.set('comparisonTypes', comparisonTypes);
        }
        return cache.get('comparisonTypes');
    }

    static addGraphModifiers(baseQuery, jobCategory = [])
    {
        return baseQuery
            .withGraphFetched({
                client: true,
                clientContact: true,
                salesperson: true,
                dispatcher: true,
                jobs: {
                    loadboardPosts: true,
                    vendor: {
                        rectype: true
                    },
                    jobType: true,
                    stops: {
                        terminal: true,
                        commodities: {
                            commType: true,
                            vehicle: true
                        }
                    }
                }
            })

            /**
             * Is necessary to use modifyGraph on stops and
             * stops.commodities to avoid duplicate rows
             */
            .modifyGraph('client', builder => builder.select(
                'guid', 'name'
            ))
            .modifyGraph('clientContact', builder => builder.select(
                'guid',
                'name',
                'phone_number',
                'email'
            ))
            .modifyGraph('salesperson', builder => builder.select(
                'guid', 'name'
            ))
            .modifyGraph('dispatcher', builder => builder.select(
                'guid', 'name'
            ))
            .modifyGraph('jobs.stops', builder => builder.select(
                'guid',
                'stopType',
                'status',
                'dateScheduledStart',
                'dateScheduledEnd',
                'dateScheduledType',
                'dateRequestedStart',
                'dateRequestedEnd',
                'dateRequestedType'
            ).distinct('guid'))
            .modifyGraph('jobs.stops.commodities', builder => builder.select(
                'guid',
                'damaged',
                'inoperable',
                'identifier',
                'lotNumber',
                'typeId'
            )
                .whereNotNull('jobGuid')
                .distinct(
                    'guid'
                )
            )
            .modifyGraph('jobs.stops.terminal', builder => builder.select(
                'name',
                'guid',
                'street1',
                'street2',
                'state',
                'city',
                'country',
                'zipCode'
            ).distinct())
            .modifyGraph('jobs', builder =>
            {
                const baseBuilder = builder.select(
                    'guid',
                    'number',
                    'estimatedExpense',
                    'estimatedRevenue',
                    'status'
                ).distinct();
                if (jobCategory.length > 0)
                    baseBuilder.whereIn('typeId', OrderJobType.getJobTypesByCategories(jobCategory));
            })
            .modifyGraph('jobs.loadboardPosts', builder => builder.select('loadboard', 'isPosted', 'status').distinct())
            .modifyGraph('jobs.vendor', builder => builder.select('guid', 'name').distinct())
            .modifyGraph('jobs.vendor.rectype', builder => builder.select('name').distinct());

    }

    static addFilterModifiers(baseQuery, filters)
    {
        const { isTender, jobCategory } = filters;
        return baseQuery
            .modify('filterIsTender', isTender)
            .modify('filterJobCategories', jobCategory);
    }

    static addDeliveryAddress(ordersArray)
    {
        return ordersArray.map((order) =>
        {
            const jobsWithDeliveryAddress = order.jobs.map((job) =>
            {
                const { terminal } = job.stops.length > 0 && job.stops.reduce((acumulatorStop, stop) =>
                {
                    return OrderService.getLastDeliveryBetweenStops(acumulatorStop, stop);
                });
                job.deliveryAddress = terminal || null;
                return job;
            });
            order.jobs = jobsWithDeliveryAddress;
            return order;
        });
    }

    static getLastDeliveryBetweenStops(firstStop, secondStop)
    {
        if (secondStop.stopType === 'delivery' && firstStop.sequence < secondStop.sequence)
            return secondStop;
        return firstStop;
    }

    static registerCreateOrderStatusManager(order, currentUser)
    {
        for (const orderJob of order.jobs)
        {
            StatusManagerHandler.registerStatus({
                orderGuid: order.guid,
                userGuid: currentUser,
                jobGuid: orderJob.guid,
                statusId: 1
            });
        }

    }

    /**
     * If terminal, terminalContact or orderContact provided already exists and it is uses in another order,
     * it can not be updated so the GUID is removed from the input and a new object will be created
     */
    static async patchOrder(orderInput, currentUser)
    {
        const trx = await Order.startTransaction();
        const {
            guid,
            dispatcher,
            referrer,
            salesperson,
            client,
            consignee,
            instructions,
            clientContact,
            commodities = [],
            terminals = [],
            stops = [],
            jobs = [],
            expenses = []
        } = orderInput;

        try
        {
            const [
                contactRecordType,
                clientFound,
                commodityTypes,
                jobTypes,
                invoiceLineItems,
                referencesChecked
            ] =
                await Promise.all([
                    clientContact ? RecordType.query(trx).modify('byType', 'contact').modify('byName', 'account contact') : null,
                    client?.guid ? OrderService.findSFClient(client.guid, trx) :
                        undefined,
                    commodities.length > 0 ? CommodityType.query(trx) : null,
                    jobs.length > 0 ? OrderJobType.query(trx) : null,
                    expenses.length > 0 ? InvoiceLineItem.query(trx) : null,
                    OrderService.validateReferencesBeforeUpdate(clientContact, guid, stops, terminals)
                ]);

            /**
             * terminalsChecked and stopsChecked are the same objects from the user input but they may or may not have the GUID
             * prvovided by the user, pending on those references are being use in another orders, that is to now if they
             * have to be created or updated
             */
            const { newOrderContactChecked, terminalsChecked, stopsChecked } = referencesChecked;

            /**
             * Updates or creates OrderContact, Commodities and Terminals
             * Returns an object for Commodities and Terminals to faciliate access
             */
            const { orderContactCreated, commoditiesMap, terminalsMap } = await OrderService.createOrderContactCommoditiesTerminalsMap(
                { contact: newOrderContactChecked, contactRecordType, client: clientFound },
                { commodities, commodityTypes },
                terminalsChecked,
                currentUser, trx
            );

            // Create stop contacts using terminals and return an object to faciliatet access
            const stopContactsGraphMap = OrderService.createStopContactsMap(stopsChecked, terminalsMap, currentUser, trx);

            const stopsToUpdate = OrderService.createStopsGraph(stopsChecked, terminalsMap, stopContactsGraphMap, currentUser);
            const jobsToUpdate = OrderService.createJobsGraph(jobs, jobTypes, currentUser);
            const stopLinksToUpdate = OrderService.updateCreateStopLinks(stopsChecked, jobs, guid, commoditiesMap, currentUser, trx);

            const { orderInvoices, jobs: jobsWithExpensesGraph } = OrderService.updateCreateExpenses(
                expenses, {
                dispatcher,
                referrer,
                salesperson,
                consignee
            }, jobsToUpdate, invoiceLineItems, commoditiesMap, currentUser
            );

            const orderGraph = Order.fromJson({
                guid,
                updatedByGuid: currentUser,
                dispatcherGuid: dispatcher?.guid,
                referrerGuid: referrer?.guid,
                salespersonGuid: salesperson?.guid,
                clientGuid: client?.guid,
                consigneeGuid: consignee?.guid,
                instructions,
                clientContactGuid: orderContactCreated,
                stops: stopsToUpdate,
                jobs: jobsWithExpensesGraph,
                invoices: orderInvoices
            });

            const orderToUpdate = Order.query(trx).skipUndefined().upsertGraphAndFetch(orderGraph, {
                relate: true,
                noDelete: true
            });

            const [orderUpdated] = await Promise.all([orderToUpdate, Promise.all([stopLinksToUpdate])]);

            await trx.commit();
            return orderUpdated;
        }
        catch (error)
        {
            await trx.rollback();
            throw { message: error?.nativeError?.detail || error?.message || error };
        }
    }

    static async validateReferencesBeforeUpdate(orderContact, orderGuid, stops, terminals)
    {

        const orderContacToCheck = orderContact ? OrderService.checkContactReference(orderContact, orderGuid) : undefined;

        // Return new stops with info checked if needs to be updated or created
        const stopsToChecked = [];
        for (const stop of stops)
            stopsToChecked.push(OrderService.getStopsWithInfoChecked(stop, orderGuid));

        // Return new terminals with info checkd if needs to be updated or created
        const terminalsToChecked = [];
        for (const terminal of terminals)
            terminalsToChecked.push(OrderService.getTerminalWithInfoChecked(terminal, orderGuid));

        const [orderChecked, terminalsChecked, stopsChecked] = await Promise.all([orderContacToCheck, Promise.all(terminalsToChecked), Promise.all(stopsToChecked)]);

        let newOrderContactChecked = orderContact;
        if (orderContact && orderChecked === 'createNewContact')
        {
            const { guid: orderContactGuid, ...orderContactData } = orderContact;
            newOrderContactChecked = orderContactData;
        }

        return { newOrderContactChecked, terminalsChecked, stopsChecked };
    }
    static async getStopsWithInfoChecked(stop, orderGuid)
    {
        // If no contact is provided, then this value is not use
        let stopPrimaryContactPromise = 'createNewTerminalContact';
        let stopAlternativeContactPromise = 'createNewTerminalContact';

        if (stop.primaryContact?.guid)
            stopPrimaryContactPromise = OrderService.checkTerminalContacReference(stop.primaryContact.guid, orderGuid);

        if (stop.alternativeContact?.guid)
            stopAlternativeContactPromise = OrderService.checkTerminalContacReference(stop.alternativeContact.guid, orderGuid);

        const [primaryContactResolve, alternativeContactResolve] = await Promise.all([stopPrimaryContactPromise, stopAlternativeContactPromise]);

        const stopChecked = stop;

        // Remove guid if needs to be created
        if (stop.primaryContact && Object.keys(stop.primaryContact).length > 0 && primaryContactResolve === 'createNewTerminalContact')
        {
            const { guid: stopPrimaryContactGuid, ...newStopPrimaryContactData } = stop.primaryContact;
            stopChecked.primaryContact = newStopPrimaryContactData;
        }

        // Remove guid if needs to be created
        if (stop.alternativeContact && Object.keys(stop.alternativeContact).length > 0 && alternativeContactResolve === 'createNewTerminalContact')
        {
            const { guid: stopAlternativeContactGuid, ...newStopAlternativeContactData } = stop.alternativeContact;
            stopChecked.alternativeContact = newStopAlternativeContactData;
        }

        return stopChecked;
    }

    static async getTerminalWithInfoChecked(terminal, orderGuid)
    {
        let terminalPromise = 'createNewTerminal';
        let terminalPrimaryContactPromise = 'createNewTerminalContact';
        let terminalAlternativeContactPromise = 'createNewTerminalContact';

        if (terminal.guid)
            terminalPromise = OrderService.checkTerminalReference(terminal.guid, orderGuid);

        if (terminal.primaryContact?.guid)
            terminalPrimaryContactPromise = OrderService.checkTerminalContacReference(terminal.primaryContact?.guid, orderGuid);

        if (terminal.alternativeContact?.guid)
            terminalAlternativeContactPromise = OrderService.checkTerminalContacReference(terminal.alternativeContact?.guid, orderGuid);

        const [terminalResolve, primaryContactResolve, alternativeContactResolve] = await Promise.all([terminalPromise, terminalPrimaryContactPromise, terminalAlternativeContactPromise]);

        let terminalChecked = terminal;

        // Remove guid if needs to be created
        if (terminalResolve === 'createNewTerminal')
        {
            const { guid: terminalGuid, ...newTerminalData } = terminal;
            terminalChecked = newTerminalData;
        }

        // Remove guid if needs to be created
        if (terminal.primaryContact && Object.keys(terminal.primaryContact).length > 0 && primaryContactResolve === 'createNewTerminalContact')
        {
            const { guid: terminalPrimaryConatctGuid, ...newTerminalPrimaryContactData } = terminal.primaryContact;
            terminalChecked.primaryContact = newTerminalPrimaryContactData;
        }

        // Remove guid if needs to be created
        if (terminal.alternativeContact && Object.keys(terminal.alternativeContact).length > 0 && alternativeContactResolve === 'createNewTerminalContact')
        {
            const { guid: terminalAlternativeConatctGuid, ...newTerminalAlternativeContactData } = terminal.alternativeContact;
            terminalChecked.alternativeContact = newTerminalAlternativeContactData;
        }

        return terminalChecked;
    }

    static async checkContactReference(contact, orderGuid)
    {
        if (!contact.guid)
            return 'createNewContact';

        const searchInOrder = Order.query().count('guid')
            .where('clientContactGuid', contact.guid)
            .andWhereNot('guid', orderGuid);

        const searchInJobs = OrderJob.query().count('orderGuid')
            .where('vendorContactGuid', contact.guid)
            .andWhereNot('orderGuid', orderGuid)
            .orWhere('vendorAgentGuid', contact.guid);

        const [[{ count: countInOrder }], [{ count: countInJobs }]] = await Promise.all([searchInOrder, searchInJobs]);

        if (countInOrder > 0 || countInJobs > 0)
            return 'createNewContact';
        return 'updateContact';
    }

    // If TerminalContact is being reference elseWhere, a new contact will be created
    static async checkTerminalContacReference(terminalContacGuid, orderGuid)
    {
        const [{ count }] = await OrderStopLink.query().count('orderGuid').whereIn(
            'stopGuid', OrderStop.query().select('guid').whereIn(
                'terminalGuid', Terminal.query().select('guid').whereIn(
                    'guid', Contact.query().select('terminalGuid').where('guid', terminalContacGuid)
                )
            )
        ).andWhereNot('orderGuid', orderGuid);

        if (count > 0)
            return 'createNewTerminalContact';
        return 'updateTerminalContact';
    }

    // If Terminal is being reference elseWhere, a new terminal will be created
    static async checkTerminalReference(terminalGuid, orderGuid)
    {
        const [{ count }] = await OrderStopLink.query().count('orderGuid').whereIn(
            'stopGuid', OrderStop.query().select('guid').where('terminalGuid', terminalGuid)
        ).andWhereNot('orderGuid', orderGuid);

        if (count > 0)
            return 'createNewTerminal';
        return 'updateTerminal';
    }

    static async findSFClient(clientGuid, trx)
    {
        return SFAccount.query(trx).modify('byType', 'client').findOne(builder =>
        {
            builder.orWhere('guid', clientGuid)
                .orWhere('salesforce.accounts.sfId', clientGuid);
        });
    }

    static async createSFContact(contactInput, contactRecordType, sfClient, trx)
    {
        if (!contactInput) return;

        const clientContact = SFContact.fromJson(contactInput);
        if (sfClient)
            clientContact.linkAccount(sfClient);
        if (contactRecordType)
            clientContact.linkRecordType(contactRecordType);

        const { guid } = await SFContact.query(trx).skipUndefined().upsertGraphAndFetch(clientContact, {
            relate: true,
            noDelete: true
        });

        return guid;
    }

    static async updateCreateCommodity(commodityInput, commodityTypes, currentUser, trx)
    {
        const { index, ...commodityData } = commodityInput;

        /**
         * If only has 1 property for GUID, it is not necessary to update it because that means
         * the commodity is only being use to reference other elements in the update
         */
        if (Object.keys(commodityData).length === 1)
            return { commodity: commodityData, index };

        const commodity = await OrderService.createCommodityGraph(commodityData, commodityTypes, currentUser, trx);
        const commodityUpserted = await Commodity.query(trx).skipUndefined().upsertGraphAndFetch(commodity, {
            relate: true,
            noDelete: true
        });

        return { commodity: commodityUpserted, index };
    }
    static async createCommodityGraph(commodityInput, commodityTypes, currentUser, trx)
    {
        const commodity = Commodity.fromJson(commodityInput);
        if (!commodityInput.guid)
            commodity.setCreatedBy(currentUser);
        else
            commodity.setUpdatedBy(currentUser);

        if (commodity?.typeId)
        {
            const commType = commodityTypes.find(commodityType => CommodityType.compare(commodity, commodityType));
            if (!commType)
                throw new Error(`Unknown commodity ${commodity.commType?.category} ${commodity.commType?.type}`);

            commodity.graphLink('commType', commType);
        }

        if (commodity.isVehicle())
        {
            const vehicle = await Vehicle.fromJson(commodity.vehicle).findOrCreate(trx);
            commodity.graphLink('vehicle', vehicle);
        }
        return commodity;
    }
    static async updateCreateTerminal(terminalInput, currentUser, trx)
    {
        const { index,
            primaryContact: primaryContactInput,
            alternativeContact: alternativeContactInput,
            ...terminalData
        } = terminalInput;

        /**
         * If only has 1 property for GUID, it is not necessary to update it because that means
         * the terminal is only being use to reference other elements in the update
         */
        if (Object.keys(terminalData).length === 1 && !primaryContactInput && !alternativeContactInput)
            return { terminal: terminalData, index };

        const terminal = Terminal.fromJson(terminalData);
        if (!terminalInput.guid)
            terminal.setCreatedBy(currentUser);
        else
            terminal.setUpdatedBy(currentUser);

        const terminalUpserted = await Terminal.query(trx).skipUndefined().upsertGraphAndFetch(terminal, {
            relate: true,
            noDelete: true
        });

        return { terminal: terminalUpserted, index };
    }

    static createTerminalContactGraph(terminalContactInput, terminal, currentUser)
    {
        const terminalContactGraph = Contact.fromJson(terminalContactInput);
        terminalContactGraph.linkTerminal(terminal);
        if (!terminalContactInput.guid)
            terminalContactGraph.setCreatedBy(currentUser);
        else
            terminalContactGraph.setUpdatedBy(currentUser);

        return terminalContactGraph;
    }
    static createStopContactsMap(stops, terminalsMap, currentUser, trx)
    {
        const stopsWithContacts = stops?.filter(stop => OrderStop.hasContact(stop)) || [];
        const stopsContactsToUpdate = stopsWithContacts?.map(stopWithContact =>
        {
            const terminal = terminalsMap[stopWithContact.terminal];
            return OrderService.updateCreateStopContacts(stopWithContact, terminal, currentUser, trx);
        });

        return stopsContactsToUpdate.reduce((map, { contacts, index }) =>
        {
            map[index] = contacts;
            return map;
        }, {});
    }
    static async createOrderContactCommoditiesTerminalsMap(contactInfo, commoditiesInfo, terminals, currentUser, trx)
    {
        const { contact, contactRecordType, client } = contactInfo;
        const { commodities, commodityTypes } = commoditiesInfo;

        const orderContactTocreate = OrderService.createSFContact(contact, contactRecordType, client, trx);

        const commoditiesToUpdate = commodities?.map(commodity => OrderService.updateCreateCommodity(commodity, commodityTypes, currentUser, trx)) || [];
        const terminalsToUpdate = terminals?.map(terminal => OrderService.updateCreateTerminal(terminal, currentUser, trx)) || [];

        const [orderContactCreated, commoditiesUpdated, terminalsUpdated] = await Promise.all([orderContactTocreate, Promise.all(commoditiesToUpdate), Promise.all(terminalsToUpdate)]);

        // Create maps for commodities and terminal to facilitate use
        const commoditiesMap = commoditiesUpdated.reduce((map, { commodity, index }) =>
        {
            map[index] = commodity;
            return map;
        }, {});
        const terminalsMap = terminalsUpdated.reduce((map, { terminal, index }) =>
        {
            map[index] = terminal;
            return map;
        }, {});

        return { orderContactCreated, commoditiesMap, terminalsMap };
    }

    static updateCreateStopContacts(stopWithContactInput, terminal, currentUser)
    {
        const { primaryContact, alternativeContact, index } = stopWithContactInput;

        const primaryContactGraph = primaryContact && OrderService.createTerminalContactGraph(primaryContact, terminal, currentUser);
        const alternativeContactGraph = alternativeContact && OrderService.createTerminalContactGraph(alternativeContact, terminal, currentUser);

        return {
            index,
            contacts: {
                primaryContact: primaryContactGraph,
                alternativeContact: alternativeContactGraph
            }
        };
    }

    static createStopsGraph(stopsInput, terminalsMap, stopContactsMap, currentUser)
    {
        return stopsInput?.map(stop =>
        {
            // commodities, primaryContact, alternativeContact are remove from the rest of stopData because they are not use in this step
            const { index: stopIndex,
                terminal: terminalIndex,
                // eslint-disable-next-line no-unused-vars
                primaryContact: primaryContactDataNotUseHere,
                // eslint-disable-next-line no-unused-vars
                alternativeContact: alternativeContactDataNotUseHere,
                // eslint-disable-next-line no-unused-vars
                commodities: commoditiesDataNotUseHere,
                ...stopData
            } = stop;

            const terminalGuid = terminalsMap[terminalIndex]?.guid;
            const stopContacts = stopContactsMap[stopIndex];
            return OrderService.createSingleStopGraph(stopData, terminalGuid, stopContacts, currentUser);
        }) || [];
    }

    static createSingleStopGraph(stopInput, terminalGuid, contacts = {}, currentUser)
    {
        const { primaryContact, alternativeContact } = contacts;
        const stop = OrderStop.fromJson({ ...stopInput, terminalGuid });
        stop.setUpdatedBy(currentUser);

        stop.primaryContact = primaryContact;
        stop.alternativeContact = alternativeContact;
        return stop;
    }
    static createJobsGraph(jobsInput, jobTypes, currentUser)
    {
        return jobsInput?.map(job =>
        {
            // eslint-disable-next-line no-unused-vars
            const { stops: stopsDataNotUseHere, ...newJobData } = job;
            return OrderService.createSingleJobGraph(newJobData, jobTypes, currentUser);
        }) || [];
    }

    static createSingleJobGraph(jobInput, jobTypes, currentUser)
    {
        const jobGraph = OrderJob.fromJson(jobInput);
        if (jobGraph?.jobType?.category && jobGraph?.jobType?.type)
        {
            const jobType = jobTypes?.find(jobType => OrderJobType.compare(jobGraph, jobType));
            if (!jobType)
            {
                throw new Error(`unknown job type ${jobGraph.typeId || jobGraph.jobType.category + jobGraph.jobType.type}`);
            }
            jobGraph.graphLink('jobType', jobType);
            jobGraph.setIsTransport(jobType);
        }
        jobGraph.setUpdatedBy(currentUser);
        return jobGraph;
    }

    /**
     * Insert or update of stopLInks was done manually because upsert wasn't working for stopLinks graph
     * so the process was to find if the stoplink if exists, if it does udpate it, if not, create it
     * TODO Check if this can be redo using upsert
     */
    static async updateCreateStopLinks(stopsFromInput, jobs, orderGuid, commoditiesMap, currentUser, trx)
    {
        const stopLinksByJob = OrderService.createJobStopLinksObjects(jobs, stopsFromInput, commoditiesMap);
        const stopLinksByStops = OrderService.createStopLinksObjects(stopsFromInput, commoditiesMap, orderGuid);
        return [...stopLinksByStops, ...stopLinksByJob].map(stopLinkData => OrderService.updateOrCreateStopLink(stopLinkData, currentUser, trx));
    }

    static async updateOrCreateStopLink(stopLinkData, currentUser, trx)
    {
        const { orderGuid, commodityGuid, stopGuid, lotNumber } = stopLinkData;
        const stopLinkFound = await OrderStopLink.query(trx).findOne({
            orderGuid,
            stopGuid,
            commodityGuid
        });

        if (stopLinkFound)
            return await OrderStopLink.query(trx).patchAndFetchById([orderGuid, stopGuid, commodityGuid], { lotNumber, updatedByGuid: currentUser });
        else
        {
            const stopLinkToInsert = OrderStopLink.fromJson(stopLinkData);
            stopLinkToInsert.setCreatedBy(currentUser);
            return await OrderStopLink.query(trx).insert(stopLinkToInsert);
        }
    }

    // This methode is similar to createJobStopLinksObjects, but it was separated to facilitate readability
    static createStopLinksObjects(stops, commoditiesMap, orderGuid)
    {
        return stops?.reduce((stopLinks, { commodities: stopCommodities, guid: stopGuid }) =>
        {
            const stopLinksByCommodities = stopCommodities?.reduce((stopLinks, { index: commodityIndex, ...stopLinkData }) =>
            {
                const commodityGuid = commoditiesMap[commodityIndex].guid;

                stopLinks.push({ stopGuid, commodityGuid, orderGuid, jobGuid: null, ...stopLinkData });
                return stopLinks;

            }, []) || [];
            stopLinks.push(...stopLinksByCommodities);
            return stopLinks;

        }, []);
    }

    // This methode is similar to createStopLinksObjects, but it was separated to facilitate readability
    static createJobStopLinksObjects(jobs, stopsFromInput, commoditiesMap)
    {
        return jobs?.reduce((stopLinks, { guid: jobGuid, stops: jobStops }) =>
        {
            const stopLinksByJob = jobStops?.reduce((stopLinks, { index: stopIndex, commodities: jobStopCommodities }) =>
            {
                const stopLinksByStop = jobStopCommodities?.reduce((stopLinks, { index: commodityIndex, ...stopLinkData }) =>
                {
                    const commodityGuid = commoditiesMap[commodityIndex].guid;
                    const stopGuid = stopsFromInput.find(stop => stop.index === stopIndex)?.guid;

                    stopLinks.push({ stopGuid, commodityGuid, orderGuid: null, jobGuid, ...stopLinkData });
                    return stopLinks;

                }, []) || [];
                stopLinks.push(...stopLinksByStop);
                return stopLinks;

            }, []) || [];
            stopLinks.push(...stopLinksByJob);
            return stopLinks;

        }, []) || [];
    }

    static updateCreateExpenses(expenses, orderContacts, jobs, invoiceLineItems, commoditiesMap, currentUser)
    {
        const { consignee, referrer, salesperson, dispatcher } = orderContacts;
        const actors = {
            'client': consignee,
            'referrer': referrer,
            'salesperson': salesperson,
            'dispatcher': dispatcher
        };

        // there can be many vendors
        for (const job of jobs)
        {
            actors[job.index + 'vendor'] = job.vendor;
        }

        // going to use the actor role name as the key for quick storage
        const invoices = {};

        for (const expense of expenses)
        {
            let invoiceKey = expense.account;
            if (expense.job)
            {
                // this is a job expense, there are many vendors so have to make unique key
                invoiceKey = expense.job + expense.account;
            }

            if (!(invoiceKey in invoices))
            {
                const invoiceBill = InvoiceBill.fromJson({
                    // mark as invoice only if it is for the client, everyone else is a bill
                    isInvoice: expense.account === 'client',
                    lines: []
                });
                invoiceBill.consignee = actors[invoiceKey];
                invoiceBill.setCreatedBy(currentUser);
                invoices[invoiceKey] = invoiceBill;
            }
            const invoice = invoices[invoiceKey];
            const lineItem = invoiceLineItems.find(lineItem => expense.item === lineItem.name && expense.item);

            if (!lineItem)
                throw new Error('Unknown expense item: ' + expense.item);

            const invoiceLine = InvoiceLine.fromJson({
                amount: expense.amount
            });
            invoiceLine.graphLink('item', lineItem);

            if (expense.guid)
            {
                invoiceLine.setUpdatedBy(currentUser);
                invoiceLine.guid = expense.guid;
            }
            else
                invoiceLine.setCreatedBy(currentUser);

            if (expense.commodity)
            {
                const commodity = commoditiesMap[expense.commodity];
                invoiceLine.commodityGuid = commodity.guid;
            }

            invoice.lines.push(invoiceLine);
        }

        const orderInvoices = [];
        const jobInvoices = {};
        Object.keys(invoices).map((it) =>
        {
            const match = it.match(/(.*?)vendor$/);
            if (match)
            {
                if (match[1])
                    jobInvoices[match[1]] = invoices[it];
                else
                    throw new Error('expense specifies vendor account but not linked to a job');

            }
            else
                orderInvoices.push(invoices[it]);

        });

        for (const jobIndex of Object.keys(jobInvoices))
        {
            const job = jobs.find(job => job['#id'] === jobIndex);
            job.bills ? null : job.bills = [];
            job.bills.push(jobInvoices[jobIndex]);
        }

        return { orderInvoices, jobs };
    }
}

module.exports = OrderService;
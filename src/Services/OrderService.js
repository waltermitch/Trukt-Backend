const { MissingDataError, DataConflictError, NotFoundError, ValidationError } = require('../ErrorHandling/Exceptions');
const ActivityManagerService = require('./ActivityManagerService');
const OrderJobService = require('../Services/OrderJobService');
const { BulkResponse } = require('../ErrorHandling/Responses');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const ComparisonType = require('../Models/ComparisonType');
const OrderStopLink = require('../Models/OrderStopLink');
const CommodityType = require('../Models/CommodityType');
const OrderJobType = require('../Models/OrderJobType');
const SFRecordType = require('../Models/SFRecordType');
const ActivityLog = require('../Models/ActivityLogs');
const Contact = require('../Models/TerminalContact');
const InvoiceBill = require('../Models/InvoiceBill');
const InvoiceLine = require('../Models/InvoiceLine');
const TerminalService = require('./TerminalService');
const emitter = require('../EventListeners/index');
const SFAccount = require('../Models/SFAccount');
const OrderStop = require('../Models/OrderStop');
const SFContact = require('../Models/SFContact');
const Commodity = require('../Models/Commodity');
const { MilesToMeters } = require('./../Utils');
const OrderJob = require('../Models/OrderJob');
const Terminal = require('../Models/Terminal');
const Vehicle = require('../Models/Vehicle');
const Invoice = require('../Models/Invoice');
const Order = require('../Models/Order');
const NodeCache = require('node-cache');
const currency = require('currency.js');
const User = require('../Models/User');
const Bill = require('../Models/Bill');
const { DateTime } = require('luxon');
const { v4: uuid } = require('uuid');
const axios = require('axios');
const https = require('https');
const R = require('ramda');

// this is the apora that will hold the falling down requirments above.

const isUseful = R.compose(R.not, R.anyPass([R.isEmpty, R.isNil]));
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 3600 });

let dateFilterComparisonTypes;

const logicAppInstance = axios.create({
    baseURL: process.env.AZURE_LOGICAPP_BASEURL,
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: { 'Content-Type': 'application/json' }
});

class OrderService
{
    // filter status map
    static statusMap = {
        'new': 'statusNew',
        'on hold': 'statusOnHold',
        'tender': 'statusTender',
        'completed': 'statusComplete',
        'canceled': 'statusCanceled',
        'deleted': 'statusDeleted',
        'dispatched': 'statusDispatched',
        'posted': 'statusPosted',
        'pending': 'statusPending',
        'declined': 'statusDeclined',
        'request': 'statusRequests',
        'picked up': 'statusPickedUp',
        'delivered': 'statusDelivered',
        'ready': 'statusReady',
        'active': 'statusActive',
        'in progress': 'statusInProgress'
    }

    static async getOrders(
        {
            pickup,
            delivery,
            status,
            customer,
            carrier,
            dispatcher,
            salesperson,
            dates,
            jobCategory,
            accountingType
        },
        page,
        rowCount,
        sort,
        globalSearch
    )
    {
        dateFilterComparisonTypes = dates && (await OrderService.getComparisonTypesCached());

        // beggining of base query for jobs with return of specific fields
        const baseOrderQuery = OrderJob.query()
            .alias('job')
            .select(OrderJob.fetch.getOrdersPayload)
            .page(page, rowCount);

        // if global search is enabled
        // global search includes job#, customerName, customerContactName, customerContactEmail, Vin, lot, carrierName
        if (globalSearch?.query)
            baseOrderQuery.modify('globalSearch', globalSearch.query);

        const queryFilterPickup = OrderService.addFilterPickups(
            baseOrderQuery,
            pickup
        );

        OrderService.addFilterDeliveries(
            queryFilterPickup,
            delivery
        );

        baseOrderQuery.where(baseQueryAnd =>
        {
            for (const s of status)
            {
                baseQueryAnd.orWhere(baseQueryOr =>
                {
                    if (s in OrderService.statusMap)
                        baseQueryOr.modify(OrderService.statusMap[s]);
                });
            }
        });

        const queryFilterDates = OrderService.addFilterDates(
            baseOrderQuery,
            dates
        );

        const queryAllFilters = OrderService.addFilterModifiers(
            queryFilterDates,
            { jobCategory, sort, accountingType, dispatcher, customer, salesperson, carrier }
        );

        const queryWithGraphModifiers = OrderService.addGraphModifiers(queryAllFilters);

        const { total, results } = await queryWithGraphModifiers;

        const ordersWithDeliveryAddress =
        {
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
                order = await Order.fetchGraph(order, Order.fetch.payload, {
                    transaction: trx,
                    skipFetched: true
                }).skipUndefined();

                await trx.commit();

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

                // set consignee (this is temporart until we move consignee out of order in UI)
                if (order?.invoices?.[0]?.consignee)
                    order.consignee = order.invoices[0].consignee;

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

                        for (const commodity of stop.commodities)
                        {
                            const { amount, link = [] } = job.findInvocieLineByCommodityAndType(commodity.guid, 1);
                            commodity.expense = amount || null;
                            commodity.revenue = link[0]?.amount || null;
                        }
                    }

                    delete job.bills;
                }

                // assign unique terminals to the top level
                order.terminals = Object.values(terminalCache);

                // check to see if there are client notes assigned so we don't bother querying
                // on something that may not exist
                if (order.clientNotes?.updatedByGuid)
                {
                    // getting the user details so we can show the note users details
                    const user = await User.query().findById(
                        order.clientNotes.updatedByGuid
                    );
                    Object.assign(order?.clientNotes || {}, {
                        updatedBy: {
                            userName: user.name,
                            email: user.email
                        }
                    });
                }
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
            // client is required and always should be checked.
            // vehicles are not checked and are created or found
            // referrerRebate should be check in case it is pass but no referrer is send
            const dataCheck = { client: true, vehicles: false, terminals: false, referrerRebate: true };

            // order object will be used to link OrderStopLink from the job
            const order = Order.fromJson({
                // generate a uuid for the order to reduce the number of http requests to the database
                // also the uuid is needed for linking the job's OrderStopLinks with the Order guid.
                '#id': uuid(),

                // these fields cannot be set by the user
                status: 'new',
                isDeleted: false,
                isComplete: false,
                dateCompleted: null,
                invoices: [],

                // these fields maybe set by the user
                instructions: orderObj.instructions || 'no instructions provided',
                referenceNumber: orderObj.referenceNumber,
                bol: orderObj.bol,
                bolUrl: orderObj.bolUrl,
                estimatedDistance: orderObj.estimatedDistance,
                isDummy: orderObj.isDummy || false,
                isTender: orderObj.isTender || false,
                quotedRevenue: orderObj.quotedRevenue,
                dateExpectedCompleteBy: orderObj.dateExpectedCompleteBy,
                createdByGuid: currentUser
            });

            // DO NOT change the ordering of these promises, it will mess up _dataCheck and other destructured code
            let orderInfoPromises = [];
            orderInfoPromises.push(SFAccount.query(trx).modify('client', orderObj.client.guid));
            orderInfoPromises.push(dataCheck.consignee = isUseful(orderObj.consignee) ? SFAccount.query(trx).modify('bySomeId', orderObj.consignee.guid) : null);
            orderInfoPromises.push(dataCheck.dispatcher = isUseful(orderObj.dispatcher) ? User.query(trx).findById(orderObj.dispatcher.guid) : null);
            orderInfoPromises.push(dataCheck.referrer = isUseful(orderObj.referrer) ? SFAccount.query(trx).findById(orderObj.referrer.guid) : null);
            orderInfoPromises.push(dataCheck.salesperson = isUseful(orderObj.salesperson) ? SFAccount.query(trx).findById(orderObj.salesperson.guid) : null);
            orderInfoPromises.push(Promise.all(orderObj.terminals.map(t => TerminalService.findOrCreate(t, currentUser, trx, { isTender: order?.isTender }))));

            const commodities = orderObj.commodities.map(com => Commodity.fromJson(com));
            orderInfoPromises.push(Promise.all(commodities.map(com => isUseful(com) && com.isVehicle() ? Vehicle.fromJson(com.vehicle).findOrCreate(trx) : null)));
            orderInfoPromises.push(dataCheck.referrerRebate = orderObj?.referrerRebate && !orderObj?.referrer?.guid ? Promise.reject(new MissingDataError('referrerRebate price can not be set without referrer')) : null);

            for (const job of orderObj.jobs)
            {
                const jobPromises = [];
                const jobDataCheck = {};
                jobPromises.push(jobDataCheck.vendor = isUseful(job.vendor) ? SFAccount.query(trx).modify('byType', 'carrier').findById(job.vendor.guid) : null);
            }

            // use trx (transaction) because none of the data should be left in the database if any of it fails
            const [
                {
                    contactRecordType,
                    commTypes,
                    jobTypes
                },
                orderInformation

                // jobInformation <- this is commented out because nobody is using it, no need to waste time fetching it
            ] = await Promise.all([OrderService.buildCache(), Promise.all(orderInfoPromises)]);

            // checks if the data that was provided in the payload was found in the database
            // will throw an error if it wasn't found.
            OrderService._dataCheck(dataCheck, orderInformation);

            // DO NOT change this ordering of models
            const [
                client,
                consignee,
                dispatcher,
                referrer,
                salesperson,
                terminals,
                vehicles
            ] = orderInformation;

            order.graphLink('client', client);
            order.graphLink('referrer', referrer);
            order.graphLink('salesperson', salesperson);
            order.graphLink('dispatcher', dispatcher);

            orderInfoPromises = [];

            if (isUseful(orderObj.clientContact))
            {
                const clientContact = SFContact.fromJson(orderObj.clientContact);
                clientContact.linkAccount(client);
                clientContact.linkRecordType(contactRecordType);
                orderInfoPromises.push(clientContact.findOrCreate(trx));
            }
            else
            {
                orderInfoPromises.push(null);
            }

            // terminal cache will be used for linking stop contacts to terminals
            // need to map all the terminals so that they are reuseable
            const terminalsCache = terminals.reduce((cache, term, i) =>
            {
                // need to set the index because the terminals are pulled from the database
                // the index will be used to tie them together to the OrderStops
                const terminalIndex = term['#id'];

                // store to use as a cache for later
                cache[terminalIndex] = terminals[i];
                return cache;
            }, {});

            /**
             * create promises for each contact that the stops will be using.
             * Creates an array of stopContacts that contains an array of contacts, were the first position is the first position of OrderStop.contactTypes
             * The downside is that relie on Promise.all array order, but we can resolve all contacts at the same time
             */
            const stopContactsInOrder = orderObj.stops.map(stop =>
            {
                const terminal = terminalsCache[stop.terminal];
                const contactsForStopInOrder = [];
                for (const contactType of OrderStop.contactTypes)
                {
                    let contactToCreate = null;
                    if (stop[contactType])
                    {
                        const contact = Contact.fromJson(stop[contactType]);
                        contact.linkTerminal(terminal);
                        contact.setCreatedBy(currentUser);
                        contactToCreate = contact.findOrCreate(trx);
                    }
                    contactsForStopInOrder.push(contactToCreate);
                }

                return Promise.all(contactsForStopInOrder);
            });

            orderInfoPromises.push(Promise.all(stopContactsInOrder));

            // commodities are reused in the system
            const commodityCache = orderObj.commodities.reduce((cache, com, i) =>
            {
                const commodity = Commodity.fromJson(com);
                const commType = commTypes.find((it) => CommodityType.compare(commodity, it));

                if (!commType)
                {
                    const commTypeStr = commodity.typeId ? commodity.typeId : `${commodity.commType?.category} ${commodity.commType?.type}`;
                    throw new ValidationError(`Unknown commodity type: ${commTypeStr}`);
                }

                commodity.graphLink('commType', commType);
                commodity.setCreatedBy(currentUser);
                commodity.setDefaultValues(order?.isTender);

                // check to see if the commodity is a vehicle (it would have been created or found in the database)
                if (vehicles[i])
                    commodity.graphLink('vehicle', vehicles[i]);

                cache[com['#id']] = commodity;

                return cache;
            }, {});

            const [clientContact, stopContactsCreated] = await Promise.all(orderInfoPromises);

            order.graphLink('clientContact', clientContact);

            // orders will have defined all the stops that are needed to be completed
            // for this order to be classified as completed as well
            // however, jobs will also use these stops and will have their own stops that will
            // not appear in the orders
            const stopsCache = {};

            const orderStops = orderObj.stops.map((stopObj =>
            {
                const stop = OrderStop.fromJson(stopObj);
                stop.setCreatedBy(currentUser);
                const stopContacts = stopContactsCreated.shift();
                for (const contactType of OrderStop.contactTypes)
                {
                    if (stopContacts)
                        stop.graphLink(contactType, stopContacts.shift());
                }
                return stop;
            }));

            order.stopLinks = OrderService.buildStopLinksGraph(
                orderStops,
                stopsCache,
                terminalsCache,
                commodityCache
            );

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
                job.setDefaultValues(order?.isTender);
                job.bills = [];

                // remove the stops so that they are not re-created in the graph insert
                delete job.stops;

                const [
                    jobVendor,
                    jobVendorContact,
                    jobVendorAgent,
                    jobDispatcher
                ] = await Promise.all([
                    isUseful(job.vendor) ? SFAccount.query(trx).modify('byType', 'carrier').findById(job.vendor.guid) : delete job.vendor,
                    isUseful(job.vendorContact) ? SFContact.query(trx).findById(job.vendorContact.guid) : delete job.vendorContact,
                    isUseful(job.vendorAgent) ? SFContact.query(trx).findById(job.vendorAgent.guid) : delete job.vendorAgent,
                    isUseful(job.dispatcher) ? User.query(trx).findById(job.dispatcher.guid) : delete job.dispatcher
                ]);

                // vendor and driver are not always known when creating an order
                // most orders created will not have a vendor attached, but on the offchance they might?
                if (isUseful(job.vendor))
                {
                    if (!jobVendor)
                        throw new NotFoundError('Vendor doesnt exist');

                    job.graphLink('vendor', jobVendor);
                }

                if (isUseful(job.vendorContact))
                {
                    if (!jobVendorContact)
                        throw new NotFoundError('Vendor contact doesnt exist');

                    job.graphLink('vendorContact', jobVendorContact);
                }

                // this is the driver and what not
                if (isUseful(job.vendorAgent))
                {
                    if (!jobVendorAgent)
                        throw new NotFoundError('Vendor agent doesnt exist');

                    job.graphLink('vendorAgent', jobVendorAgent);
                }

                if (isUseful(job.dispatcher))
                {
                    if (!jobDispatcher)
                        throw new NotFoundError(`Dispatcher ${job.dispatcher.guid} doesnt exist`);

                    job.graphLink('dispatcher', jobDispatcher);
                }

                const jobType = jobTypes.find((it) =>
                    OrderJobType.compare(job, it)
                );
                if (!jobType)
                {
                    throw new ValidationError(
                        `unknown job type ${job.typeId ||
                        job.jobType.category + job.jobType.type
                        }`
                    );
                }
                job.graphLink('jobType', jobType);
                job.setIsTransport(jobType);

                const jobStops = jobObj.stops.map((it) =>
                {
                    const stop = OrderStop.fromJson(it);
                    stop.setCreatedBy(currentUser);
                    return stop;
                });

                job.stopLinks = OrderService.buildStopLinksGraph(
                    jobStops,
                    stopsCache,
                    terminalsCache,
                    commodityCache
                );
                for (const stopLink of job.stopLinks)
                {
                    stopLink.setCreatedBy(currentUser);
                    stopLink.order = { '#ref': order['#id'] };
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
                const jobType = jobTypes.find((it) =>
                    OrderJobType.compare(job, it)
                );
                job.graphLink('jobType', jobType);
                job.setIsTransport(jobType);
                job.setCreatedBy(currentUser);

                job.stopLinks = OrderService.buildStopLinksGraph(
                    orderStops,
                    stopsCache,
                    terminalsCache,
                    commodityCache
                );

                for (const stopLink of job.stopLinks)
                {
                    stopLink.setCreatedBy(currentUser);
                    stopLink.order = { '#ref': order['#id'] };
                }

                if (isUseful(orderObj.dispatcher))
                {
                    job.graphLink('dispatcher', orderObj.dispatcher);
                }
                order.jobs.push(job);
            }

            order.setClientNote(orderObj.clientNotes?.note, currentUser);

            // this part creates all the financial records for this order
            const orderInvoices = [];
            const orderJobs = [];

            for (const job of order.jobs)
            {
                let expense = currency(0);
                let revenue = currency(0);

                // Take out commodities from jobs cause that elements can't be save as it comes
                const { commodities: jobInputCommodities, ...jobData } = job;
                const jobBillLines = jobInputCommodities?.map(commodity =>
                {
                    const itemId = 1;
                    const commodityReference = commodityCache[commodity['#id']];
                    const commodityRevenue = commodity.revenue;
                    const commodityExpense = commodity.expense;

                    expense = expense.add(currency(commodityExpense));
                    revenue = revenue.add(currency(commodityRevenue));

                    const orderInvoiceLine = OrderService.createInvoiceLineGraph(
                        commodityRevenue,
                        itemId,
                        currentUser,
                        commodityReference
                    );
                    orderInvoices.push(orderInvoiceLine);

                    const jobInvoiceLine = OrderService.createInvoiceLineGraph(
                        commodityExpense,
                        itemId,
                        currentUser,
                        commodityReference
                    );
                    jobInvoiceLine.link = { '#ref': orderInvoiceLine['#id'] };

                    return jobInvoiceLine;
                });

                if (jobBillLines)
                    jobData.bills = OrderService.createInvoiceBillGraph(jobBillLines, false, currentUser, null);

                /**
                * For order creation. given that all invoices are "transport", the actual and estimated expense and revenue have the same values
                */
                jobData.estimatedExpense = expense.value;
                jobData.actualExpense = expense.value;

                jobData.estimatedRevenue = revenue.value;
                jobData.actualRevenue = revenue.value;

                orderJobs.push(jobData);
            }

            const referrerInvoice = OrderService.createReferrerRebateInvoice(orderObj?.referrerRebate, referrer, currentUser);

            order.jobs = orderJobs;
            order.invoices = [OrderService.createInvoiceBillGraph(orderInvoices, true, currentUser, consignee), ...referrerInvoice];

            const orderCreated = await Order.query(trx)
                .skipUndefined()
                .insertGraph(order, { allowRefs: true });

            await trx.commit();
            return orderCreated;
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static createReferrerRebateInvoice(referrerRebateAmount, referrer, currentUser)
    {
        const referrerInvoice = [];
        if (referrer)
        {
            const referrerRebateInvoiceAmount = referrerRebateAmount || '0.00';

            // This id is static, it is always 7 for "rebate" invoices
            const referrerRebateItemId = 7;
            const referrerRebateLine = OrderService.createInvoiceLineGraph(referrerRebateInvoiceAmount, referrerRebateItemId, currentUser, null);

            referrerInvoice.push(OrderService.createInvoiceBillGraph([referrerRebateLine], true, currentUser, referrer));
        }
        return referrerInvoice;
    }

    static createInvoiceLineGraph(amount, itemId, currentUser, commodity)
    {
        const jobBillLine = InvoiceLine.fromJson({
            amount,
            itemId,
            commodity
        });

        jobBillLine['#id'] = uuid();
        jobBillLine.setCreatedBy(currentUser);

        return jobBillLine;
    }

    static createInvoiceBillGraph(lines, isInvoice, currentUser, consignee)
    {
        const bill = InvoiceBill.fromJson({
            isInvoice,
            lines: [],
            consigneeGuid: consignee?.guid
        });

        bill.setCreatedBy(currentUser);
        bill.lines.push(...lines);

        return bill;
    }

    /**
     * Checks the data that was returned form the database
     * If the dataCheck object has a key and it is true, it will check for the dataRecs if it is not null
     * @param {Object<string, boolean>} dataCheck object with names that can be alphabetically mapped
     * @param {BaseModel[]} dataRecs list of model instances, must be in alphabetical order
     */
    static _dataCheck(dataCheck, dataRecs)
    {
        const keys = Object.keys(dataCheck);
        keys.sort();
        if (keys.length != dataRecs.length)
        {
            throw new ValidationError('_dataCheck dataCheck keys length do not match the dataRecs length');
        }

        for (const [i, key] of keys.entries())
        {
            if (dataCheck[key] && !dataRecs[i])
            {
                throw new NotFoundError(`${key} record doesn't exist.`);
            }
        }
    }

    static async calculatedDistances(orderGuid)
    {
        // relations object for none repetitive code
        const stopRelationObj = {
            $modify: ['distinctAllData'],
            terminal: true
        };

        // TODO:add functionality to push to error DB when transaction fails

        // start transaction to update distances
        await Order.transaction(async (trx) =>
        {
            // get OrderStops and JobStops from database Fancy smancy queries
            const order = await Order.query(trx)
                .withGraphJoined({
                    jobs: { stops: stopRelationObj },
                    stops: stopRelationObj
                })
                .findById(orderGuid);

            // array for transaction promises
            const patchPromises = [];

            let orderCounted = false;
            for (const object of [order, ...order.jobs])
            {
                // logic to handle order vs jobs model
                let model;
                if (orderCounted)
                {
                    model = OrderJob;
                }
                else
                {
                    model = Order;
                    orderCounted = true;
                }

                // pushing distance call and update into array
                patchPromises.push(
                    TerminalService.calculateTotalDistance(object.stops).then(async (distance) =>
                    {
                        await model.query(trx).patch({ distance }).findById(object.guid);
                    })
                );
            }

            // execute all promises
            await Promise.all(patchPromises);
        });

        return;
    }

    static async validateStopsBeforeUpdate(oldOrder, newOrder)
    {
        // get OrderStops and JobStops from database Fancy smancy queries
        const updatedOrder = await Order.query().skipUndefined().withGraphJoined(Order.fetch.stopsPayload).findById(newOrder.guid);

        // array to store promises for distnace update
        const patchArray = [];

        // check if new order stops have been added
        if (oldOrder.stops.length != updatedOrder.stops.length)
        {
            // calculate distance and push update distance into an array
            patchArray.push(TerminalService.calculateTotalDistance(updatedOrder.stops).then(async (distance) =>
            {
                await Order.query().patch({ distance }).findById(updatedOrder.guid);
            }));
        }
        else
        {
            // when stop address has been updated
            for (let i = 0; i < updatedOrder.stops.length; i++)
            {
                // removing fields that will trigger unnecessary work
                const oldTerminal = oldOrder.stops[i].terminal;
                const newTerminal = updatedOrder.stops[i].terminal;
                delete newTerminal.dateUpdated;
                delete oldTerminal.dateUpdated;
                delete newTerminal.updatedByGuid;
                delete oldTerminal.updatedByGuid;

                // if terminal objects are not the same calculate distance
                if (!R.equals(newTerminal, oldTerminal))
                {
                    // calculate distance of all stops and push update distance into an array
                    patchArray.push(TerminalService.calculateTotalDistance(updatedOrder.stops).then(async (distance) =>
                    {
                        await Order.query().patch({ distance }).findById(updatedOrder.guid);
                    }));

                    // break to not do repetitive work.
                    break;
                }
            }
        }

        // loop through jobs array
        for (let i = 0; i < updatedOrder.jobs.length; i++)
        {
            // for sanity sake
            const currentJob = updatedOrder.jobs[i];
            const oldJob = oldOrder.jobs[i];

            // if new terminals were added
            if (currentJob.stops.length != oldOrder.jobs[i].stops.length)
            {
                // calculate distance of all stops and push update distance into an array
                patchArray.push(TerminalService.calculateTotalDistance(currentJob.stops).then(async (distance) =>
                {
                    await OrderJob.query().patch({ distance }).findById(currentJob.guid);
                }));
            }
            else
            {
                // if addresses have been changed loop through job stops terminals
                for (let j = 0; j < currentJob.stops.length; j++)
                {
                    // removing fields that will trigger unnecessary work
                    const newTerminal = currentJob.stops[j].terminal;
                    const oldTerminal = oldJob.stops[j].terminal;
                    delete newTerminal.dateUpdated;
                    delete oldTerminal.dateUpdated;
                    delete newTerminal.updatedByGuid;
                    delete oldTerminal.updatedByGuid;

                    // comparing terminal object to be the same as before if not trigger an update
                    if (!R.equals(newTerminal, oldTerminal))
                    {
                        // calculate distance of all stops and push update distance into an array
                        patchArray.push(TerminalService.calculateTotalDistance(currentJob.stops).then(async (distance) =>
                        {
                            await OrderJob.query().patch({ distance }).findById(currentJob.guid);
                        }));

                        // break to not do repetitive work.
                        break;
                    }
                }
            }
        }

        // handle array of updates
        if (patchArray.length != 0)
        {
            await Promise.allSettled(patchArray);
        }
    }

    /**
     * Method is to accepts load tenders. Validates, sends requests and updates the database in our system.
     * @param {string []} orderGuids
     * @param {string} currentUser
     * @returns {BulkResponse} BulkResponse object
     */
    static async acceptLoadTenders(orderGuids, currentUser)
    {
        // valdiate orders for accepting or declineing
        const { successfulTenders, failedTenders } = await OrderService.validateLoadTendersState(orderGuids);

        // send request to logic
        const { goodOrders, failedOrders } = await OrderService.handleLoadTendersAPICall('accept', successfulTenders, null);

        failedTenders.push(...failedOrders);

        const bulkResponse = new BulkResponse();

        // add errored orders to body message
        for (const order of failedTenders)
        {
            bulkResponse
                .addResponse(order.orderGuid, order.errors)
                .getResponse(order.orderGuid)
                .setStatus(order.status);
        }

        // update the tenders into order
        if (goodOrders.length > 0)
        {
            const data = await Promise.all([
                Order.query().skipUndefined().findByIds(goodOrders).patch({
                    isTender: false,
                    isDeleted: false,
                    status: 'new',
                    updatedByGuid: currentUser
                }),
                OrderJob.query().skipUndefined().patch({
                    isDeleted: false,
                    status: 'new',
                    updatedByGuid: currentUser
                }).whereIn('orderGuid', goodOrders).returning('guid', 'orderGuid')
            ]);

            // loop through successfull jobs and emmit event to update acivity logs
            for (const job of data[1])
            {
                bulkResponse
                    .addResponse(job.orderGuid)
                    .getResponse(job.orderGuid)
                    .setStatus(200)
                    .setData({ jobGuid: job.guid });

                emitter.emit('tender_accepted', { jobGuid: job.guid, orderGuid: job.orderGuid, currentUser });
                emitter.emit('order_created', job.orderGuid);
            }
        }

        return bulkResponse;
    }

    /**
     * Method is to rejects load tenders. Validates, sends requests and updated the database in our system.
     * @param {string []} orderGuids
     * @param {string} reason
     * @param {BulkResponse} currentUser
     */
    static async rejectLoadTenders(orderGuids, reason, currentUser)
    {
        // valdiate orders for accepting or declineing
        const { successfulTenders, failedTenders } = await OrderService.validateLoadTendersState(orderGuids);

        // send request to logic
        const { goodOrders, failedOrders } = await OrderService.handleLoadTendersAPICall('reject', successfulTenders, reason);

        failedTenders.push(...failedOrders);

        const bulkResponse = new BulkResponse();

        // add errored orders to body message
        for (const order of failedTenders)
        {
            bulkResponse
                .addResponse(order.orderGuid, order.errors)
                .getResponse(order.orderGuid)
                .setStatus(order.status);
        }

        // update the tenders into order
        if (goodOrders.length > 0)
        {
            const data = await Promise.all([
                Order.query().skipUndefined().findByIds(goodOrders).patch({
                    isTender: false,
                    isDeleted: true,
                    status: 'deleted',
                    deletedByGuid: currentUser
                }),
                OrderJob.query().skipUndefined().patch({
                    isDeleted: true,
                    status: 'deleted',
                    deletedByGuid: currentUser
                }).whereIn('orderGuid', goodOrders).returning('guid', 'orderGuid')
            ]);

            // loop through successfull jobs and emmit event to update acivity logs
            for (const job of data[1])
            {
                bulkResponse
                    .addResponse(job.orderGuid)
                    .getResponse(job.orderGuid)
                    .setStatus(200)
                    .setData({ jobGuid: job.guid });

                emitter.emit('tender_rejected', { jobGuid: job.guid, orderGuid: job.orderGuid, currentUser });
            }
        }

        return bulkResponse;
    }

    /**
     * This method will be taking in acction, array of order objects, and a reason.
     * @param {('accept' | 'reject')} action
     * @param {object []} orderObjectsArray
     * @param {string} reason
     * @returns {{orderGuid: string, jobGuid: string, status: number, message: string | null}} reason
     */
    static async handleLoadTendersAPICall(action, orderObjectsArray, reason)
    {
        // composing payload for edi endpoint
        const logicAppPayloads = orderObjectsArray.map((item) => ({
            order: {
                guid: item.guid,
                number: item.number
            },
            partner: item.client.sfId,
            reference: item.referenceNumber,
            action: action,
            date: DateTime.utc().toString(),
            scac: 'RCGQ',
            edi: item.ediData?.[0].data,
            reason
        }));

        // sending multiple requests to logic app
        const apiResponses = await Promise.allSettled(logicAppPayloads.map((item) => logicAppInstance.post(process.env.AZURE_LOGICAPP_PARAMS, item)));

        const failed = [];
        const goodGuids = [];

        // looping through responses to separate failed ones
        for (let i = 0; i < apiResponses.length; i++)
        {
            if (apiResponses[i].status === 'fulfilled')
            {
                goodGuids.push(orderObjectsArray[i].guid);
            }
            else if (apiResponses[i].status === 'rejected')
            {
                failed.push({
                    orderGuid: orderObjectsArray[i].guid,
                    jobGuid: orderObjectsArray[i].jobs[0].guid,
                    status: 400,
                    errors: [apiResponses[i]?.reason?.message]
                });
            }
        }

        return { goodOrders: goodGuids, failedOrders: failed };
    }

    /**
     * Method take in order guid for validation. Creates errors of orders that failed, and return an object
     * with successfull payload and failed ones.
     * @param {uuid []} orderGuids
     * @returns
     */
    static async validateLoadTendersState(orderGuids)
    {
        // query all of the data
        const orders = await Order.query().skipUndefined().findByIds(orderGuids).withGraphJoined('[client, ediData, jobs]');

        // for array of data
        const orderExceptions = [];
        const existingOrders = [];

        // creating object with orderGuid as keys for map validation
        const hashedOrders = orders.reduce((map, obj) =>
        {
            map[obj.guid] = obj;
            return map;
        }, {});

        // loop through all guids validate the data
        for (const guid of orderGuids)
        {
            const errors = [];
            if (hashedOrders[guid] === undefined)
            {
                orderExceptions.push({
                    orderGuid: guid,
                    jobGuid: null,
                    status: 404,
                    errors: ['Order not found.']
                });
            }
            else
            {
                if (hashedOrders[guid].jobs[0].isTransport === false)
                {
                    errors.push('Order does not have a transport job.');
                }

                if (hashedOrders[guid].isTender === false)
                {
                    errors.push('Order is not a tender.');
                }

                if (hashedOrders[guid].isDeleted === true)
                {
                    errors.push('Order is deleted.');
                }

                if (errors.length > 0)
                {
                    orderExceptions.push({
                        orderGuid: guid,
                        jobGuid: hashedOrders[guid].jobs[0].guid,
                        status: 400,
                        errors: errors
                    });
                }

                if (hashedOrders[guid].isTender && !hashedOrders[guid].isDeleted)
                {
                    existingOrders.push(hashedOrders[guid]);
                }
            }
        }
        return { successfulTenders: existingOrders, failedTenders: orderExceptions };
    }

    static async updateClientNote(orderGuid, body, currentUser)
    {
        const order = Order.fromJson({});
        order.setClientNote(body.note, currentUser);
        order.setUpdatedBy(currentUser);

        const numOfUpdatedOrders = await Order.query().patch(order).findById(orderGuid);
        if (numOfUpdatedOrders == 0)
        {
            throw new NotFoundError('No order found');
        }

        return order;
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
    static buildStopLinksGraph(
        stops,
        stopsCache,
        terminalCache,
        commodityCache
    )
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
                stopPrime.terminal = {
                    '#dbRef': terminalCache[stop.terminal].guid
                };
                stopsCache[stop['#id']] = stopPrime;
            }

            // get a copy of the stop prime from the cache, this will me manipulated
            // so has to be a copy beccause we want to keep the original re-usable
            stopPrime = Object.assign({}, stopsCache[stop['#id']]);

            // the current stops commodities have priority
            const commodities = stop.commodities || stopPrime.commodities || [];

            // stop should only be defined for the first stopLink, after that use the reference
            // also, retain the commodities for use across jobs and what not
            stopsCache[stop['#id']] = {
                '#ref': stop['#id'],
                commodities: commodities
            };

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
                    commodity = commodity['#id'];

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
        return doesPickupsHaveElements
            ? baseQuery.whereExists(
                OrderJob.relatedQuery('stops')
                    .where('stopType', 'pickup')
                    .whereExists(
                        OrderService.basePickupDeliveryFilterQuery(pickups)
                    )
            )
            : baseQuery;
    }

    static addFilterDeliveries(baseQuery, deliveries)
    {
        const isDeliveriesEmpty = deliveries?.length > 0 ? false : true;
        if (isDeliveriesEmpty) return baseQuery;

        const deliveryQuery = OrderJob.query()
            .select('guid')
            .whereExists(
                OrderJob.relatedQuery('stops')
                    .where('stopType', 'delivery')
                    .whereExists(
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
                const getSTWithinFunction = coordinates.address ?
                    Terminal.searchByVectorAddress(coordinates.address) :
                    OrderService.getSTWithin(
                        coordinates.latitude,
                        coordinates.longitude,
                        coordinates.radius || 1
                    );

                return index === 0
                    ? this.where(getSTWithinFunction)
                    : query.orWhere(getSTWithinFunction);
            }, undefined);
        });
    }

    static addFilterDates(baseQuery, dateList)
    {
        const isDateListEmpty = dateList?.length > 0 ? false : true;
        if (isDateListEmpty) return baseQuery;

        const datesGroupByStatus = dateList.reduce((datesGrouped, date) =>
        {
            const datesKey = date.status;
            if (!datesGrouped[datesKey])
                datesGrouped[datesKey] = [];

            datesGrouped[datesKey].push(date);
            return datesGrouped;
        }, {});

        const datesQuery = Object.keys(datesGroupByStatus).reduce((query, statusKey) =>
        {
            const datesByStatus = datesGroupByStatus[statusKey];
            const comparisonDatesByStatus = function ()
            {
                return datesByStatus.reduce((query, dateElement) =>
                {
                    const comparisonDateAndStatus = function ()
                    {
                        const sqlQuery = OrderService.createDateComparisonSqlQuery(dateElement);

                        this.whereRaw(sqlQuery)
                            .andWhere('activityId', dateElement.status);
                    };

                    return query.orWhere(comparisonDateAndStatus);
                }, this);
            };

            return query.andWhere(comparisonDatesByStatus);
        }, ActivityLog.query().select('jobGuid'));

        return baseQuery.whereIn('guid', datesQuery);
    }

    static createDateComparisonSqlQuery(dateElement)
    {
        const { comparison = 'equal' } = dateElement;
        const comparisonValue = dateFilterComparisonTypes[comparison] || dateFilterComparisonTypes.equal;

        if (comparison === 'between')
        {
            const userDateStart = DateTime.fromISO(dateElement.date1, { setZone: true });
            const userDateEnd = DateTime.fromISO(dateElement.date2, { setZone: true });

            const userTimeZone = userDateStart.zoneName;

            const epochStart = userDateStart.startOf('day').toSeconds();
            const epochEnd = userDateEnd.endOf('day').toSeconds();

            const dbDateSQL = `(date_created AT TIME ZONE '${userTimeZone}')`;
            const userStartDateSQL = `(to_timestamp(${epochStart}) AT TIME ZONE '${userTimeZone}')`;
            const userEndDateSQL = `(to_timestamp(${epochEnd}) AT TIME ZONE '${userTimeZone}')`;

            return `${dbDateSQL} > ${userStartDateSQL} and ${dbDateSQL} < ${userEndDateSQL}`;
        }
        else if (comparison === 'equal')
        {
            const userDate = DateTime.fromISO(dateElement.date, { setZone: true });
            const userTimeZone = userDate.zoneName;

            const epochStart = userDate.startOf('day').toSeconds();
            const epochEnd = userDate.endOf('day').toSeconds();

            const dbDateSQL = `(date_created AT TIME ZONE '${userTimeZone}')`;
            const userStartDateSQL = `(to_timestamp(${epochStart}) AT TIME ZONE '${userTimeZone}')`;
            const userEndDateSQL = `(to_timestamp(${epochEnd}) AT TIME ZONE '${userTimeZone}')`;

            return `${dbDateSQL} > ${userStartDateSQL} and ${dbDateSQL} < ${userEndDateSQL}`;
        }
        else
        {
            const userDate = DateTime.fromISO(dateElement.date, { setZone: true });
            const userTimeZone = userDate.zoneName;

            const epoch = userDate.startOf('day').toSeconds();

            const dbDateSQL = `(date_created AT TIME ZONE '${userTimeZone}')`;
            const userDateSQL = `(to_timestamp(${epoch}) AT TIME ZONE '${userTimeZone}')`;

            return `${dbDateSQL} ${comparisonValue} ${userDateSQL}`;
        }
    }

    static async getComparisonTypesCached()
    {
        if (!cache.has('comparisonTypes'))
        {
            const comparisonTypesDB = await ComparisonType.query().select(
                'label',
                'value'
            );
            const comparisonTypes = comparisonTypesDB.reduce(
                (comparisonObj, { label, value }) =>
                {
                    comparisonObj[label] = value;
                    return comparisonObj;
                },
                {}
            );
            cache.set('comparisonTypes', comparisonTypes);
        }
        return cache.get('comparisonTypes');
    }

    static addGraphModifiers(baseQuery)
    {
        return (
            baseQuery
                .withGraphFetched({
                    order: {
                        client: true,
                        clientContact: true,
                        salesperson: true,
                        dispatcher: true
                    },
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
                    },
                    dispatcher: true
                })

                /**
                 * Is necessary to use modifyGraph on stops and
                 * stops.commodities to avoid duplicate rows
                 */
                .modifyGraph('order', 'getOrdersFields')
                .modifyGraph('order.client', (builder) =>
                    builder.select('guid', 'name')
                )
                .modifyGraph('order.clientContact', (builder) =>
                    builder.select('guid', 'name', 'phone_number', 'email')
                )
                .modifyGraph('order.salesperson', (builder) =>
                    builder.select('guid', 'name')
                )

                .modifyGraph('order.dispatcher', (builder) =>
                    builder.select('guid', 'name')
                )
                .modifyGraph('stops', (builder) =>
                    builder
                        .select(
                            'guid',
                            'stopType',
                            'status',
                            'dateScheduledStart',
                            'dateScheduledEnd',
                            'dateScheduledType',
                            'dateRequestedStart',
                            'dateRequestedEnd',
                            'dateRequestedType',
                            'sequence'
                        )
                        .distinct('guid')
                )
                .modifyGraph('stops.commodities', (builder) =>
                    builder
                        .select(
                            'guid',
                            'damaged',
                            'inoperable',
                            'identifier',
                            'lotNumber',
                            'typeId',
                            'description'
                        )
                        .whereNotNull('jobGuid')
                        .distinct('guid')
                )
                .modifyGraph('stops.terminal', (builder) =>
                    builder
                        .select(
                            'name',
                            'guid',
                            'street1',
                            'street2',
                            'state',
                            'city',
                            'country',
                            'zipCode'
                        )
                        .distinct()
                )
                .modifyGraph('loadboardPosts', (builder) =>
                    builder.select('loadboard', 'isPosted', 'status').distinct()
                )
                .modifyGraph('vendor', (builder) =>
                    builder.select('guid', 'name').distinct()
                )
                .modifyGraph('vendor.rectype', (builder) =>
                    builder.select('name').distinct()
                )
                .modify(['isInvoiced', 'isBilled'])
        );
    }

    static addFilterModifiers(baseQuery, filters)
    {
        const { jobCategory, sort, accountingType, dispatcher, customer, salesperson, carrier }
            = filters;
        return baseQuery
            .modify('filterJobCategories', jobCategory)
            .modify('filterAccounting', accountingType)
            .modify('sorted', sort)
            .modify('filterByCustomer', customer)
            .modify('filterByDispatcher', dispatcher)
            .modify('filterBySalesperson', salesperson)
            .modify('filterByCarrier', carrier);
    }

    static addDeliveryAddress(jobsArray)
    {
        return jobsArray.map((job) =>
        {
            const { terminal } =
                job.stops.length > 0 &&
                job.stops.reduce((acumulatorStop, stop) =>
                    OrderService.getLastDeliveryBetweenStops(
                        acumulatorStop,
                        stop
                    )
                );
            job.deliveryAddress = terminal || null;
            return job;
        });
    }

    static getLastDeliveryBetweenStops(firstStop, secondStop)
    {
        if (
            secondStop.stopType === 'delivery' &&
            firstStop.sequence < secondStop.sequence
        )
            return secondStop;
        return firstStop;
    }

    static registerCreateOrderStatusManager(order, currentUser)
    {
        for (const orderJob of order.jobs)
        {
            ActivityManagerService.createActivityLog({
                orderGuid: order.guid,
                userGuid: currentUser,
                jobGuid: orderJob.guid,
                activityId: 1
            });
        }
    }

    /**
     * If terminal, terminalContact or orderContact provided already exists and it is uses in another order,
     * it can not be updated so the GUID is removed from the input and a new object will be created
     */
    static async patchOrder(orderInput, currentUser)
    {
        // init transaction
        const trx = await Order.startTransaction();

        // extract payload fields
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
            referrerRebate,
            ...orderData
        } = orderInput;

        try
        {
            const jobsWithDeletedItems = await OrderService.handleDeletes(guid, jobs, commodities, stops, trx, currentUser);

            // create new order
            const [
                {
                    contactRecordType,
                    commodityTypes,
                    jobTypes
                },
                clientFound,
                invoiceBills,
                orderInvoices,
                referencesChecked,
                oldStopData,
                oldOrder,
                referrerInvoice
            ] = await Promise.all([
                OrderService.buildCache(),

                client?.guid ? OrderService.findSFClient(client.guid, trx) : undefined,
                OrderService.getJobBills(jobs, trx),
                OrderService.getOrderInvoices(guid, trx),
                OrderService.validateReferencesBeforeUpdate(
                    clientContact,
                    guid,
                    stops,
                    terminals
                ),
                Order.relatedQuery('stops', trx).for(guid).withGraphFetched('terminal').distinctOn('guid'),
                Order.query().findById(guid).skipUndefined().withGraphJoined(Order.fetch.stopsPayload),
                referrer?.guid && await OrderService.getOrderReferrerRebateInvoice(guid, trx),
                !referrer && referrerRebate ? Promise.reject(new MissingDataError('referrerRebate price can not be set without referrer')) : null
            ]);

            // terminalsChecked and stopsChecked contains the action to perform for terminals and stop terminal contacts.
            const { newOrderContactChecked, terminalsChecked, stopsChecked } = referencesChecked;

            /**
             * Updates or creates OrderContact, Commodities and Terminals
             * Returns an object for Commodities and Terminals to faciliate access
             */
            const { orderContactCreated, commoditiesMap, terminalsMap } =
                await OrderService.createOrderContactCommoditiesTerminalsMap(
                    {
                        contact: newOrderContactChecked,
                        contactRecordType,
                        client: clientFound
                    },
                    { commodities, commodityTypes },
                    terminalsChecked,
                    currentUser,
                    trx
                );

            // Create stop contacts using terminals and return an object to facilitate access, it uses the action from stopsChecked
            const stopContactsGraphMap =
                await OrderService.createStopContactsMap(
                    stopsChecked,
                    terminalsMap,
                    currentUser,
                    trx
                );

            const stopsGraphs = OrderService.createStopsGraph(
                stopsChecked,
                terminalsMap,
                stopContactsGraphMap,
                currentUser
            );
            const { stopsForStopLinks, stopsGraphsToUpdate } = await OrderService.createMissingStops(stopsGraphs, stopsChecked, trx);

            const jobsToUpdate = OrderService.createJobsGraph(
                jobs,
                jobTypes,
                currentUser
            );

            const stopLinksToUpdate = OrderService.updateCreateStopLinks(
                stopsForStopLinks,
                jobs,
                guid,
                commoditiesMap,
                currentUser,
                trx
            );

            const jobCompleteBills = await OrderService.createMissingJobBills(invoiceBills, jobsToUpdate, currentUser, trx);

            const { jobsToUpdateWithExpenses, orderInvoicesToUpdate } = OrderService.updateExpensesGraph(
                commoditiesMap,
                jobCompleteBills,
                orderInvoices,
                jobsToUpdate,
                consignee,
                currentUser
            );
            const referrerInvoiceToUpdate = OrderService.updateReferrerRebateInvoiceGraph(referrer, referrerRebate, referrerInvoice, currentUser);

            const contacts = OrderService.getContactReferences({
                referrer: { guid: referrer?.guid || referrer },
                salesperson: { guid: salesperson?.guid || salesperson },
                client: { guid: client?.guid || client },
                clientContact: { guid: orderContactCreated },
                dispatcher: { guid: dispatcher?.guid ?? oldOrder.dispatcherGuid ?? jobsToUpdate?.find(x => x.dispatcher?.guid)?.dispatcher?.guid }
            });
            const orderGraph = Order.fromJson({
                guid,
                instructions,
                stops: stopsGraphsToUpdate,
                invoices: [...orderInvoicesToUpdate, ...referrerInvoiceToUpdate],
                jobs: jobsToUpdateWithExpenses,
                ...orderData,
                ...contacts
            });
            orderGraph.setUpdatedBy(currentUser);

            orderGraph.setClientNote(orderData.clientNotes?.note, currentUser);

            const orderToUpdate = Order.query(trx)
                .skipUndefined()
                .upsertGraphAndFetch(orderGraph, {
                    relate: true,
                    noDelete: true,
                    allowRefs: true
                });

            const [orderUpdated] = await Promise.all([orderToUpdate, ...stopLinksToUpdate]);

            await trx.commit();

            const OrderStopService = require('./OrderStopService');
            const events = OrderStopService.getStopEvents(oldStopData, stopsChecked);

            for (const { event: eventName, ...params } of events)
            {
                params.order = orderGraph;
                params.job = orderGraph.jobs[0];
                emitter.emit(eventName, params);
            }

            emitter.emit('order_updated', { oldOrder: oldOrder, newOrder: orderUpdated });
            for(const job of jobsWithDeletedItems)
            {
                emitter.emit('commodity_deleted', { orderGuid: guid, jobGuid: job.jobGuid, commodities: job.commodities, currentUser });
            }

            return orderUpdated;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async handleDeletes(orderGuid, jobs, commodities, stops, trx, currentUser)
    {
        const delProms = [];
        const jobsWithDeletedItems = [];
        for (const job of jobs || [])
        {
            const toDelete = job.delete;

            // remove delete object from OrderJob as it will messup the upsert.
            delete job.delete;

            if (toDelete)
            {
                for (const key of Object.keys(toDelete))
                {
                    switch (key)
                    {
                        case 'commodities':
                            // when a commodity is being deleted, remove it from the order.
                            const deleteComsProm = OrderJobService.deleteCommodities(orderGuid, job.guid, toDelete.commodities, trx);
                            deleteComsProm.then(({ deleted, modified }) =>
                            {
                                for (const stopGuid of deleted.stops || [])
                                {
                                    OrderService._removeByGuid(stopGuid, stops);
                                    OrderService._removeByGuid(stopGuid, job.stops);
                                }

                                for (const commGuid of deleted.commodities || [])
                                {
                                    OrderService._removeByGuid(commGuid, commodities);
                                    OrderService._removeByGuid(commGuid, job.commodities);

                                    for (const stop of job.stops || [])
                                    {
                                        OrderService._removeByGuid(commGuid, stop.commodities);
                                    }
                                }

                                if (modified.stops)
                                {
                                    emitter.emit('orderstop_status_update', { stops: modified.stops, currentUser });
                                }

                            });
                            delProms.push(deleteComsProm);

                            const commoditiesForLogs = await Commodity.query().select(
                                [
                                    'guid',
                                    'description',
                                    'identifier',
                                    'lotNumber'
                                ]
                            ).findByIds(toDelete.commodities)
                            .withGraphFetched('[vehicle]')
                            .modifyGraph('vehicle', builder => builder.select('name'));
                        
                            jobsWithDeletedItems.push({
                                jobGuid: job.guid,
                                commodities: commoditiesForLogs
                            });

                            break;
                        default:

                        // do nothing
                    }
                }
            }
        }

        delProms && await Promise.all(delProms);

        return jobsWithDeletedItems;
    }

    static _removeByGuid(someGuid, somelistGuids)
    {
        if (somelistGuids)
        {
            const index = somelistGuids.findIndex(it => it.guid === someGuid);
            if (index != -1)
            {
                somelistGuids.splice(index, 1);
            }
        }
    }

    /**
         
         */
    /**
     * If contactName.guid is null -> reference should be removed
     * If contactName.guid exists -> reference should be updated
     * If contactName.guid is undefined -> do nothing
     * @param {*} contacts object with the order referrer, salesperson, client, dispacther and clientContact
     * @returns object only with the contacts that should be updated or removed.
     */
    static getContactReferences(contacts)
    {
        const contactNames = [
            'referrer',
            'salesperson',
            'client',
            'clientContact',
            'dispatcher'
        ];
        return contactNames.reduce((contactsToReturn, contactName) =>
        {
            if (contacts[contactName]?.guid)
                contactsToReturn[contactName] = { '#dbRef': contacts[contactName].guid };
            else if (contacts[contactName]?.guid === null)
                contactsToReturn[contactName] = { '#dbRef': null };

            return contactsToReturn;
        }, {});
    }

    static async getJobBills(jobs, trx)
    {
        const jobsGuids = jobs.map(job => job.guid);
        const allInvoiceBills = await InvoiceBill.query(trx).select('*')
            .whereIn(
                'guid',
                Bill.query(trx).select('billGuid').whereIn('jobGuid', jobsGuids)
            );

        return InvoiceBill.fetchGraph(allInvoiceBills, '[lines.link, job]', { transaction: trx })
            .modifyGraph('job', (builder) => builder.select('guid'));
    }

    static async getOrderInvoices(orderGuid, trx)
    {
        const allInvoices = await InvoiceBill.query(trx).select('*')
            .whereIn(
                'guid',
                Invoice.query(trx).select('invoiceGuid').where('orderGuid', orderGuid)
            );

        return InvoiceBill.fetchGraph(allInvoices, '[lines.link]', { transaction: trx });
    }

    /**
     * Search for oldest order invoice that has a invoice.consignee = order.referrer and that invoice has a line use for rebate.
     * We filter by invoice.Consignee = to order.Referrer to get only those use for rebate. If order does not has referrer -> cretae new rebate invoice.
     *
     * In case the order.referrer is the same as the order.consignee, we may have multiple invoices were the invoice.consignee = order.referrer,
     * for those cases we also need to check for invoices that have "rebate" lines. If non invoice is return -> cretae new rebate invoice
     */
    static async getOrderReferrerRebateInvoice(orderGuid, trx)
    {

        const referrerInvoice = await InvoiceBill.query(trx).alias('IB').select('IB.guid')
            .innerJoin('rcgTms. invoiceBillLines as IBL', 'IB.guid', 'IBL.invoiceGuid')
            .whereIn(
                'IB.guid',
                Invoice.query(trx).select('invoiceGuid').where('orderGuid', orderGuid)
            )
            .andWhere('IB.consigneeGuid',
                Order.query(trx).select('referrerGuid').where('guid', orderGuid)
            )
            .andWhere('IBL.itemId', 7)
            .orderBy('IB.dateCreated')
            .limit(1);

        if (!referrerInvoice)
            return {};

        const [invoice] = await InvoiceBill.fetchGraph(referrerInvoice, '[lines]', { transaction: trx });
        return invoice;
    }

    static async validateReferencesBeforeUpdate(
        orderContact,
        orderGuid,
        stops,
        terminals
    )
    {
        const orderContacToCheck = orderContact
            ? OrderService.checkContactReference(orderContact, orderGuid)
            : undefined;

        // Return new stops with info checked if needs to be updated or created
        const stopsToChecked = [];
        for (const stop of stops)
            stopsToChecked.push(OrderService.getStopsWithInfoChecked(stop, orderGuid));

        // Return new terminals with info checked if needs to be updated or created
        const terminalsToChecked = [];
        for (const terminal of terminals)
            terminalsToChecked.push(OrderService.getTerminalWithInfoChecked(terminal));

        const [orderChecked, terminalsChecked, stopsChecked] =
            await Promise.all([orderContacToCheck, Promise.all(terminalsToChecked), Promise.all(stopsToChecked)]);

        let newOrderContactChecked = orderContact;
        if (orderContact && orderChecked === 'createNewContact')
        {
            const { guid: orderContactGuid, ...orderContactData } =
                orderContact;
            newOrderContactChecked = orderContactData;
        }
        else if (orderContact && orderChecked === 'removeContact')
            newOrderContactChecked = { guid: null };

        return { newOrderContactChecked, terminalsChecked, stopsChecked };
    }

    static async getStopsWithInfoChecked(stop, orderGuid)
    {
        const contacTypes = ['primaryContact', 'alternativeContact'];
        const contactsActionPromise = contacTypes.map((contactType) =>
            OrderService.checkTerminalContactReference(
                stop[contactType],
                orderGuid
            )
        );

        const [primaryContactAction, alternativeContactAction] =
            await Promise.all(contactsActionPromise);

        const stopChecked = {
            primaryContactAction,
            alternativeContactAction,
            ...stop
        };

        return stopChecked;
    }

    /**
     * Base information: Fields use to create the address; Street1, city, state, zipCode and Country
     * Extra information: Fields that are not use to create the address; Street2 and Name
     * Checks the action to performed for a terminal.
     * Rules:
     * 0) If terminal GUID is provided, we check if the information is the same as the DB, this is to avoid
     *    calling maps api if the terminal has the same information.
     * 1) updateExtraFields: The B.I. is the same and only the E.I. changed, so we only update those fields
     *    of that existing Terminal
     * 2) findOrCreate: The B.I. changed, so we have to call maps api and then check in the DB if that record
     *    exists or we create a new one.
     * 3) nothingToDo: The terminal is the same and there is no need to do anything
     * @param {*} terminalInput
     * @returns
     */
    static async getTerminalWithInfoChecked(terminalInput)
    {
        let terminalAction = 'findOrCreate';

        if (terminalInput.guid)
        {
            const terminalDB =
                (await Terminal.query().findById(terminalInput.guid)) || {};
            const hasSameBaseInfo = Terminal.hasTerminalsSameBaseInformation(
                terminalDB,
                terminalInput
            );
            const hasSameExtraInfo = Terminal.hasTerminalsSameExtraInformation(
                terminalDB,
                terminalInput
            );

            if (!hasSameBaseInfo) terminalAction = 'findOrCreate';
            else if (!hasSameExtraInfo) terminalAction = 'updateExtraFields';
            else terminalAction = 'nothingToDo';
        }

        return { terminalAction, ...terminalInput };
    }

    static async checkContactReference(contact, orderGuid)
    {
        if (contact.guid === null && Object.keys(contact).length === 1)
            return 'removeContact';
        else if (!contact.guid) return 'createNewContact';

        const searchInOrder = Order.query()
            .count('guid')
            .where('clientContactGuid', contact.guid)
            .andWhereNot('guid', orderGuid);

        const searchInJobs = OrderJob.query()
            .count('orderGuid')
            .where('vendorContactGuid', contact.guid)
            .andWhereNot('orderGuid', orderGuid)
            .orWhere('vendorAgentGuid', contact.guid);

        const [[{ count: countInOrder }], [{ count: countInJobs }]] =
            await Promise.all([searchInOrder, searchInJobs]);

        if (countInOrder > 0 || countInJobs > 0) return 'createNewContact';
        return 'updateContact';
    }

    /**
     * This check is to avoid creating innecesary entries, we check by guid first to know if that TC can be updated or not
     * TC: Terminal contact
     * Key: The primary compaund key of a TC, TerminalGuid, name and phoneNumber
     * Rules:
     * 1) If non GUID is provided -> findOrCreate
     * 2) If GUID is provided -> Check if TC being used in other orders
     *    -> If it is being use -> findOrCreate (You can not update it, you can use the TC if exists or create a new one)
     *    -> If it is not used -> findAndUpdate (You can updated the Key if new one does not exists in DB, if it does, use the existing TC, if not, use current TC,
     *      then update the TC with the new information), this is in case you try to change the name, but that TC key exists, so we need to use the existing TC, but that
     *      TC does not have the new email or mobileNumber, so if needs to updated)
     * @param {*} terminalContacGuid
     * @param {*} orderGuid
     * @param {*} stopTerminalContactInput
     * @returns string with the action to perform later by updateCreateStopContacts function
     */
    static async checkTerminalContactReference(terminalContact, orderGuid)
    {
        if (terminalContact === null) return 'remove';
        else if (terminalContact === undefined) return 'nothingToDo';
        else if (terminalContact?.guid === undefined) return 'findOrCreate';
        else
        {
            const [{ count }] = await OrderStopLink.query()
                .count('orderGuid')
                .whereIn(
                    'stopGuid',
                    OrderStop.query()
                        .select('guid')
                        .whereIn(
                            'terminalGuid',
                            Terminal.query()
                                .select('guid')
                                .whereIn(
                                    'guid',
                                    Contact.query()
                                        .select('terminalGuid')
                                        .where('guid', terminalContact.guid)
                                )
                        )
                )
                .andWhereNot('orderGuid', orderGuid);
            const useInOtherOrders = count > 0 ? true : false;

            if (useInOtherOrders) return 'findOrCreate';
            return 'findAndUpdate';
        }
    }

    static async findSFClient(clientGuid, trx)
    {
        return SFAccount.query(trx)
            .modify('byType', 'client')
            .findOne((builder) =>
            {
                builder
                    .orWhere('guid', clientGuid)
                    .orWhere('salesforce.accounts.sfId', clientGuid);
            });
    }

    static async createSFContact(
        contactInput,
        contactRecordType,
        sfClient,
        trx
    )
    {
        if (!contactInput) return;

        const clientContact = SFContact.fromJson(contactInput);
        if (sfClient) clientContact.linkAccount(sfClient);
        if (contactRecordType) clientContact.linkRecordType(contactRecordType);

        const { guid } = await SFContact.query(trx)
            .skipUndefined()
            .upsertGraphAndFetch(clientContact, {
                relate: true,
                noDelete: true
            });

        return guid;
    }

    static async updateCreateCommodity(
        commodityInput,
        commodityTypes,
        currentUser,
        trx
    )
    {
        const { index, ...commodityData } = commodityInput;

        /**
         * If only has 1 property for GUID, it is not necessary to update it because that means
         * the commodity is only being use to reference other elements in the update
         */
        if (Object.keys(commodityData).length === 1)
            return { commodity: commodityData, index };

        const commodity = await OrderService.createCommodityGraph(
            commodityData,
            commodityTypes,
            currentUser,
            trx
        );
        const commodityUpserted = await Commodity.query(trx)
            .skipUndefined()
            .upsertGraphAndFetch(commodity, {
                relate: true,
                noDelete: true
            });

        return { commodity: commodityUpserted, index };
    }

    static async createCommodityGraph(
        commodityInput,
        commodityTypes,
        currentUser,
        trx
    )
    {
        const commodity = Commodity.fromJson(commodityInput);
        if (!commodityInput.guid) commodity.setCreatedBy(currentUser);
        else commodity.setUpdatedBy(currentUser);

        if (commodity?.typeId)
        {
            const commType = commodityTypes.find((commodityType) =>
                CommodityType.compare(commodity, commodityType)
            );
            if (!commType)
                throw new ValidationError(
                    `Unknown commodity ${commodity.commType?.category} ${commodity.commType?.type}`
                );

            commodity.graphLink('commType', commType);
        }

        if (commodity.isVehicle())
        {
            const vehicle = await Vehicle.fromJson(
                commodity.vehicle
            ).findOrCreate(trx);
            commodity.graphLink('vehicle', vehicle);
        }

        return commodity;
    }

    /**
     * Base information (B.I.): Fields use to create the address; Street1, city, state, zipCode and Country
     * Extra information (E.I.): Fields that are not use to create the address; Street2 and Name
     * findOrCreate: We call maps api to get Lat and Long -> We look in DB for that key, if it exists
     *      we pull that record and update the E.I., if not, we create a new record.
     *      In case maps api does not return a Lat and Long, we save the terminal without Lat and Long as
     *      an Unresolved Terminal.
     * @param {*} terminalInput
     * @param {*} currentUser
     * @param {*} trx
     * @returns
     */
    static async updateCreateTerminal(terminalInput, currentUser, trx)
    {
        const { index, terminalAction, ...terminalData } = terminalInput;

        switch (terminalAction)
        {
            case 'updateExtraFields':
                const terminalToUpdate = Terminal.fromJson(terminalData);
                terminalToUpdate.setUpdatedBy(currentUser);

                const terminalUpdated = await Terminal.query(trx)
                    .patchAndFetchById(terminalToUpdate.guid, terminalToUpdate);

                return { terminal: terminalUpdated, index };
            case 'findOrCreate':
                let terminalCreated = {};

                const stringAddress = Terminal.createStringAddress(terminalData);

                const candidate = await TerminalService.geocodeAddress(stringAddress);

                if (candidate && candidate.geo?.length > 0)
                {
                    const [longitude, latitude] = candidate.geo;
                    const terminalToUpdate = await Terminal.query(trx).findOne({
                        latitude,
                        longitude
                    });

                    // Terminal exists, now we have to add non essential information
                    if (terminalToUpdate)
                    {
                        terminalToUpdate.setUpdatedBy(currentUser);
                        terminalToUpdate.street2 = terminalData.street2;
                        terminalToUpdate.name = terminalData.name;
                        terminalToUpdate.locationType =
                            terminalData.locationType;

                        terminalCreated = await Terminal.query(
                            trx
                        ).patchAndFetchById(
                            terminalToUpdate.guid,
                            terminalToUpdate
                        );
                    }

                    // Create new resolved terminal
                    else
                    {
                        // eslint-disable-next-line no-unused-vars
                        const { guid, ...terminalInfoToCreate } = terminalData;
                        const terminalToCreate = Terminal.fromJson({
                            ...terminalInfoToCreate,
                            latitude,
                            longitude,
                            isResolved: true
                        });
                        terminalToCreate.setCreatedBy(currentUser);

                        terminalCreated = await Terminal.query(trx).insert(terminalToCreate)
                            .onConflict(['latitude', 'longitude']).merge();
                    }
                }

                // Create new unresolved terminal
                else
                {
                    // No use terminal guid if provided, and remove latitude and longitude to avoid posible constraint error, only for UNRESOLVED terminals
                    // eslint-disable-next-line no-unused-vars
                    const { guid, latitude, longitude, ...terminalDataNoGuid } = terminalData;
                    const terminalToCreate =
                        Terminal.fromJson(terminalDataNoGuid);
                    terminalToCreate.setCreatedBy(currentUser);

                    terminalCreated = await Terminal.query(trx).insertAndFetch(terminalToCreate);
                }

                return { terminal: terminalCreated, index };
            default:
                return { terminal: terminalData, index };
        }
    }

    static createTerminalContactGraph(
        terminalContactInput,
        terminal,
        currentUser
    )
    {
        const terminalContactGraph = Contact.fromJson(terminalContactInput);
        terminalContactGraph.linkTerminal(terminal);
        if (!terminalContactInput.guid)
            terminalContactGraph.setCreatedBy(currentUser);
        else terminalContactGraph.setUpdatedBy(currentUser);

        return terminalContactGraph;
    }

    static async createStopContactsMap(stops, terminalsMap, currentUser, trx)
    {
        const stopsWithContacts =
            stops?.filter(
                (stop) =>
                    OrderStop.hasContact(stop) || OrderStop.removeContact(stop)
            ) || [];
        const stopsContactsToUpdate = [];
        for (const stopWithContact of stopsWithContacts)
        {
            const terminal = terminalsMap[stopWithContact.terminal];
            const stopContactsUpdated =
                await OrderService.updateCreateStopContacts(
                    stopWithContact,
                    terminal,
                    currentUser,
                    trx
                );
            stopsContactsToUpdate.push(stopContactsUpdated);
        }

        return stopsContactsToUpdate.reduce((map, { contacts, index }) =>
        {
            map[index] = contacts;
            return map;
        }, {});
    }

    static async createOrderContactCommoditiesTerminalsMap(
        contactInfo,
        commoditiesInfo,
        terminals,
        currentUser,
        trx
    )
    {
        const { contact = {}, contactRecordType, client } = contactInfo;
        const { commodities, commodityTypes } = commoditiesInfo;

        let orderContactTocreate;
        if (contact === null) orderContactTocreate = null;
        else if (contact && Object.keys(contact).length > 0)
            orderContactTocreate = OrderService.createSFContact(
                contact,
                contactRecordType,
                client,
                trx
            );

        const commoditiesToUpdate =
            commodities?.map((commodity) =>
                OrderService.updateCreateCommodity(
                    commodity,
                    commodityTypes,
                    currentUser,
                    trx
                )
            ) || [];
        const terminalsToUpdate =
            terminals?.map((terminal) =>
                OrderService.updateCreateTerminal(terminal, currentUser, trx)
            ) || [];

        const [orderContactCreated, commoditiesUpdated, terminalsUpdated] =
            await Promise.all([orderContactTocreate, Promise.all(commoditiesToUpdate), Promise.all(terminalsToUpdate)]);

        // Create maps for commodities and terminal to facilitate use
        const commoditiesMap = commoditiesUpdated.reduce(
            (map, { commodity, index }) =>
            {
                map[index] = commodity;
                return map;
            },
            {}
        );
        const terminalsMap = terminalsUpdated.reduce(
            (map, { terminal, index }) =>
            {
                map[index] = terminal;
                return map;
            },
            {}
        );

        return { orderContactCreated, commoditiesMap, terminalsMap };
    }

    /**
     * This returns the terminal contacts wether they are creates, found or updated. depending on the action it has to be performed.
     * each stopWithContactInput has a parametter call primaryContactAction or alternativeContactAction with teh following values:
     * 1) remove: The conatct should be removed from teh stop
     * 2) findOrCreate: The contact maybe exists, so it should be search by KEY (name, phoneNumber and temrinalGuid), if it is found the use that one, if not create a new one
     * 3) findAndUpdate: The contact should be reuse, find if there is a TC with the same key, if so, use that one if not, use the existing one, after either case, we can
     *      update the information
     * 4) nothingToDo: The contact was not pass so there is nothing to do
     * @param {*} stopWithContactInput
     * @param {*} terminal
     * @param {*} terminalContactsNoDuplicates
     * @param {*} currentUser
     * @returns
     */
    static async updateCreateStopContacts(
        stopWithContactInput,
        terminal,
        currentUser,
        trx
    )
    {
        const contacTypes = ['primaryContact', 'alternativeContact'];
        const contactsUpdated = {
            primaryContact: undefined,
            alternativeContact: undefined
        };
        for (const contactType of contacTypes)
        {
            const contactAction = stopWithContactInput[`${contactType}Action`];
            const contactInput = stopWithContactInput[contactType];

            switch (contactAction)
            {
                case 'findOrCreate':
                    const terminalContact = Contact.fromJson({
                        terminalGuid: terminal.guid,
                        name: contactInput.name,
                        phoneNumber: contactInput.phoneNumber
                    });
                    const terminalContactFound = await Contact.query().findOne(terminalContact);

                    // Contact exists, now we have to add non essential information
                    if (terminalContactFound)
                    {
                        terminalContactFound.setUpdatedBy(currentUser);
                        terminalContactFound.email = contactInput.email;
                        terminalContactFound.mobileNumber =
                            contactInput.mobileNumber;
                        contactsUpdated[contactType] = await Contact.query(
                            trx
                        ).patchAndFetchById(
                            terminalContactFound.guid,
                            terminalContactFound
                        );
                    }
                    else
                    {
                        // Guid is not use because it has to be created
                        const { guid, ...contactData } = contactInput;
                        const contactGraphToCreate =
                            OrderService.createTerminalContactGraph(
                                contactData,
                                terminal,
                                currentUser
                            );
                        contactsUpdated[contactType] = await Contact.query(
                            trx
                        ).insertAndFetch(contactGraphToCreate);
                    }
                    break;
                case 'findAndUpdate':
                    let terminalContactToUpdate = await Contact.query().findOne(
                        {
                            terminalGuid: terminal.guid,
                            name: contactInput.name,
                            phoneNumber: contactInput.phoneNumber
                        }
                    );

                    // Update contact with new information
                    if (terminalContactToUpdate)
                    {
                        terminalContactToUpdate.setUpdatedBy(currentUser);
                        terminalContactToUpdate.email = contactInput.email;
                        terminalContactToUpdate.mobileNumber = contactInput.mobileNumber;
                    }
                    else
                        terminalContactToUpdate =
                            OrderService.createTerminalContactGraph(
                                contactInput,
                                terminal,
                                currentUser
                            );

                    contactsUpdated[contactType] = await Contact.query(
                        trx
                    ).patchAndFetchById(
                        terminalContactToUpdate.guid,
                        terminalContactToUpdate
                    );
                    break;
                default:
                    // Null means that should be delete, the real remove happens in createSingleStopGraph
                    contactsUpdated[contactType] = contactAction === 'remove' ? null : undefined;
            }
        }

        return {
            index: stopWithContactInput.index,
            contacts: {
                primaryContact: contactsUpdated.primaryContact,
                alternativeContact: contactsUpdated.alternativeContact
            }
        };
    }

    static createStopsGraph(
        stopsInput,
        terminalsMap,
        stopContactsMap,
        currentUser
    )
    {
        return (
            stopsInput?.map((stop) =>
            {
                /**
                 * commodities, primaryContact, alternativeContact, primaryContactAction and alternativeContactAction
                 * are remove from the rest of stopData because they are not use in this step
                 */
                const {
                    index: stopIndex,
                    terminal: terminalIndex,
                    // eslint-disable-next-line no-unused-vars
                    primaryContact: primaryContactDataNotUseHere,
                    // eslint-disable-next-line no-unused-vars
                    alternativeContact: alternativeContactDataNotUseHere,
                    // eslint-disable-next-line no-unused-vars
                    commodities: commoditiesDataNotUseHere,
                    // eslint-disable-next-line no-unused-vars
                    primaryContactAction,
                    // eslint-disable-next-line no-unused-vars
                    alternativeContactAction,
                    ...stopData
                } = stop;

                const terminalGuid = terminalsMap[terminalIndex]?.guid;
                const stopContacts = stopContactsMap[stopIndex];
                return OrderService.createSingleStopGraph(
                    stopData,
                    terminalGuid,
                    stopContacts,
                    currentUser
                );
            }) || []
        );
    }

    static createSingleStopGraph(
        stopInput,
        terminalGuid,
        contacts = {},
        currentUser
    )
    {
        const { primaryContact, alternativeContact } = contacts;
        const stop = OrderStop.fromJson({ ...stopInput, terminalGuid });
        if (stopInput.guid)
            stop.setUpdatedBy(currentUser);
        else
            stop.setCreatedBy(currentUser);

        if (OrderService.isTerminalContactToBeDeleted(primaryContact))
            stop.primaryContactGuid = null;
        else stop.primaryContact = primaryContact;
        if (OrderService.isTerminalContactToBeDeleted(alternativeContact))
            stop.alternativeContactGuid = null;
        else stop.alternativeContact = alternativeContact;

        return stop;
    }

    static isTerminalContactToBeDeleted(terminalContact)
    {
        return terminalContact === null ? true : false;
    }

    static createJobsGraph(jobsInput, jobTypes, currentUser)
    {
        return (
            jobsInput?.map((job) =>
            {
                // eslint-disable-next-line no-unused-vars
                const { stops: stopsDataNotUseHere, commodities, ...newJobData } = job;
                const jobGraph = OrderService.createSingleJobGraph(
                    newJobData,
                    jobTypes,
                    currentUser
                );

                // Add commodities to be use in updateExpensesGraph cause they contain the revenue and expense
                return {
                    ...jobGraph,
                    commodities
                };
            }) || []
        );
    }

    static createSingleJobGraph(jobInput, jobTypes, currentUser)
    {
        const jobModel = OrderJob.fromJson(jobInput);

        for (const field of ['dispatcher', 'vendorAgent', 'vendorContact'])
        {
            if (jobInput[field]?.guid !== undefined)
            {
                jobInput[field] = { '#dbRef': jobInput[field]?.guid };
            }
        }

        if (jobModel?.jobType?.category && jobModel?.jobType?.type)
        {
            const jobType = jobTypes?.find((jobType) =>
                OrderJobType.compare(jobModel, jobType)
            );
            if (!jobType)
            {
                throw new ValidationError(
                    `unknown job type ${jobModel.typeId ||
                    jobModel.jobType.category + jobModel.jobType.type
                    }`
                );
            }
            jobModel.graphLink('jobType', jobType);
            jobModel.setIsTransport(jobType);
        }
        jobModel.setUpdatedBy(currentUser);
        return jobModel;
    }

    /**
     * This method is used to minimize amount of queries to be done
     * to get stuff like commTypes, recordTypes, etc.
     */
    static async buildCache()
    {
        if (!cache.has('orderInfo'))
        {
            const [
                contactRecordType,
                commTypes,
                jobTypes,
                invoiceLineItems
            ] = await Promise.all(
                [
                    SFRecordType.query().modify('byType', 'contact').modify('byName', 'account contact'),
                    CommodityType.query(),
                    OrderJobType.query(),
                    InvoiceLineItem.query()
                ]);

            cache.set('orderInfo', {
                contactRecordType,
                commTypes,
                jobTypes,
                invoiceLineItems
            });
        }

        return cache.get('orderInfo');
    }

    /**
     * Insert or update of stopLInks was done manually because upsert wasn't working for stopLinks graph
     * so the process was to find if the stoplink if exists, if it does udpate it, if not, create it
     * TODO Check if this can be redo using upsert
     */
    static updateCreateStopLinks(
        stopsFromInput,
        jobs,
        orderGuid,
        commoditiesMap,
        currentUser,
        trx
    )
    {
        const stopLinksByJob = OrderService.createJobStopLinksObjects(
            jobs,
            stopsFromInput,
            commoditiesMap,
            orderGuid
        );

        const stopLinksByStops = OrderService.createStopLinksObjects(
            stopsFromInput,
            commoditiesMap,
            orderGuid
        );

        return [...stopLinksByStops, ...stopLinksByJob].map((stopLinkData) =>
            OrderService.updateOrCreateStopLink(stopLinkData, currentUser, trx)
        );
    }

    /**
     * @description Creates the new stops and adds the guid to the stopsGraphs an stopsForStopLinks.
     * Both stops arrays are base on the same list, so they have the same positioning
     * @param {OrderStop []} stopsGraphs List of order stops checked for update into DB
     * @param {OrderStop []} stopsForStopLinks List of order stops as they came from user input.
     * This is use due to the index property that stopGraph does not have,
     * @param {transaction} trx Model transaction
     * @returns {{stopsForStopLinks: OrderStop[], stopsGraphsToUpdate: OrderStop[]}} Same OrderStops as the input, with the adition of
     * the new stop guid that was created (If it is requires to created it)
     */
    static async createMissingStops(stopsGraphs, stopsForStopLinks, trx)
    {
        for (const stopToUpdateIndex in stopsGraphs)
        {
            if (!stopsGraphs[stopToUpdateIndex].guid)
            {
                const stopsToCreate = stopsGraphs[stopToUpdateIndex];
                const stopCreated = await OrderStop.query(trx).insert(stopsToCreate, { relate: true });

                stopsForStopLinks[stopToUpdateIndex].guid = stopCreated.guid;
                stopsGraphs[stopToUpdateIndex].guid = stopCreated.guid;
            }
        }

        return { stopsForStopLinks, stopsGraphsToUpdate: stopsGraphs };
    }

    static async updateOrCreateStopLink(stopLinkData, currentUser, trx)
    {
        const { orderGuid, commodityGuid, stopGuid } = stopLinkData;

        const stopLinkFound = await OrderStopLink.query(trx).findOne({
            orderGuid,
            stopGuid,
            commodityGuid
        });

        if (stopLinkFound)
        {
            return await OrderStopLink.query(trx)
                .patch({ updatedByGuid: currentUser })
                .where('id', stopLinkFound.id);
        }
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
        return stops?.reduce(
            (stopLinks, { commodities: stopCommodities, guid: stopGuid }) =>
            {
                const stopLinksByCommodities =
                    stopCommodities?.reduce(
                        (
                            stopLinks,
                            { index: commodityIndex, ...stopLinkData }
                        ) =>
                        {
                            const commodityGuid =
                                commoditiesMap[commodityIndex].guid;

                            stopLinks.push({
                                stopGuid,
                                commodityGuid,
                                orderGuid,
                                jobGuid: null,
                                ...stopLinkData
                            });
                            return stopLinks;
                        },
                        []
                    ) || [];
                stopLinks.push(...stopLinksByCommodities);
                return stopLinks;
            },
            []
        );
    }

    // This methode is similar to createStopLinksObjects, but it was separated to facilitate readability
    static createJobStopLinksObjects(jobs, stopsFromInput, commoditiesMap, orderGuid)
    {
        return (
            jobs?.reduce((stopLinks, { guid: jobGuid, stops: jobStops }) =>
            {
                const stopLinksByJob =
                    jobStops?.reduce(
                        (
                            stopLinks,
                            {
                                index: stopIndex,
                                commodities: jobStopCommodities
                            }
                        ) =>
                        {
                            const stopLinksByStop =
                                jobStopCommodities?.reduce(
                                    (
                                        stopLinks,
                                        {
                                            index: commodityIndex,
                                            ...stopLinkData
                                        }
                                    ) =>
                                    {
                                        const commodityGuid =
                                            commoditiesMap[commodityIndex].guid;
                                        const stopGuid = stopsFromInput.find(
                                            (stop) => stop.index === stopIndex
                                        )?.guid;

                                        stopLinks.push({
                                            stopGuid,
                                            commodityGuid,
                                            orderGuid,
                                            jobGuid,
                                            ...stopLinkData
                                        });
                                        return stopLinks;
                                    },
                                    []
                                ) || [];
                            stopLinks.push(...stopLinksByStop);
                            return stopLinks;
                        },
                        []
                    ) || [];
                stopLinks.push(...stopLinksByJob);
                return stopLinks;
            }, []) || []
        );
    }

    /**
     * For each commodity send in a job (Which contains the revenu and expense), we pull the invoice line from DB and find the invoice that has
     * the same commodityGuid and itemId = 1, the we update the revenue and expese, if a line is not found it is because is for a new commmodity, so a
     * new invoice line is created for the job and the order. The new jobsWithExpenses is return along with the orderInvoices
     * @param {*} commoditiesMap Commodities obj with key the commodity index and value the commodity with guid
     * @param {*} invoiceBillsFromDB Bills pull from DB for all jobs to update
     * @param {*} orderInvoiceFromDB Invoices pull from DB for the order
     * @param {*} jobsToUpdate Jobs with new new information to update, contains the commodities new expense and revenue
     * @param {*} currentUser
     * @returns {
     *  jobsToUpdateWithExpenses: Jobs with the bills and lines to update or create
     *  orderInvoicesToUpdate Order invoices with the lines to create
     * }
     */
    static updateExpensesGraph(commoditiesMap, invoiceBills, orderInvoiceFromDB, jobsToUpdate, consignee, currentUser)
    {
        const orderInvoiceListToCreate = [];
        const jobsToUpdateWithExpenses = jobsToUpdate.map(job =>
        {
            job.bills = [];
            const jobBillsWithLinesToUpdate = new Map();

            job.commodities?.map(commWithExpense =>
            {
                let lineFound = false;
                const commodity = commoditiesMap[commWithExpense.index];

                // If commodity is not found, must be a typo on the commodity index sent by the caller
                if (commodity)
                {
                    for (const bill of invoiceBills)
                    {
                        if (bill.job.guid === job.guid)
                        {
                            // Update only for line type transport
                            const invocieLineFound = bill.lines?.find(line => line.itemId === 1 && line.commodityGuid === commodity.guid);
                            if (invocieLineFound)
                            {
                                lineFound = true;
                                invocieLineFound.amount = commWithExpense.expense;
                                invocieLineFound.setUpdatedBy(currentUser);

                                invocieLineFound.link[0].amount = commWithExpense.revenue;
                                invocieLineFound.link[0].setUpdatedBy(currentUser);

                                // Add bill to jobToUpdate
                                if (!jobBillsWithLinesToUpdate.has(bill.guid))
                                    jobBillsWithLinesToUpdate.set(bill.guid, bill);
                            }
                        }
                    }
                }

                // If line was not found is because it is for a new commodity so a new one has to be created
                if (!lineFound && commodity)
                {
                    const itemId = 1;
                    const commodityRevenue = commWithExpense.revenue;
                    const commodityExpense = commWithExpense.expense;

                    const orderInvoiceLineToCreate = OrderService.createInvoiceLineGraph(
                        commodityRevenue,
                        itemId,
                        currentUser
                    );
                    orderInvoiceLineToCreate.graphLink('commodity', commodity);
                    orderInvoiceListToCreate.push(orderInvoiceLineToCreate);

                    const jobInvoiceLineToCreate = OrderService.createInvoiceLineGraph(
                        commodityExpense,
                        itemId,
                        currentUser
                    );

                    jobInvoiceLineToCreate.graphLink('commodity', commodity);
                    jobInvoiceLineToCreate.link = { '#ref': orderInvoiceLineToCreate['#id'] };

                    const bill = invoiceBills.find(bill => bill.job?.guid === job.guid);

                    if (!bill)
                        throw new MissingDataError('Job Is Missing Bill');

                    bill.lines.push(jobInvoiceLineToCreate);
                    if (!jobBillsWithLinesToUpdate.has(bill.guid))
                        jobBillsWithLinesToUpdate.set(bill.guid, bill);
                }
            });

            for (const bill of jobBillsWithLinesToUpdate.values())
            {
                // Delete the job.commodities that contains the expense and revenue and insert the bill with the lines to update inside the job
                // eslint-disable-next-line no-unused-vars
                const { job: commodityJobReference, ...billData } = bill;
                delete job.commodities;
                job.bills.push(billData);
            }

            return job;
        });

        if (orderInvoiceFromDB.length > 0)
            orderInvoiceFromDB[0].lines.push(...orderInvoiceListToCreate);

        if (consignee?.guid && orderInvoiceFromDB?.length)
        {
            if (!orderInvoiceFromDB.isPaid)
                orderInvoiceFromDB[0].consigneeGuid = consignee?.guid;
            else
                throw new DataConflictError('Cannot update consignee on paid invoice');
        }

        return { jobsToUpdateWithExpenses, orderInvoicesToUpdate: orderInvoiceFromDB };
    }

    /**
     * Rules:
     * 1) If referrer and referrerInvoice is empty -> create invoice and line, if non referrerRebate was provided use default 0.00
     * 2) If referrer and referrerInvoice -> Update invoice with new values for invoice.consignee and amoun
     * @param {*} referrer referrer Guid provided in request payload
     * @param {*} referrerRebate amount provided in request payload, this is the invoiceLine amount
     * @param {*} referrerInvoice invoice (If exists) with referrer rebate line
     * @returns {
     *  referrerInvoice: Invoice with the referrer line. If no rule apply, return an empty array so nothing is updated
     * }
     */
    static updateReferrerRebateInvoiceGraph(referrer, referrerRebateAmount, referrerInvoice, currentUser)
    {
        const referrerInvoiceToReturn = [];

        // Rule 1
        if (referrer?.guid && !referrerInvoice)
        {
            const [referrerInvoiceToCreate] = OrderService.createReferrerRebateInvoice(referrerRebateAmount, referrer, currentUser);
            referrerInvoiceToReturn.push(referrerInvoiceToCreate);
        }

        // Rule 2
        else if (referrerInvoice && (referrer?.guid || referrerRebateAmount))
        {
            if (referrer?.guid)
            {
                referrerInvoice.consigneeGuid = referrer.guid;
                referrerInvoice.setUpdatedBy(currentUser);
            }

            if (referrerRebateAmount)
            {
                referrerInvoice.lines[0].amount = referrerRebateAmount;
                referrerInvoice.lines[0].setUpdatedBy(currentUser);
            }

            referrerInvoiceToReturn.push(referrerInvoice);
        }

        return referrerInvoiceToReturn;
    }

    /**
     * New job bills need to be created in case the job does not have any, and that has to be
     * before the order Upsert runs so the graph path from invoiceLine to the order is
     * complete and the DB trigger can calculate the actual expense and revenue correctly
     * @param {*} invoiceBillsFromDB
     * @param {*} jobs
     * @param {*} currentUser
     * @param {*} trx
     * @returns
     */
    static async createMissingJobBills(invoiceBillsFromDB, jobs, currentUser, trx)
    {
        const billsToCreate = [];
        const existingBills = [];
        for (const job of jobs)
        {
            const billFound = invoiceBillsFromDB.find(bill => bill.job?.guid === job.guid);
            if (!billFound)
            {
                const newJobBill = OrderService.createInvoiceBillGraph(
                    [], false, currentUser, null
                );
                newJobBill.job = { guid: job.guid };
                billsToCreate.push(
                    InvoiceBill.query(trx).insertGraphAndFetch(newJobBill, {
                        relate: true,
                        noDelete: true,
                        allowRefs: true
                    })
                );
            }
            else
                existingBills.push(billFound);
        }

        const newJobBills = await Promise.all(billsToCreate);
        return [...newJobBills, ...existingBills];
    }

    static async findByVin(vin)
    {
        // find order where commodity has vin
        const comms = await Commodity.query()
            .where({ identifier: vin })
            .withGraphJoined('order')
            .orderBy('order.dateCreated', 'desc');

        return comms.map((com) =>
        {
            return {
                guid: com.order?.guid,
                number: com.order?.number,
                dateCreated: com.order?.dateCreated
            };
        });
    }

    static async bulkUpdateUsers({ orders = [], dispatcher = undefined, salesperson = undefined })
    {
        const payload = {
            dispatcherGuid: dispatcher,
            salespersonGuid: salesperson
        };

        // remove and check for undefineds
        const cleaned = R.pickBy((it) => it !== undefined, payload);

        if (Object.keys(cleaned).length === 0)
            throw new MissingDataError('Missing Update Values');

        const promises = await Promise.allSettled(orders.map(async (order) =>
        {
            // need to catch and throw in order to be able to return the guid for mapping of errors
            const res = await Order.query().findById(order).patch(payload).returning('guid')
                .catch((err) => { throw { guid: order, data: err }; });

            return { guid: order, data: res };
        }));

        const bulkResponse = new BulkResponse();
        for (const e of promises)
        {
            if (e.reason)
            {
                bulkResponse
                    .addResponse(e.reason.guid, e.reason.data)
                    .getResponse(e.reason.guid)
                    .setStatus(400);
            }
            else if (e.value?.data === undefined)
            {
                bulkResponse
                    .addResponse(e.value.guid, new NotFoundError('Order Not Found'))
                    .getResponse(e.value.guid)
                    .setStatus(404);
            }
            else if (e.value.data)
                bulkResponse.addResponse(e.value.guid).getResponse(e.value.guid).setStatus(200).setData(e.value.data);
        }

        return bulkResponse;
    }

    static async getTransportJobsIds(orderGuid)
    {
        return await OrderJob.query().select('guid', 'createdByGuid')
            .where('orderGuid', orderGuid)
            .andWhere('isTransport', true);
    }

    static async markOrderOnHold(orderGuid, currentUser)
    {
        const [trx, order] = await Promise.all([
            Order.startTransaction(),
            Order.query()
                .where({
                    'orders.guid': orderGuid
                })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (order.isOnHold)
            return 200;

        // check that there are no vendors on any of the jobs
        for (const job of order.jobs)
            if (job.vendorGuid)
                throw new DataConflictError(`Related Job ${job.number} shouldn't have a vendor`);

        // if we got here mark all jobs on hold and the order on hold
        try
        {
            await Promise.all(
                [
                    ...order.jobs.map(async (job) =>
                    {
                        OrderJobService.addHold(job.guid, currentUser);
                    }),
                    Order.query(trx).patch({
                        'isOnHold': true,
                        'isReady': false,
                        'updatedByGuid': currentUser,
                        'status': 'on hold'
                    }).where({ 'guid': order.guid })
                ]
            );

            await trx.commit();

            emitter.emit('order_hold_added', order.guid);
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async removeHoldOnOrder(orderGuid, currentUser)
    {
        const [trx, order] = await Promise.all([
            Order.startTransaction(),
            Order.query()
                .where({
                    'orders.guid': orderGuid
                })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (!order.isOnHold)
            return 200;

        // check that there are no vendors on any of the jobs
        for (const job of order.jobs)
            if (job.vendorGuid)
                throw new DataConflictError(`Related Job ${job.number} shouldn't have a vendor`);

        // if we got here mark all jobs on hold and the order on hold
        try
        {
            await Promise.all(
                [
                    ...order.jobs.map(async (job) =>
                    {
                        OrderJobService.removeHold(job.guid, currentUser);
                    }),
                    Order.query(trx).patch({
                        'isOnHold': false,
                        'isReady': true,
                        'updatedByGuid': currentUser,
                        'status': 'ready'
                    }).where({ 'guid': order.guid })
                ]
            );

            await trx.commit();

            emitter.emit('order_hold_removed', order.guid);
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async markOrderComplete(orderGuid, currentUser)
    {
        const [order] = await Promise.all([
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .withGraphJoined('commodities.[vehicle]')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (order.isOnHold)
            throw new DataConflictError('Order is On Hold');
        else if (!order.isReady)
            throw new DataConflictError('Order is Not Ready');
        else if (order.isComplete)
            return 200;

        // check that each transport job has a vendor and all commodities are delivered
        for (const job of order.jobs)
            if (!job.vendorGuid)
                throw new MissingDataError(`Related Job ${job.number} doesn't have a Vendor`);

        for (const commodity of order.commodities)
            if (commodity.deliveryStatus !== 'delivered')
                throw new DataConflictError(`Commodity ${commodity.vehicle.number} is not Delivered`);

        // if we got here mark all jobs complete and the order complete
        await Promise.all(
            [
                ...order.jobs.map(async (job) =>
                {
                    OrderJobService.markJobAsComplete(job.guid, currentUser);
                }),
                Order.query().patch({
                    'isComplete': true,
                    'updatedByGuid': currentUser,
                    'status': 'complete'
                }).where({ 'guid': order.guid })
            ]
        );

        emitter.emit('order_complete', orderGuid);

        return 200;
    }

    static async markOrderUncomplete(orderGuid, currentUser)
    {
        const [order] = await Promise.all([
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (!order.isComplete)
            return 200;

        // if we got here mark all jobs uncomplete/delivered and the order uncomplete/delivered
        await Promise.all(
            [
                ...order.jobs.map(async (job) =>
                {
                    OrderJobService.markJobAsUncomplete(job.guid, currentUser);
                }),
                Order.query().patch({
                    'isComplete': false,
                    'updatedByGuid': currentUser,
                    'status': 'delivered'
                }).where('guid', order.guid)
            ]
        );

        emitter.emit('order_uncomplete', orderGuid);

        return 200;
    }

    static async markAsScheduled(orderGuid, currentUser)
    {
        const [order] = await Promise.all([
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (!order.isReady)
            throw new DataConflictError('Order is Not Ready');
        else if (order.isOnHold)
            throw new DataConflictError('Order is On Hold');
        else if (order.status === 'scheduled')
            return 200;

        // make sure at least one job has a vendor assigned
        let hasVendor = false;
        for (const job of order.jobs)
            if (job.isTransport && job.vendorGuid)
                hasVendor = true;

        if (!hasVendor)
            throw new MissingDataError('Order\'s Jobs Have No Vendors Assigned');

        // if we got here mark the order scheduled
        await Order.query().patch({
            'updatedByGuid': currentUser,
            'status': 'scheduled'
        }).where('guid', order.guid);

        emitter.emit('order_scheduled', orderGuid);

        return 200;
    }

    static async markAsUnscheduled(orderGuid, currentUser)
    {
        const [order] = await Promise.all([
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (order.status === 'ready')
            return 200;

        // make sure there are no jobs with vendors assigned
        for (const job of order.jobs)
            if (job.isTransport && job.vendorGuid)
                throw new DataConflictError('Order\'s Jobs Should Not Have Vendors Assigned');

        await Order.query().patch({
            'updatedByGuid': currentUser,
            'status': 'ready'
        }).where('guid', order.guid);

        emitter.emit('order_unscheduled', orderGuid);

        return 200;
    }

    static async deleteOrder(orderGuid, currentUser)
    {
        const [trx, order] = await Promise.all([
            Order.startTransaction(),
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            return 200;

        // make sure no vendor is assigned to any jobs
        for (const job of order.jobs)
            if (job.vendorGuid)
                throw new DataConflictError('Order\'s Jobs Should Not Have Vendors Assigned');

        // if we got here mark all jobs deleted and the order deleted
        try
        {
            await Promise.all(
                [
                    ...order.jobs.map(async (job) =>
                    {
                        OrderJobService.deleteJob(job.guid, currentUser);
                    }),
                    Order.query(trx).patch({
                        'isDeleted': true,
                        'isReady': false,
                        'status': 'deleted',
                        'updatedByGuid': currentUser
                    }).where('guid', order.guid)
                ]
            );

            await trx.commit();

            emitter.emit('order_deleted', orderGuid);

            return 200;
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async undeleteOrder(orderGuid, currentUser)
    {
        const [trx, order] = await Promise.all([
            Order.startTransaction(),
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (!order.isDeleted)
            return 200;

        // if we got here mark all jobs undeleted and the order undeleted
        try
        {
            await Promise.all(
                [
                    ...order.jobs.map(async (job) =>
                    {
                        OrderJobService.undeleteJob(job.guid, currentUser);
                    }),
                    Order.query(trx).patch({
                        'isDeleted': false,
                        'isCanceled': false,
                        'status': 'ready',
                        'updatedByGuid': currentUser
                    }).where('guid', order.guid)
                ]
            );

            await trx.commit();

            emitter.emit('order_undeleted', orderGuid);

            return 200;
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async markOrderDelivered(orderGuid, currentUser, jobGuid)
    {
        const [order] = await Promise.all([
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .withGraphJoined('commodities.[vehicle]')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            throw new DataConflictError('Order is Canceled');
        else if (order.status === 'delivered')
            return 200;
        else if (order.status !== 'picked up')
            throw new DataConflictError('Order Must First Be Picked Up');

        // make sure vendor is assigned to all transport jobs and all jobs are delivered
        for (const job of order.jobs)
            if ((job.isTransport && !job.vendorGuid))
                throw new MissingDataError(`Order's Job ${job.number} Has No Vendor Assigned`);
            else if (job.status !== 'delivered')
                throw new DataConflictError(`Order's Job ${job.number} Is Not Delivered`);

        // make sure all commodities are marked as delivered
        for (const commodity of order.commodities)
            if (commodity.deliveryStatus !== 'delivered')
                throw new DataConflictError(`Order's Commodity ${commodity.vehicle.name} Has Not Been Delivered`);

        // if we got here mark order as delivered
        await Order.query().patch({
            'status': 'delivered',
            'updatedByGuid': currentUser
        }).where('guid', order.guid);

        emitter.emit('order_delivered', { orderGuid, jobGuid, currentUser });

        return 200;
    }

    static async markOrderUndelivered(orderGuid, currentUser)
    {
        const order = await Order.query()
            .where({ 'orders.guid': orderGuid })
            .withGraphJoined('jobs')
            .first();

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            new DataConflictError('Order is Canceled');
        else if (order.status === 'picked up')
            return 200;
        else if (order.status !== 'delivered')
            throw new DataConflictError('Order Must First Be Delivered');

        for (const job of order.jobs)
            if (job.status !== 'pick up')
                throw new DataConflictError(`Job ${job.guid} Is Not Pick Up`);

        // if we got here mark the order undelivered
        await Order.query().patch({
            'status': 'picked up',
            'updatedByGuid': currentUser
        });

        emitter.emit('order_undelivered', orderGuid);

        return 200;
    }

    static async cancelOrder(orderGuid, currentUser)
    {
        const [trx, order] = await Promise.all([
            Order.startTransaction(),
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (['completed', 'delivered'].includes(order.status))
            throw new DataConflictError('Can Not Cancel Completed or Delivered Order');
        else if (order.isCanceled)
            return 200;

        // if we got here mark all jobs canceled and the order canceled
        try
        {
            await Promise.all(
                [
                    ...order.jobs.map(async (job) =>
                    {
                        OrderJobService.updateJobStatus(job.guid, 'canceled', currentUser, trx);
                    }),
                    Order.query(trx).patch({
                        'isCanceled': true,
                        'isOnHold': false,
                        'isReady': false,
                        'status': 'canceled',
                        'updatedByGuid': currentUser
                    }).where('guid', order.guid)
                ]
            );

            await trx.commit();

            emitter.emit('order_canceled', orderGuid);

            return 200;
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async uncancelOrder(orderGuid, currentUser)
    {
        const [trx, order] = await Promise.all([
            Order.startTransaction(),
            Order.query()
                .where({ 'orders.guid': orderGuid })
                .withGraphJoined('jobs')
                .first()
        ]);

        if (!order)
            throw new NotFoundError('Order Not Found');
        else if (order.isDeleted)
            throw new DataConflictError('Order is Deleted');
        else if (order.isCanceled)
            return 200;

        // if we got here mark all jobs uncanceled and the order uncanceled
        try
        {
            await Promise.all(
                [
                    ...order.jobs.map(async (job) =>
                    {
                        OrderJobService.uncancelJob(job.guid, currentUser);
                    }),
                    Order.query(trx).patch({
                        'isCanceled': false,
                        'status': 'new',
                        'updatedByGuid': currentUser
                    }).where('guid', order.guid)
                ]
            );

            await trx.commit();

            emitter.emit('order_uncanceled', orderGuid);

            return 200;
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async markOrderReady(orderGuid, currentUser)
    {
        try
        {
            // Get the number of jobs that are ready for this order guid.
            // Knex returns this query as an array of objects with a count property.
            const readyJobsCount = (await OrderJob.query().count('guid').where({ orderGuid, isReady: true }))[0].count;

            // WARNING: The COUNT() query in knex with pg returns the count as a string, so
            // the following comparison only works because of javascript magic
            if (readyJobsCount >= 1)
            {
                await Order.query().patch({
                    isReady: true,
                    status: 'ready',
                    'updatedByGuid': currentUser
                }).findById(orderGuid);
            }
        }
        catch (error)
        {
            throw new DataConflictError('Order Cannot be set to ready.');
        }
    }

    static async recalcDistancesAfterTerminalResolution(terminalGuid)
    {
        // get orders that have stops that use this terminal
        const orders = await Order.query()
            .select('orders.guid')
            .whereNull('distance')
            .withGraphJoined('stops')
            .where('stops.terminalGuid', terminalGuid);

        for (const order of orders)
            await OrderService.calculatedDistances(order.guid);
    }
}

module.exports = OrderService;

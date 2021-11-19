const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const LoadboardService = require('../Services/LoadboardService');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const ComparisonType = require('../Models/ComparisonType');
const GeneralFuncApi = require('../Azure/GeneralFuncApi');
const OrderStopLink = require('../Models/OrderStopLink');
const CommodityType = require('../Models/CommodityType');
const OrderJobType = require('../Models/OrderJobType');
const SFRecordType = require('../Models/SFRecordType');
const Contact = require('../Models/TerminalContact');
const InvoiceBill = require('../Models/InvoiceBill');
const InvoiceLine = require('../Models/InvoiceLine');
const SFAccount = require('../Models/SFAccount');
const OrderStop = require('../Models/OrderStop');
const SFContact = require('../Models/SFContact');
const Commodity = require('../Models/Commodity');
const StatusLog = require('../Models/StatusLog');
const ArcgisClient = require('../ArcgisClient');
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

const isUseful = R.compose(R.not, R.anyPass([R.isEmpty, R.isNil]));
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 3600 });

let dateFilterComparisonTypes;

const logicAppInstance = axios.create({
    baseURL: process.env['azure.logicApp.BaseUrl'],
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: { 'Content-Type': 'application/json' }
});

class OrderService
{
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
            isTender,
            jobCategory
        },
        page,
        rowCount,
        sort,
        globalSearch
    )
    {
        dateFilterComparisonTypes =
            dates && (await OrderService.getComparisonTypesCached());
        const jobFieldsToReturn = [
            'guid',
            'number',
            'estimatedExpense',
            'estimatedRevenue',
            'status',
            'dateCreated',
            'actualRevenue',
            'actualExpense',
            'dateUpdated'
        ];

        const baseOrderQuery = OrderJob.query()
            .select(jobFieldsToReturn)
            .page(page, rowCount);

        // if global search is enabled
        // global search includes job#, customerName, customerContactName, customerContactEmail, Vin, lot, carrierName
        if (globalSearch?.query)
            baseOrderQuery.modify('globalSearch', globalSearch.query);

        const queryFilterPickup = OrderService.addFilterPickups(
            baseOrderQuery,
            pickup
        );
        const queryFilterDelivery = OrderService.addFilterDeliveries(
            queryFilterPickup,
            delivery
        );
        const queryFilterStatus = OrderService.addFilterStatus(
            queryFilterDelivery,
            status
        );
        const queryFilterCustomer = OrderService.addFilterCustomer(
            queryFilterStatus,
            customer
        );
        const queryFilterDispatcher = OrderService.addFilterDispatcher(
            queryFilterCustomer,
            dispatcher
        );
        const queryFilterSalesperson = OrderService.addFilterSalesperson(
            queryFilterDispatcher,
            salesperson
        );
        const queryFilterCarrier = OrderService.addFilterCarrier(
            queryFilterSalesperson,
            carrier
        );
        const queryFilterDates = OrderService.addFilterDates(
            queryFilterCarrier,
            dates
        );
        const queryAllFilters = OrderService.addFilterModifiers(
            queryFilterDates,
            { isTender, jobCategory, sort }
        );

        const queryWithGraphModifiers = OrderService.addGraphModifiers(
            queryAllFilters,
            jobCategory
        );

        const { total, results } = await queryWithGraphModifiers;
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
                if (order.clientNotes)
                {
                    // getting the user details so we can show the note users details
                    const user = await User.query().findById(
                        order.clientNotes.updatedByGuid
                    );
                    Object.assign(order?.clientNotes, {
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
            const dataCheck = { client: true, vehicles: false, terminals: false };
            const jobsDataCheck = [];

            // order object will be used to link OrderStopLink from the job
            const order = Order.fromJson({
                // these fields cannot be set by the user
                status: 'new',
                isDeleted: false,
                isCompleted: false,
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
                dateExpectedCompleteBy: orderObj.dateExpectedCompleteBy
            });

            order.setCreatedBy(currentUser);

            // DO NOT change the ordering of these promises, it will mess up _dataCheck and other destructured code
            let orderInfoPromises = [];
            orderInfoPromises.push(SFAccount.query(trx).modify('client', orderObj.client.guid));
            orderInfoPromises.push(dataCheck.consignee = isUseful(orderObj.consignee) ? SFAccount.query(trx).modify('bySomeId', orderObj.consignee.guid) : null);
            orderInfoPromises.push(dataCheck.dispatcher = isUseful(orderObj.dispatcher) ? User.query(trx).findById(orderObj.dispatcher.guid) : null);
            orderInfoPromises.push(dataCheck.referrer = isUseful(orderObj.referrer) ? SFAccount.query(trx).findById(orderObj.referrer.guid) : null);
            orderInfoPromises.push(dataCheck.salesperson = isUseful(orderObj.salesperson) ? SFAccount.query(trx).findById(orderObj.salesperson.guid) : null);
            orderInfoPromises.push(Promise.all(orderObj.terminals.map(t =>
            {
                const term = Terminal.fromJson(t);
                term.setCreatedBy(currentUser);
                return term.findOrCreate(trx).then(term => { term['#id'] = t['#id']; return term; });
            })));
            orderInfoPromises.push(Promise.all(orderObj.commodities.map(com => isUseful(com.vehicle) ? Vehicle.fromJson(com.vehicle).findOrCreate(trx) : null)));

            const jobInfoPromises = [];
            for (const job of orderObj.jobs)
            {
                const jobPromises = [];
                const jobDataCheck = {};
                jobPromises.push(jobDataCheck.vendor = isUseful(job.vendor) ? SFAccount.query(trx).modify('byType', 'carrier').findById(job.vendor.guid) : null);
            }

            // use trx (transaction) because none of the data should be left in the database if any of it fails
            const [
                contactRecordType,
                commTypes,
                jobTypes,
                invoiceLineItems,
                orderInformation,
                jobInformation
            ] = await Promise.all([
                SFRecordType.query(trx).modify('byType', 'contact').modify('byName', 'account contact'),
                CommodityType.query(trx),
                OrderJobType.query(trx),
                InvoiceLineItem.query(trx),
                Promise.all(orderInfoPromises),
                Promise.all(jobInfoPromises)
            ]);

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
            order.graphLink('consignee', consignee || client);
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

            // create promises for each contact that the stops will be using
            const allStops = Order.allStops(orderObj).map(it => OrderStop.fromJson(it));
            orderInfoPromises.push(Promise.all(allStops.map((stop) =>
            {
                const terminal = terminalsCache[stop.terminal];
                for (const contactType of OrderStop.contactTypes)
                {
                    if (stop[contactType])
                    {
                        const contact = Contact.fromJson(stop[contactType]);
                        contact.linkTerminal(terminal);
                        contact.setCreatedBy(currentUser);
                        return contact.findOrCreate(trx);
                    }
                    else
                    {
                        return null;
                    }
                }
            })));

            // commodities are reused in the system
            const commodityCache = orderObj.commodities.reduce((cache, com, i) =>
            {
                const commodity = Commodity.fromJson(com);
                const commType = commTypes.find((it) => CommodityType.compare(commodity, it));
                if (!commType)
                {
                    const commTypeStr = commodity.typeId ? commodity.typeId : `${commodity.commType?.category} ${commodity.commType?.type}`;
                    throw new Error(`Unknown commodity type: ${commTypeStr}`);
                }
                commodity.graphLink('commType', commType);
                commodity.setCreatedBy(currentUser);

                // check to see if the commodity is a vehicle (it would have been created or found in the database)
                vehicles[i] && commodity.graphLink('vehicle', vehicles[i]);
                cache[com['#id']] = commodity;
                return cache;
            }, {});

            const [clientContact, stopContacts] = await Promise.all(orderInfoPromises);

            order.graphLink('clientContact', clientContact);

            for (const stop of allStops)
            {
                for (const contactType of OrderStop.contactTypes)
                {
                    const contact = stopContacts.shift();
                    if (contact)
                    {
                        stop.graphLink(contactType, contact);
                    }
                }
            }

            // orders will have defined all the stops that are needed to be completed
            // for this order to be classified as completed as well
            // however, jobs will also use these stops and will have their own stops that will
            // not appear in the orders
            const stopsCache = {};

            const orderStops = orderObj.stops.map((stopObj =>
            {
                const stop = OrderStop.fromJson(stopObj);
                stop.setCreatedBy(currentUser);
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
                        throw new Error('Vendor doesnt exist');

                    job.graphLink('vendor', jobVendor);
                }

                if (isUseful(job.vendorContact))
                {
                    if (!jobVendorContact)
                        throw new Error('Vendor contact doesnt exist');

                    job.graphLink('vendorContact', jobVendorContact);
                }

                // this is the driver and what not
                if (isUseful(job.vendorAgent))
                {
                    if (!jobVendorAgent)
                        throw new Error('Vendor agent doesnt exist');

                    job.graphLink('vendorAgent', jobVendorAgent);
                }

                if (isUseful(job.dispatcher))
                {
                    if (!jobDispatcher)
                        throw new Error(`Dispatcher ${job.dispatcher.guid} doesnt exist`);

                    job.graphLink('dispatcher', jobDispatcher);
                }

                const jobType = jobTypes.find((it) =>
                    OrderJobType.compare(job, it)
                );
                if (!jobType)
                {
                    throw new Error(
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
                    jobData.bills = OrderService.createInvoiceBillGraph(jobBillLines, false, currentUser);

                /**
                * For order creation. given that all invoices are "transport", the actual and estimated expense and revenue have the same values
                */
                jobData.estimatedExpense = expense.value;
                jobData.actualExpense = expense.value;

                jobData.estimatedRevenue = revenue.value;
                jobData.actualRevenue = revenue.value;

                orderJobs.push(jobData);
            }

            order.jobs = orderJobs;
            order.invoices = OrderService.createInvoiceBillGraph(orderInvoices, true, currentUser, order.consignee);

            const orderCreated = await Order.query(trx).skipUndefined()
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
            consignee
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
            throw new Error('_dataCheck dataCheck keys length do not match the dataRecs length');
        }

        for (const [i, key] of keys.entries())
        {
            if (dataCheck[key] && !dataRecs[i])
            {
                throw new Error(`${key} record doesn't exist.`);
            }
        }

    }

    static async calculateTotalDistance(stops)
    {
        // go through every order stop
        stops.sort(OrderStop.sortBySequence);

        // converting terminals into address strings
        const terminalStrings = stops.map((stop) =>
        {
            return JSON.parse(stop.terminal.toApiString());
        });

        // send all terminals to the General Function app and recieve only the distance value
        return await GeneralFuncApi.calculateDistances(terminalStrings);
    }

    static async calculatedDistances(OrderGuid)
    {
        // relations obejct for none repetitive code
        const stopRelationObj = {
            $modify: ['distinct'],
            terminal: true
        };

        // TODO:add functionality to push to error DB when transaction fails

        // start transaction to update distances
        await Order.transaction(async (trx) =>
        {
            // get OrderStops and JobStops from database Fancy smancy queries
            const order = await Order.query(trx).withGraphJoined({
                jobs: { stops: stopRelationObj },
                stops: stopRelationObj
            }).findById(OrderGuid);

            // array for transaction promises
            const patchPromises = [];

            let orderCounted = false;
            for (const orderjob of [order, ...order.jobs])
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
                    OrderService.calculateTotalDistance(orderjob.stops).then(async (distance) =>
                    {
                        console.log(orderjob.guid);
                        console.log(distance);
                        await model.query(trx).patch({ distance }).findById(orderjob.guid);
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

        // array to store promises
        const patchArray = [];

        // compate order stops
        if (oldOrder.stops.length != updatedOrder.stops.length)
        {
            console.log('Updating Order Terminals');

            // calculate distance
            patchArray(OrderService.calculateTotalDistance(updatedOrder.stops).then(async (distance) =>
            {
                await Order.query().patch({ distance }).findById(updatedOrder.guid);
            }));
        }
        else
        {
            for (let i = 0; i < updatedOrder.stops.length; i++)
            {
                // if terminals are not the same
                if (!R.equals(updatedOrder.stops[i].terminal, oldOrder.stops[i].terminal))
                {
                    console.log('Updating Order Terminal');

                    // calculate distance
                    patchArray(OrderService.calculateTotalDistance(updatedOrder.stops).then(async (distance) =>
                    {
                        await Order.query().patch({ distance }).findById(updatedOrder.guid);
                    }));
                }
            }
        }

        // loop through jobs array
        for (let i = 0; i < updatedOrder.jobs.length; i++)
        {
            // if job stops length is different
            if (updatedOrder.jobs[i].stops.length != oldOrder.jobs[i].stops.length)
            {
                console.log('Updateing Job terminals');

                // calculate distance of jobs stops
                patchArray(OrderService.calculateTotalDistance(updatedOrder.jobs[i].stops).then(async (distance) =>
                {
                    await OrderJob.query().patch({ distance }).findById(updatedOrder.jobs[i].guid);
                }));
            }
            else
            {
                // loop through job stops terminals
                for (let j = 0; j < updatedOrder.jobs[i].stops.length; j++)
                {
                    // if terminals are not the same
                    if (!R.equals(updatedOrder.jobs[i].stops[j].terminal, oldOrder.jobs[i].stops[j].terminal))
                    {
                        console.log('Updating Job Stop!');

                        // calculate distance
                        patchArray(OrderService.calculateTotalDistance(updatedOrder.jobs[i].stops).then(async (distance) =>
                        {
                            await OrderJob.query().patch({ distance }).findById(updatedOrder.jobs[i].guid);
                        }));
                    }
                }
            }
        }

        if (patchArray.length != 0)
        {
            await Promise.all(patchArray);
        }
    }

    /**
     * @param {('accept' | 'reject')} action
     * @param {string []} orderGuids
     * @param {string} reason
     * @returns {{orderGuid: string, jobGuid: string, status: number, message: string | null}} reason
     */
    static async handleLoadTenders(action, orderGuids, reason)
    {
        const responses = [];

        const orders = await Order.query().skipUndefined().findByIds(orderGuids).withGraphJoined('[client, ediData, jobs]');

        /**
         * if the lengths do not match, that means one of the orders does not exist.
         * find the guid that does not exist and add it to responses
         */

        const hashedOrders = orders.reduce((map, obj) =>
        {
            map[obj.guid] = obj;
            return map;
        }, {});

        const filteredOrders = [];
        for (const guid of orderGuids)
        {
            if (hashedOrders[guid] === undefined)
            {
                responses.push({
                    orderGuid: guid,
                    jobGuid: null,
                    status: 404,
                    message: 'Order not found.'
                });
            }
            else
            {
                let message = null;

                if (hashedOrders[guid].jobs[0].isTransport === false)
                {
                    message = 'Order does not have a transport job.';
                }

                if (hashedOrders[guid].isTender === false)
                {
                    message = 'Order is not a tender.';
                }

                if (hashedOrders[guid].isDeleted === true)
                {
                    message = 'Order is deleted.';
                }

                if (message)
                {
                    responses.push({
                        orderGuid: guid,
                        jobGuid: null,
                        status: 400,
                        message
                    });
                }

                if (hashedOrders[guid].isTender && !hashedOrders[guid].isDeleted)
                {
                    filteredOrders.push(hashedOrders[guid]);
                }
            }
        }

        const logicAppPayloads = filteredOrders.map((item) => ({
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

        let apiResponses = [];
        if (filteredOrders.length)
        {
            apiResponses = await Promise.allSettled(logicAppPayloads.map((item) => logicAppInstance.post(process.env['azure.logicApp.params'], item)));
        }

        const formattedResponses = apiResponses.map((item, index) => ({
            orderGuid: filteredOrders[index].guid,
            jobGuid: filteredOrders[index].jobs[0].guid,
            status: item.status === 'fulfilled' ? 200 : 400,
            message: item?.reason?.message || null
        }));

        return [...responses, ...formattedResponses];
    }

    /**
     * @param {{orderGuid: string, jobGuid: string, status: Number, message: string | null} []} responses
     * @param {boolean} isTender
     * @param {boolean} isDeleted
     * @param {number} statusId
     * @param {string} currentUser
     * @returns {Promise<undefined>}
     */
    static async loadTendersHelper(responses, isTender, isDeleted, statusId, currentUser)
    {
        const successfulResponses = responses.filter((item) => item.status === 200);

        const successfulResponseGuids = successfulResponses.map((item) => item.orderGuid);

        if (successfulResponseGuids.length)
        {
            await Order.query().skipUndefined().findByIds(successfulResponseGuids).patch({
                isTender,
                isDeleted,
                status: 'New'
            });

            await Promise.allSettled(successfulResponses.map((item) =>
                StatusManagerHandler.registerStatus({
                    orderGuid: item.orderGuid,
                    jobGuid: item.jobGuid,
                    userGuid: currentUser,
                    statusId
                })));

        }
    }

    /**
     * @param {string []} orderGuids
     * @param {string} currentUser
     * @returns {Promise<{guid: string, status: number, message: string} []>} currentUser
     */
    static async acceptLoadTenders(orderGuids, currentUser)
    {
        const responses = await this.handleLoadTenders('accept', orderGuids, null);

        await this.loadTendersHelper(responses, false, false, 8, currentUser);

        return responses;
    }

    /**
     * @param {string []} orderGuids
     * @param {string} reason
     * @param {string} currentUser
     */
    static async rejectLoadTenders(orderGuids, reason, currentUser)
    {
        const responses = await this.handleLoadTenders('reject', orderGuids, reason);

        await this.loadTendersHelper(responses, true, true, 9, currentUser);

        return responses;
    }

    static async updateClientNote(orderGuid, body, currentUser)
    {
        const order = Order.fromJson({});
        order.setClientNote(body.note, currentUser);
        order.setUpdatedBy(currentUser);
        const numOfUpdatedOrders = await Order.query().patch(order).findById(orderGuid);
        if (numOfUpdatedOrders == 0)
        {
            throw new Error('No order found');
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
                const getSTWithinFunction = OrderService.getSTWithin(
                    coordinates.latitude,
                    coordinates.longitude,
                    coordinates.radius
                );

                return index === 0
                    ? this.where(getSTWithinFunction)
                    : query.orWhere(getSTWithinFunction);
            }, undefined);
        });
    }

    static addFilterStatus(baseQuery, statusList)
    {
        return statusList?.length
            ? baseQuery.whereRaw('status ilike ANY(Array[?])', statusList)
            : baseQuery;
    }

    static addFilterCustomer(baseQuery, customerList)
    {
        return customerList?.length
            ? baseQuery.whereIn(
                'orderGuid',
                Order.query()
                    .select('guid')
                    .whereIn('clientGuid', customerList)
            )
            : baseQuery;
    }

    static addFilterDispatcher(baseQuery, dispatcherList)
    {
        return dispatcherList?.length
            ? baseQuery.whereIn(
                'orderGuid',
                Order.query()
                    .select('guid')
                    .whereIn('dispatcherGuid', dispatcherList)
            )
            : baseQuery;
    }

    static addFilterSalesperson(baseQuery, salespersonList)
    {
        return salespersonList?.length
            ? baseQuery.whereIn(
                'orderGuid',
                Order.query()
                    .select('guid')
                    .whereIn('salespersonGuid', salespersonList)
            )
            : baseQuery;
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
                            .andWhere('statusId', dateElement.status);
                    };

                    return query.orWhere(comparisonDateAndStatus);
                }, this);
            };

            return query.andWhere(comparisonDatesByStatus);
        }, StatusLog.query().select('jobGuid'));

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

    static addFilterCarrier(baseQuery, carrierList)
    {
        const doesCarrierListHaveElements =
            carrierList?.length > 0 ? true : false;
        return doesCarrierListHaveElements
            ? baseQuery.whereIn('vendorGuid', carrierList)
            : baseQuery;
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
                            'typeId'
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
        );
    }

    static addFilterModifiers(baseQuery, filters)
    {
        const { isTender, jobCategory, sort } = filters;
        return baseQuery
            .modify('filterIsTender', isTender)
            .modify('filterJobCategories', jobCategory)
            .modify('sorted', sort);
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
            ...orderData
        } = orderInput;

        try
        {
            const [
                contactRecordType,
                clientFound,
                commodityTypes,
                jobTypes,
                invoiceBills,
                orderInvoices,
                referencesChecked
            ] = await Promise.all([
                clientContact
                    ? SFRecordType.query(trx)
                        .modify('byType', 'contact')
                        .modify('byName', 'account contact')
                    : null,
                client?.guid
                    ? OrderService.findSFClient(client.guid, trx)
                    : undefined,
                commodities.length > 0 ? CommodityType.query(trx) : null,
                jobs.length > 0 ? OrderJobType.query(trx) : null,
                OrderService.getInvoiceBills(jobs),
                OrderService.getOrderInvoices(guid),
                OrderService.validateReferencesBeforeUpdate(
                    clientContact,
                    guid,
                    stops,
                    terminals
                )
            ]);

            /**
             * terminalsChecked and stopsChecked contains the action to perform for terminals and stop terminal contacts.
             */
            const { newOrderContactChecked, terminalsChecked, stopsChecked } =
                referencesChecked;

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

            // Create stop contacts using terminals and return an object to faciliatet access, it uses the action from stopsChecked
            const stopContactsGraphMap =
                await OrderService.createStopContactsMap(
                    stopsChecked,
                    terminalsMap,
                    currentUser,
                    trx
                );

            const stopsToUpdate = OrderService.createStopsGraph(
                stopsChecked,
                terminalsMap,
                stopContactsGraphMap,
                currentUser
            );
            const jobsToUpdate = OrderService.createJobsGraph(
                jobs,
                jobTypes,
                currentUser
            );
            const stopLinksToUpdate = OrderService.updateCreateStopLinks(
                stopsChecked,
                jobs,
                guid,
                commoditiesMap,
                currentUser,
                trx
            );

            const { jobsToUpdateWithExpenses, orderInvoicesToUpdate } = OrderService.updateExpensesGraph(
                commoditiesMap,
                invoiceBills,
                orderInvoices,
                jobsToUpdate,
                currentUser
            );

            const orderGraph = Order.fromJson({
                guid,
                updatedByGuid: currentUser,
                dispatcherGuid:
                    OrderService.getObjectContactReference(dispatcher),
                referrerGuid: OrderService.getObjectContactReference(referrer),
                salespersonGuid:
                    OrderService.getObjectContactReference(salesperson),
                clientGuid: client?.guid,
                consigneeGuid: consignee?.guid,
                instructions,
                clientContactGuid: orderContactCreated,
                stops: stopsToUpdate,
                invoices: orderInvoicesToUpdate,
                jobs: jobsToUpdateWithExpenses,
                ...orderData
            });
            orderGraph.setClientNote(orderData.clientNotes?.note, currentUser);

            const orderToUpdate = Order.query(trx)
                .skipUndefined()
                .upsertGraphAndFetch(orderGraph, {
                    relate: true,
                    noDelete: true,
                    allowRefs: true
                });

            const [orderUpdated] = await Promise.all([orderToUpdate, ...stopLinksToUpdate]);

            // TODO: Events here
            // update loadboard postings (async)
            orderUpdated.jobs.map(async (job) =>
            {
                await LoadboardService.updatePostings(job.guid)
                    .catch(err => console.log(err));
            });

            await trx.commit();
            return orderUpdated;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async getInvoiceBills(jobs)
    {
        const jobsGuids = jobs.map(job => job.guid);
        const allInvoiceBills = await InvoiceBill.query().select('*')
            .whereIn(
                'guid',
                Bill.query().select('billGuid').whereIn('jobGuid', jobsGuids)
            );

        return InvoiceBill.fetchGraph(allInvoiceBills, '[lines.link, job]')
            .modifyGraph('job', (builder) =>
                builder.select('guid')
            );
    }

    static async getOrderInvoices(orderGuid)
    {
        const allInvoices = await InvoiceBill.query().select('*')
            .whereIn(
                'guid',
                Invoice.query().select('invoiceGuid').where('orderGuid', orderGuid)
            );

        return InvoiceBill.fetchGraph(allInvoices, '[lines.link]');
    }

    // If contactObject is null -> reference should be removed
    static getObjectContactReference(contactObject)
    {
        return contactObject === null ? null : contactObject?.guid;
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
            stopsToChecked.push(
                OrderService.getStopsWithInfoChecked(stop, orderGuid)
            );

        // Return new terminals with info checkd if needs to be updated or created
        const terminalsToChecked = [];
        for (const terminal of terminals)
            terminalsToChecked.push(
                OrderService.getTerminalWithInfoChecked(terminal)
            );

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
            OrderService.checkTerminalContacReference(
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
     * Base information: Fileds use to create the address; Street1, city, state, zipCode and Country
     * Extra information: Fields that are not use to create the address; Street2 and Name
     * Checks the action to performed for a terminal.
     * Rules:
     * 0) If terminal GUID is provided, we check if the information is the same as the DB, this is to avoid
     *    calling Arcgis if the terminal has the same information.
     * 1) updateExtraFields: The B.I. is the same and only the E.I. changed, so we only update those fields
     *    of that existing Terminal
     * 2) findOrCreate: The B.I. changed, so we have to call Arcgis and then check in the DB if that record
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
    static async checkTerminalContacReference(terminalContact, orderGuid)
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
                throw new Error(
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
     * Base information (B.I.): Fileds use to create the address; Street1, city, state, zipCode and Country
     * Extra information (E.I.): Fields that are not use to create the address; Street2 and Name
     * findOrCreate: We call Arcgis to get Lat and Long -> We look in DB for that key, if it exists
     *      we pull that record and update the E.I., if not, we create a new record.
     *      In case Arcgis does not return a Lat and Long, we save the terminal without Lat and Long as
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

                const terminalUpdated = await Terminal.query(
                    trx
                ).patchAndFetchById(terminalToUpdate.guid, terminalToUpdate);

                return { terminal: terminalUpdated, index };
            case 'findOrCreate':
                let terminalCreated = {};
                const addressStr = Terminal.createStringAddress(terminalData);

                const arcgisTerminal =
                    ArcgisClient.isSetuped() &&
                    (await ArcgisClient.findGeocode(addressStr));

                if (
                    arcgisTerminal &&
                    ArcgisClient.isAddressFound(arcgisTerminal)
                )
                {
                    const { latitude, longitude } =
                        ArcgisClient.getCoordinatesFromTerminal(arcgisTerminal);
                    const terminalToUpdate = await Terminal.query().findOne({
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
                        const terminalToCreate = Terminal.fromJson({
                            latitude,
                            longitude,
                            isResolved: true,
                            ...terminalData
                        });
                        terminalToCreate.setCreatedBy(currentUser);

                        terminalCreated = await Terminal.query(
                            trx
                        ).insertAndFetch(terminalToCreate);
                    }
                }

                // Create new unresolved terminal
                else
                {
                    // No use terminal guid if provided
                    const { guid, ...terminalDataNoGuid } = terminalData;
                    const terminalToCreate =
                        Terminal.fromJson(terminalDataNoGuid);
                    terminalToCreate.setCreatedBy(currentUser);

                    terminalCreated = await Terminal.query(trx).insertAndFetch(
                        terminalToCreate
                    );
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
                        terminalContactToUpdate.mobileNumber =
                            contactInput.mobileNumber;
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
                    contactsUpdated[contactType] =
                        contactAction === 'remove' ? null : undefined;
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
        stop.setUpdatedBy(currentUser);

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
        if (terminalContact === null) return true;
        return false;
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
        const jobWithContactReferences =
            OrderService.createJobContactReferences(jobInput);
        const jobGraph = OrderJob.fromJson(jobWithContactReferences);

        if (jobGraph?.jobType?.category && jobGraph?.jobType?.type)
        {
            const jobType = jobTypes?.find((jobType) =>
                OrderJobType.compare(jobGraph, jobType)
            );
            if (!jobType)
            {
                throw new Error(
                    `unknown job type ${jobGraph.typeId ||
                    jobGraph.jobType.category + jobGraph.jobType.type
                    }`
                );
            }
            jobGraph.graphLink('jobType', jobType);
            jobGraph.setIsTransport(jobType);
        }
        jobGraph.setUpdatedBy(currentUser);
        return jobGraph;
    }

    static createJobContactReferences(jobInput)
    {
        const { dispatcher, vendor, vendorAgent, vendorContact, ...jobData } =
            jobInput;

        return {
            dispatcherGuid: OrderService.getObjectContactReference(dispatcher),
            vendorGuid: OrderService.getObjectContactReference(vendor),
            vendorAgentGuid:
                OrderService.getObjectContactReference(vendorAgent),
            vendorContactGuid:
                OrderService.getObjectContactReference(vendorContact),
            ...jobData
        };
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
            commoditiesMap
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
    static createJobStopLinksObjects(jobs, stopsFromInput, commoditiesMap)
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
                                            orderGuid: null,
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
    static updateExpensesGraph(commoditiesMap, invoiceBillsFromDB, orderInvoiceFromDB, jobsToUpdate, currentUser)
    {
        const orderInvoiceListToCreate = [];
        const jobsToUpdateWithExpenses = jobsToUpdate.map(job =>
        {
            job.bills = [];
            const jobBillsWithLinesToUpdate = new Map();

            job.commodities?.map(commoditieWithExpense =>
            {
                let lineFound = false;
                const commodity = commoditiesMap[commoditieWithExpense.index];

                // If commodity is not found, must be a typo on the commodity index sended by the caller
                if (commodity)
                {
                    for (const bill of invoiceBillsFromDB)
                    {
                        if (bill.job.guid === job.guid)
                        {
                            // Update only for line type transport
                            const invocieLineFound = bill.lines?.find(line => line.itemId === 1 && line.commodityGuid === commodity.guid);
                            if (invocieLineFound)
                            {
                                lineFound = true;
                                invocieLineFound.amount = commoditieWithExpense.expense;
                                invocieLineFound.setUpdatedBy(currentUser);

                                invocieLineFound.link[0].amount = commoditieWithExpense.revenue;
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
                    const commodityRevenue = commoditieWithExpense.revenue;
                    const commodityExpense = commoditieWithExpense.expense;

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

                    const bill = invoiceBillsFromDB.find(bill => bill.job.guid === job.guid);
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
            orderInvoiceFromDB[0].lines = orderInvoiceListToCreate;

        return { jobsToUpdateWithExpenses, orderInvoicesToUpdate: orderInvoiceFromDB };
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
        const results = {};

        const payload = {
            dispatcherGuid: dispatcher,
            salespersonGuid: salesperson
        };

        // remove and check for undefineds
        const cleaned = R.pickBy((it) => it !== undefined, payload);

        if (Object.keys(cleaned).length === 0)
            throw { 'status': 400, 'data': 'Missing Update Values' };

        const promises = await Promise.allSettled(orders.map(async (order) =>
        {
            // need to catch and throw in order to be able to return the guid for mapping of errors
            const res = await Order.query().findById(order).patch(payload).returning('guid')
                .catch((err) => { throw { 'guid': order, 'data': err }; });

            return { 'guid': order, 'data': res };
        }));

        for (const e of promises)
        {
            if (e.reason)
                results[e.reason.guid] = { 'error': e.reason.data, 'status': 400 };
            else if (e.value?.data === undefined)
                results[e.value.guid] = { 'error': 'Order Not Found', 'status': 404 };
            else if (e.value.data)
                results[e.value.guid] = { 'status': 200 };
        }

        return results;
    }
}

module.exports = OrderService;
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
const User = require('../Models/User');
const InvoiceBill = require('../Models/InvoiceBill');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const Expense = require('../Models/Expense');

class OrderService
{
    static async getOrders(searchParams, page, rowCount)
    {
        const orders = await Order.query().page(page, rowCount).orderBy('number', 'ASC');
        orders.page = page;
        orders.rowCount = rowCount;
        return orders;
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

            orderObj.client = await SFAccount.query(trx).modify('byType', 'client').findById(orderObj.client.guid);

            if (orderObj?.consignee?.guid)
            {
                orderObj.consignee = await SFAccount.query(trx).findById(orderObj.consignee.guid);
            }
            else
            {
                orderObj.consignee = orderObj.client;
            }

            if (orderObj?.referrer?.guid)
            {
                orderObj.referrer = await SFAccount.query(trx).findById(orderObj.referrer?.guid);
                order.graphLink('referrer', orderObj.referrer);
            }

            // salesperson

            if (orderObj?.salesperson?.guid)
            {
                orderObj.salesperson = await SFAccount.query(trx).findById(orderObj.salesperson.guid);
                order.graphLink('salesperson', orderObj.salesperson);
            }

            // dispatcher / manager responsible for the order
            if (orderObj.dispatcher?.guid)
            {
                orderObj.dispatcher = await User.query(trx).findById(orderObj.dispatcher.guid);
                order.graphLink('dispatcher', orderObj.dispatcher);
            }

            order.graphLink('consignee', orderObj.consignee);
            order.graphLink('client', orderObj.client);

            if (orderObj.clientContact)
            {
                const clientContact = SFContact.fromJson(orderObj.clientContact);
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
                    throw new Error(`unknown commodity ${commodity.commType.category} ${commodity.commType.type}`);
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

            for (let i = 0; i < orderObj.jobs.length; i++)
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
                if (job.vendor)
                {
                    const vendor = await SFAccount.query(trx).modify('byType', 'carrier').findById(job.vendor.guid);
                    if (!vendor)
                    {
                        throw new Error('vendor doesnt exist');
                    }
                    job.graphLink('vendor', vendor);
                }

                if (job.vendorContact)
                {
                    const contact = await SFContact.query(trx).findById(job.vendorContact.guid);
                    if (!contact)
                    {
                        throw new Error('vendor contact doesnt exist');
                    }
                    job.graphLink('vendorContact', contact);
                }

                // this is the driver and what not
                if (job.vendorAgent)
                {
                    const contact = await SFContact.query(trx).findById(job.vendorAgent.guid);
                    if (!contact)
                    {
                        throw new Error('vendor agent doesnt exist');
                    }
                    job.graphLink('vendorAgent', contact);
                }

                if (job.dispatcher)
                {
                    const dispatcher = await SFAccount.query(trx).findById(job.dispatcher.guid);
                    if (!dispatcher)
                    {
                        throw new Error('dispatcher ' + job.dispatcher + ' doesnt exist');
                    }
                    job.graphLink('dispatcher', dispatcher);
                }

                const jobType = jobTypes.find(it => OrderJobType.compare(job, it));
                if (!jobType)
                {
                    throw new Error(`unknown job type ${job.jobType.category} ${job.jobType.type}`);
                }
                job.graphLink('jobType', jobType);
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

            Object.assign(order, {
                status: 'new',
                instructions: orderObj.instructions || 'no instructions provided',
                referenceNumber: orderObj.referenceNumber,
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
                invoices: [],
                bills: []
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
            order = await OrderService.getOrderByGuid(order.guid);
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
}

module.exports = OrderService;
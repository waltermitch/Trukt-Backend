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

class OrderService
{
    static async getOrderByGuid(orderGuid)
    {
        const trx = await Order.startTransaction();
        let order = undefined;
        try
        {
            order = await Order.query(trx).skipUndefined().findById(orderGuid).withGraphJoined(Order.fetch.payload);
            trx.commit();
        }
        catch (err)
        {
            trx.rollback();
        }

        return order;
    }

    static async create(orderObj)
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

            orderObj.client = await SFAccount.query(trx).modify('byType', 'client').findById(orderObj.client.guid);

            if (orderObj?.cosignee?.guid)
            {
                orderObj.cosignee = await SFAccount.query(trx).findById(orderObj.cosignee.guid);
            }
            else
            {
                orderObj.cosignee = orderObj.client;
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
            orderObj.owner = await User.query(trx).findById(orderObj.owner.guid);

            order.graphLink('owner', orderObj.owner);
            order.graphLink('cosignee', orderObj.cosignee);
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
                commodity.graphLink('commType', commTypes.find(it => CommodityType.compare(commodity, it)));

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
                const terminal = await Terminal.fromJson(terminalObj).findOrCreate(trx);
                if (!terminal.isResolved)
                {
                    // TODO: check if the terminal is resolved and put it inside of the service-bus queue
                }

                terminal['#id'] = terminalObj['#id'];
                terminals[terminalObj['#id']] = terminal;
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
                        contact.terminalGuid = terminal.guid;
                        const key = contact.uniqueKey();
                        if (!(key in terminalContacts))
                        {
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

            const stopLinks = OrderService.buildStopLinksGraph(orderObj.stops, stopsCache, terminals, commodities);

            order.jobs = [];

            for (let i = 0; i < orderObj.jobs.length; i++)
            {
                const jobObj = orderObj.jobs[i];

                const job = OrderJob.fromJson({
                    index: jobObj.index,
                    category: jobObj.category,
                    type: jobObj.type,
                    loadType: jobObj.loadType
                });

                job.bills = [];

                // vendor and driver are not always known when creating an order
                // most orders created will not have a vendor attached, but on the offchance they might?
                if (jobObj.vendor?.guid)
                {
                    const vendor = await SFAccount.query(trx).modify('byType', 'carrier').findById(jobObj.vendor.guid);
                    job.graphLink('vendor', vendor);
                }

                if (jobObj.vendorContact)
                {
                    const vendorContact = SFContact.fromJson(jobObj.vendorContact);
                    const contact = await SFContact.query(trx).findById('guid', vendorContact.guid);
                    job.graphLink('vendorContact', contact);
                }

                // this is the driver and what not
                if (jobObj.vendorAgent)
                {
                    const vendorAgent = SFContact.fromJson(jobObj.vendorAgent);
                    const contact = await SFContact.query(trx).findById(vendorAgent.guid);
                    job.graphLink('vendorAgent', contact);
                }

                if (job.dispatcher?.guid)
                {
                    const dispatcher = SFAccount.query(trx).findById(job.dispatcher.guid);
                    job.graphLink('dispatcher', dispatcher);
                }

                job.graphLink('jobType', jobTypes.find(it => OrderJobType.compare(job, it)));

                job.stopLinks = OrderService.buildStopLinksGraph(jobObj.stops, stopsCache, terminals, commodities);

                delete job.stops;
                order.jobs.push(job);
            }

            Object.assign(order, {
                status: 'new',
                instructions: orderObj.instructions || 'no instructions provided',

                estimatedDistance: orderObj.estimatedDistance,
                isDummy: orderObj.isDummy || false,

                // this field cannot be set by the user
                isDeleted: false,

                // this field cannot be set by the user
                isCompleted: false,
                estimatedExpense: orderObj.estimatedExpense || null,
                estimatedRevenue: orderObj.estimatedRevenue || null,
                quotedRevenue: null,
                dateExpectedCompleteBy: null,
                dateCompleted: null,
                stopLinks: stopLinks,
                invoices: [],
                bills: []
            });

            // this part creates all the financial records for this order
            if (orderObj.expenses.length > 0)
            {
                const actors = {
                    'client': order.cosignee,
                    'referrer': order.referrer,
                    'salesperson': order.salesperson,
                    'owner': order.owner
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
                        invoices[invoiceKey] = InvoiceBill.fromJson({
                            // mark as invoice only if it is for the client, everyone else is a bill
                            isInvoice: expense.account === 'client',
                            lines: []
                        });
                        invoices[invoiceKey].cosignee = actors[invoiceKey];

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
                }).returning('*');

            // fetching the data from the database because doesnt return everything and polluted with graph #dbRef
            order = await Order.query(trx).skipUndefined().findById(order.guid).withGraphFetched(Order.fetch.payload);
            trx.commit();

            return order;

        }
        catch (err)
        {
            trx.rollback();
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
        for (let i = 0; i < stops.length; i++)
        {
            const stop = OrderStop.fromJson(stops[i]);

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
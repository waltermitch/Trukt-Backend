const { NotFoundError, DataConflictError } = require('../ErrorHandling/Exceptions');
const { AppResponse } = require('../ErrorHandling/Responses');
const AccountingFunc = require('../Azure/AccountingFunc');
const LineLinks = require('../Models/InvoiceLineLink');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceBill = require('../Models/InvoiceBill');
const OrderJob = require('../Models/OrderJob');
const Line = require('../Models/InvoiceLine');
const Invoice = require('../Models/Invoice');
const Order = require('../Models/Order');
const Bill = require('../Models/Bill');
const { DateTime } = require('luxon');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await InvoiceBill.query()
            .findOne({ 'guid': guid, 'isDeleted': false })
            .withGraphFetched(InvoiceBill.fetch.details);

        return res;
    }

    static async getOrderInvoicesandBills(guid)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined({
                invoices: InvoiceBill.fetch.details,
                jobs: { bills: InvoiceBill.fetch.details }
            });

        // order was not found, return undefined
        if (res == undefined)
            return undefined;

        // assigning orderId and Number to all order invoices
        for (const invoice of res.invoices)
            Object.assign(invoice, {
                order: {
                    guid: res.guid,
                    number: res.number
                }
            });

        // object to return array of bills and invoices
        const invoiceObject = {
            invoices: res.invoices,

            // flatten all the bills and assign job guid and number to each bill
            bills: res.jobs.reduce((bills, job) =>
            {
                const jobObject = {
                    guid: job.guid,
                    number: job.number
                };
                bills.push(...job.bills.map((bill) =>
                {
                    bill.job = jobObject;
                    return bill;
                }));
                return bills;
            }, [])
        };

        return invoiceObject;
    }

    static async getJobOrderFinances(guid, type)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined({
                invoices: InvoiceBill.fetch.details,
                jobs: { bills: InvoiceBill.fetch.details }
            });

        // order was not found, return undefined
        if (res == undefined)
            return undefined;

        // using type to make it more concrete
        if (type == 'job')
        {
            // flatten all the bills and assign job guid and number to each bill
            return res.jobs.reduce((bills, job) =>
            {
                const jobObject = {
                    guid: job.guid,
                    number: job.number
                };
                bills.push(...job.bills.map((bill) =>
                {
                    bill.job = jobObject;
                    return bill;
                }));
                return bills;
            }, []);
        }

        if (type == 'order')
        {
            // assigning orderId and Number to order invoice
            Object.assign(res.invoices[0], {
                order: {
                    guid: res.guid,
                    number: res.number
                }
            });

            return res.invoices;
        }
    }

    static async addInvoiceLine(invoiceGuid, billGuid, line, currentUser)
    {
        const result = await InvoiceLine.transaction(async trx =>
        {
            // verifying bill and invoice
            const [bill, invoice] = await Promise.all([billGuid && Bill.query(trx).findById(billGuid), Invoice.query(trx).findById(invoiceGuid)]);

            // if invoice doesn't exist in table throw error
            if (!invoice)
            {
                throw new NotFoundError('Invoice does not exist.');
            }

            // if wrong billGuid
            if (billGuid && !bill)
            {
                throw new NotFoundError('Bill does not exist.');
            }

            // for bulk insert
            const linksArray = [];

            line.setCreatedBy(currentUser);
            line.linkInvoice(invoice);
            linksArray.push(line);

            // if billGuid exists create line and link
            if (billGuid)
            {
                // By default the linked bill line should be created as a line not paid
                const billLine = InvoiceLine.fromJson({ ...line, isPaid: false });
                billLine.linkBill(bill);
                linksArray.push(billLine);
            }

            // bulk insert into Lines table
            const [newLine1, newLine2] = await InvoiceLine.query(trx).insertAndFetch(linksArray);

            await newLine1.setAsPaidInvoiceBill(invoiceGuid, currentUser, trx);

            // if two lines then link lines
            if (newLine2)
            {
                await InvoiceService.LinkLines(newLine1.guid, newLine2.guid, trx);
                await newLine2.setAsPaidInvoiceBill(billGuid, currentUser, trx);
            }

            // return only the invoice item
            return newLine1;
        });

        return result;
    }

    static async updateInvoiceLine(invoiceGuid, lineGuid, line, currentUser)
    {
        const trx = await InvoiceLine.startTransaction();
        try
        {
            // To make sure if bill has been passed
            const invoice = await Invoice.query(trx).findById(invoiceGuid);
    
            // if no bill throw error
            if (!invoice)
            {
                throw new NotFoundError('Invoice does not exist.');
            }
    
            // linking and updateing
            line.linkInvoice(invoice);
    
            // returning updated bill
            const newLine = await InvoiceLine.query(trx).patchAndFetchById(lineGuid, line);
    
            // if line doesn't exist
            if (!newLine)
                throw new NotFoundError('Line does not exist.');
    
            await newLine.setAsPaidInvoiceBill(invoiceGuid, currentUser, trx);
            await trx.commit();
    
            return newLine;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async deleteInvoiceLine(invoiceGuid, lineGuid)
    {
        // To make sure correct invoice was passed in
        const invoice = await Invoice.query().findById(invoiceGuid);

        // if no bill throw error
        if (!invoice)
        {
            throw new NotFoundError('Invoice does not exist.');
        }

        // to double check and see if commodity is attached
        const checkLine = await InvoiceLine.query().findById(lineGuid);

        // if attached throw error
        if (checkLine.itemId == 1 && checkLine.commodityGuid != null)
        {
            throw new DataConflictError('Deleting a transport line attached to a commodity is forbidden.');
        }

        // returning updated bill
        const newLine = await InvoiceLine.query().deleteById(lineGuid).returning('*');

        // if line doesn't exist
        if (!newLine)
        {
            throw new NotFoundError('Line does not exist.');
        }

        return;
    }

    static async deleteInvoiceLines(invoiceGuid, lineGuids)
    {
        // running transaction, because I want to undue updates because of failure
        const result = await InvoiceLine.transaction(async trx =>
        {
            // To make sure correct invoice was passed in
            const invoice = await Invoice.query(trx).findById(invoiceGuid);

            // incorrect invoice
            if (!invoice)
            {
                throw new NotFoundError('Invoice does not exist.');
            }

            // deleteing lines in bulk :: users are forbidden from deleting transport lines with commodity attached to it.
            const deletedLines = await InvoiceLine.query(trx).delete().whereIn('guid', lineGuids).where('invoiceGuid', invoiceGuid).modify('isNotTransport');

            // checking if all have been deleted
            if (deletedLines != lineGuids.length)
            {
                // error array for unique messages
                const appResponse = new AppResponse();

                // query all guids, and throw error for which return because they still exist.
                const failedLines = await InvoiceLine.query(trx).findByIds([lineGuids]);

                // looping through array to throw proper errors
                for (const l of failedLines)
                {
                    if (l.itemId == 1 && l.commodityGuid != null)
                    {
                        appResponse.addError(new DataConflictError(`Deleting a transport line attached to a commodity is forbidden. Line guid: ${l.guid}`));
                    }
                    if (l.invoiceGuid != invoiceGuid)
                    {
                        appResponse.addError(new DataConflictError(`Deleting a line the doesn't belong to the invoice is forbidden. Line guid: ${l.guid}`));
                    }
                }
                if (appResponse.doErrorsExist())
                    return appResponse.toJSON();
            }

            // if succeed then, returns nothing
            return;
        });

        return result;
    }

    static async LinkLines(line1Guid, line2Guid, trx = null)
    {
        const Lines = await Line.query(trx).findByIds([line1Guid, line2Guid]).withGraphFetched('[invoice, bill, invoiceBill.[job]]');

        if (Lines.length === 0)
            throw new NotFoundError('Line does not exist.');

        // not allowed to link transport items
        if (Lines[0]?.itemId == 1 && Lines[1]?.itemId == 1)
        {
            throw new DataConflictError('Cannot link transport items!');
        }

        if (!((Lines[1].bill?.billGuid && Lines[0].bill?.billGuid) || (Lines[0].invoice?.invoiceGuid && Lines[1].invoice?.invoiceGuid)))
        {
            // getting order Guid to compare if job belongs to order
            const orderGuid = (Lines[0].invoiceBill?.job?.orderGuid || Lines[1].invoiceBill?.job?.orderGuid);
            const orderGuid2 = (Lines[0].invoice?.orderGuid || Lines[1].invoice?.orderGuid);

            // if job belongs to order then we link lines
            if (orderGuid === orderGuid2)
            {
                // inserting after succesfully jumping through constraints
                await LineLinks.query(trx).insert({ line1Guid: line1Guid, line2Guid: line2Guid });
            }
        }
    }

    static async UnLinkLines(line1Guid, line2Guid)
    {
        const Lines = await Line.query().findByIds([line1Guid, line2Guid]).withGraphFetched('[invoice, bill, invoiceBill.[job]]');

        if (Lines.length === 0)
            throw new NotFoundError('Line does not exist.');

        // not allowed to unlink transport items
        if (Lines[0]?.itemId == 1 && Lines[1]?.itemId == 1)
        {
            throw new DataConflictError('Cannot unlink transport items!');
        }

        // checking to see if order to order or job to job
        if (!((Lines[1].bill?.billGuid && Lines[0].bill?.billGuid) || (Lines[0].invoice?.invoiceGuid && Lines[1].invoice?.invoiceGuid)))
        {
            // getting order Guid to compare if job belongs to order
            const orderGuid = (Lines[0].invoiceBill?.job?.orderGuid || Lines[1].invoiceBill?.job?.orderGuid);
            const orderGuid2 = (Lines[0].invoice?.orderGuid || Lines[1].invoice?.orderGuid);

            // if job belongs to order then we link lines
            if (orderGuid === orderGuid2)
            {
                // deleted the linked items from table, considers both options
                await LineLinks.query().delete().where({ line1Guid: line1Guid, line2Guid: line2Guid }).orWhere({ line1Guid: line2Guid, line2Guid: line1Guid });

                return;
            }
        }
    }

    static async exportInvoices(arr)
    {
        // remove duplicates in arr
        const unique = [...new Set(arr)];

        // query to get all the orders with related objects
        const orders = await Order.query()
            .whereIn('guid', unique)
            .withGraphFetched('[invoices.[consignee, lines(isNotPaid, isNonZero).[commodity.[stops.[terminal], vehicle, commType], item]], client]');

        if (!orders.length)
            throw new NotFoundError('No Matching Orders Found');

        const invoicesToExport = [];
        const invoiceMap = new Map();

        // array for results
        const results = [];

        for (const order of orders)
        {
            // if order has invoices
            if (order.invoices.length)
            {
                results[order.guid] = { data: [], errors: new AppResponse(), status: null };

                for (const invoice of order.invoices)
                {
                    if (invoice.dateInvoiced)
                        continue;

                    // assign fields for future use
                    invoice.orderGuid = order.guid;
                    invoice.orderNumber = order.number;

                    // if invoice has reference number use it, otherwise use order number
                    invoice.referenceNumber = invoice.referenceNumber || order.referenceNumber;

                    const client = invoice.consignee || order.client;

                    invoice.client =
                    {
                        guid: client.guid,
                        name: client.name,
                        qbId: client.qbId,
                        sdGuid: client.sdGuid
                    };

                    delete invoice.consignee;

                    // perform validation
                    if (invoice.isPaid || Object.keys(invoice.externalSourceData || {}).length > 0)
                    {
                        results[order.guid].status = 400;
                        results[order.guid].errors.setStatus(400);
                        results[order.guid].errors.addError(
                            new DataConflictError('Invoice already marked as paid'),
                            {
                                guid: invoice.guid,
                                data: invoice
                            }
                        );
                    }
                    else if (invoice.lines.length == 0)
                    {
                        results[order.guid].status = 400;
                        results[order.guid].errors.setStatus(400);
                        results[order.guid].errors.addError(
                            new DataConflictError('Invoice Has No Non Zero Lines'),
                            {
                                guid: invoice.guid,
                                data: invoice
                            }
                        );
                    }
                    else if (!invoice.client.qbId)
                    {
                        results[order.guid].status = 400;
                        results[order.guid].errors.setStatus(400);
                        results[order.guid].errors.addError(
                            new DataConflictError(`Invoice ${invoice.guid} has no client/consignee or client/consignee doesn't have a QBO Id`,
                                {
                                    guid: invoice.guid,
                                    data: invoice
                                })
                        );
                    }
                    else
                    {
                        // add existing invoice externalSourceData to map
                        invoiceMap.set(invoice.guid, invoice);

                        for (const line of invoice.lines)
                        {
                            if (line.commodity?.commType?.category === 'freight')
                                line.itemName = 'freight';
                            else
                                line.itemName = line.item.name;

                            line.description = AccountingFunc.composeDescription(line);
                        }

                        // add invoice to array
                        invoicesToExport.push(invoice);
                    }
                }
            }
        }

        const res = await AccountingFunc.exportInvoices(invoicesToExport);

        // set current timestamp
        const now = DateTime.utc().toString();

        // loop through results and update successfuls ones in db
        await Promise.allSettled(res.map(async ({ system, data, error, status }) =>
        {
            if (status != 200)
            {
                const invoiceObj = invoiceMap.get(error.guid);

                results[invoiceObj.orderGuid].status = status;
                results[invoiceObj.orderGuid].errors = new AppResponse();
                results[invoiceObj.orderGuid].errors.setStatus(status);
                results[invoiceObj.orderGuid].errors.addError(
                    new DataConflictError(error,
                        {
                            guid: error.guid
                        })
                );
            }
            else
            {
                const invoiceObj = invoiceMap.get(data.guid);

                results[invoiceObj.orderGuid].errors = new AppResponse();

                // if no errors we will update the bill
                const trx = await InvoiceBill.startTransaction();

                // merge externalSourceData with current bill externalSourceData
                const curExternal = invoiceObj.externalSourceData || {};

                if (system == 'quickbooks')
                    Object.assign(curExternal, { 'quickbooks': { 'Id': data.qbId } });
                else if (system == 'coupa')
                {
                    if (data.invoicedInCoupa)
                        Object.assign(curExternal, { 'coupa': { 'invoiced': true, 'invoicedDate': now } });
                    else
                        Object.assign(curExternal, { 'coupa': { 'invoiced': false } });
                }

                try
                {
                    const [patchedInvoice] = await Promise.all([
                        InvoiceBill.query(trx)
                            .patchAndFetchById(data.guid, { externalSourceData: curExternal, isPaid: true, dateInvoiced: now }),

                        InvoiceLine.query(trx)
                            .patch({ isPaid: true, transactionNumber: data.qbId, dateCharged: now })
                            .where('invoiceGuid', data.guid)
                    ]);

                    // only set 200 if all bills are successful
                    // any single error will set the status to 400
                    if (!results[invoiceObj.orderGuid].errors.doErrorsExist())
                        results[invoiceObj.orderGuid].status = 200;

                    // rename guid as billGuid
                    patchedInvoice.invoiceGuid = data.guid;
                    patchedInvoice.orderNumber = invoiceObj.orderNumber;

                    results[invoiceObj.orderGuid].data.push(patchedInvoice);

                    await trx.commit();
                }
                catch (err)
                {
                    await trx.rollback();

                    results[invoiceObj.orderGuid].status = 500;
                    results[invoiceObj.orderGuid].errors.setStatus(500);
                    results[invoiceObj.orderGuid].errors.addError(
                        new DataConflictError(err.message,
                            {
                                guid: data.guid
                            })
                    );
                }

            }
        }));

        return results;
    }

    static async searchInvoices(orderGuid)
    {
        const search = orderGuid.replace(/%/g, '');

        const res = await InvoiceBill.query().where('order_guid', '=', search).withGraphJoined('lines');

        return res;
    }

    static async getOrderFinances(guid, type)
    {
        // const result = await InvoiceService.getOrderInvoicesandBills(orderGuid);

        // the guid is either a job or order guid
        // type is either 'job' or 'order'
        // get request is job
        if (type == 'job')
        {
            // we want to get all of bills for this job and only invoices that are linked to lines from the bill
            const res = await OrderJob.query()
                .findById(guid)
                .withGraphJoined({ bills: InvoiceBill.fetch.linkedInvoices });

            if (!res)
                throw new NotFoundError(`Job with Guid ${guid} not found.`);

            // for each bill append job info, and extract invoice info
            const invoices = new Map();
            for (const bill of res.bills)
            {
                bill.job =
                {
                    guid: res.guid,
                    number: res.number
                };

                // each line may have links to other lines which have invoices
                for (const line of bill.lines)
                {
                    for (const link of line.link)
                    {
                        const order = { guid: link.invoiceBill.order.guid, number: link.invoiceBill.order.number };

                        link.invoiceBill.order = order;

                        invoices.set(link.invoiceBill.guid, link.invoiceBill);

                        // delete link
                        delete line.link;
                    }
                }

                // gonna convert payload a bit
                const payload =
                {
                    invoices: Array.from(invoices.values()),
                    bills: res.bills
                };

                return payload;
            }

        }
        else
        {
            const result = await Order.query()
                .findById(guid)
                .withGraphJoined(
                    {
                        'jobs': { bills: InvoiceBill.fetch.details },
                        invoices: InvoiceBill.fetch.details
                    });

            if (!result)
                throw new NotFoundError(`Order with Guid ${guid} not found.`);

            // format the result
            const bills = [];
            for (const job of result.jobs)
            {
                for (const bill of job.bills)
                {
                    bill.job = { guid: job.guid, number: job.number };
                    bills.push(bill);
                }
            }

            for (const invoice of result.invoices)
                invoice.order = { guid: result.guid, number: result.number };

            return { invoices: result.invoices, bills };
        }
    }
}

module.exports = InvoiceService;

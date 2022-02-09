const OrderStopService = require('../Services/OrderStopService');
const LoadboardPost = require('../Models/LoadboardPost');
const Attachment = require('../Models/Attachment');
const OrderJob = require('../Models/OrderJob');
const OrderStop = require('../Models/OrderStop');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const states = require('us-state-codes');
const { DateTime } = require('luxon');
const uuid = require('uuid');
const R = require('ramda');
const emitter = require('../EventListeners/index');

const returnTo = process.env['azure.servicebus.loadboards.subscription.to'];
const systemUser = process.env['SYSTEM_USER'];
class Loadboard
{
    constructor(data)
    {
        this.data = R.clone(data);
    }

    static validate() { }

    cleanUp()
    {
        // get sketchy information into workable format before being assigned to different payloads
        this.data.pickup.dateRequestedStart = DateTime.fromISO(this.data.pickup.dateRequestedStart).toUTC();
        this.data.pickup.dateRequestedEnd = this.data.pickup.dateRequestedType == 'estimated' ? DateTime.fromISO(this.data.pickup.dateRequestedEnd).toUTC() : this.data.pickup.dateRequestedStart;
        this.data.pickup.dateScheduledStart = DateTime.fromISO(this.data.pickup.dateScheduledStart).toUTC();
        this.data.pickup.dateScheduledEnd = this.data.pickup.dateScheduledType == 'estimated' ? DateTime.fromISO(this.data.pickup.dateScheduledEnd).toUTC() : this.data.pickup.dateScheduledStart;
        this.data.pickup.terminal.state = this.getStateCode(this.data.pickup.terminal.state);
        if (this.data.pickup.primaryContact)
        {
            this.data.pickup.primaryContact.phoneNumber = this.cleanUpPhoneNumber(this.data.pickup?.primaryContact?.phoneNumber);
            this.data.pickup.primaryContact.mobileNumber = this.cleanUpPhoneNumber(this.data.pickup?.primaryContact?.mobileNumber);
        }

        this.data.delivery.dateRequestedStart = DateTime.fromISO(this.data.delivery.dateRequestedStart).toUTC();
        this.data.delivery.dateRequestedEnd = this.data.delivery.dateRequestedType == 'estimated' ? DateTime.fromISO(this.data.delivery.dateRequestedEnd).toUTC() : this.data.delivery.dateRequestedStart;
        this.data.delivery.dateScheduledStart = DateTime.fromISO(this.data.delivery.dateScheduledStart).toUTC();
        this.data.delivery.dateScheduledEnd = this.data.delivery.dateScheduledType == 'estimated' ? DateTime.fromISO(this.data.delivery.dateScheduledEnd).toUTC() : this.data.delivery.dateScheduledStart;
        this.data.delivery.terminal.state = this.getStateCode(this.data.delivery.terminal.state);
        if (this.data.delivery.primaryContact)
        {
            this.data.delivery.primaryContact.phoneNumber = this.cleanUpPhoneNumber(this.data.delivery?.primaryContact?.phoneNumber);
            this.data.delivery.primaryContact.mobileNumber = this.cleanUpPhoneNumber(this.data.delivery?.primaryContact?.mobileNumber);
        }
    }

    create()
    {
        let payload = {};
        this.cleanUp();
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName, jobNumber: this.data.number };
        payloadMetadata.action = 'create';
        payloadMetadata.user = returnTo;
        payload = this.adjustDates(this.toJSON());

        return { payload, payloadMetadata };
    }

    post()
    {
        let payload = {};
        this.cleanUp();
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName, jobNumber: this.data.number };
        payloadMetadata.action = 'post';
        payloadMetadata.user = returnTo;
        payload = this.adjustDates(this.toJSON());

        return { payload, payloadMetadata };
    }

    unpost()
    {
        const payload = { guid: this.postObject.externalPostGuid };
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = 'unpost';
        payloadMetadata.user = returnTo;

        return { payload, payloadMetadata };
    }

    update()
    {
        this.cleanUp();
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = 'update';
        payloadMetadata.user = returnTo;

        return { payload: this.adjustDates(this.toJSON()), payloadMetadata };
    }

    dispatch()
    {
        this.cleanUp();
        this.validateDispatch();
        const payloadMetadata = { post: this.postObject, dispatch: this.data.dispatch, loadboard: this.loadboardName };
        const payload = {};

        // send the order payload because the load may not exist in the loadboard
        // or it needs to be updated after dispatching
        payload.order = this.adjustDates(this.toJSON());
        payload.dispatch = this.dispatchJSON();
        payloadMetadata.action = 'dispatch';
        payloadMetadata.user = returnTo;
        return { payload, payloadMetadata };
    }

    undispatch()
    {
        this.cleanUp();
        const payloadMetadata = { post: this.postObject, dispatch: this.data.dispatch, loadboard: this.loadboardName };
        const payload = {};

        // sending the order because ship cars archives orders that are canceled
        // so they will need to be recreated
        payload.order = this.adjustDates(this.toJSON());
        payload.dispatch = { externalLoadGuid: this.postObject.externalGuid, externalDispatchGuid: this.data.dispatch.externalGuid };
        payloadMetadata.action = 'undispatch';
        payloadMetadata.user = returnTo;
        return { payload, payloadMetadata };
    }

    remove(userGuid)
    {
        const payload = { guid: this.postObject.externalGuid };
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName, userGuid };
        payloadMetadata.action = 'remove';
        payloadMetadata.user = returnTo;

        return { payload, payloadMetadata };
    }

    manuallyAcceptDispatch()
    {
        const payload = { dispatch: this.acceptDispatchToJSON() };
        const payloadMetadata = { dispatch: this.data, loadboard: this.loadboardName };
        payloadMetadata.action = 'manuallyAcceptDispatch';

        // we do not care about setting the return to because we
        // are not concerned with getting a response back
        return { payload, payloadMetadata };
    }

    toStringDate(input)
    {
        const date = DateTime.fromISO(input).c;

        return input ? date.year + '-' + date.month + '-' + date.day : null;
    }

    saltOrderNumber(orderNumber)
    {
        // adding salt with ms to prevent duplicate name error
        return `${orderNumber}#${this.getMilliSeconds().substr(4, 12)}`;
    }

    getMilliSeconds()
    {
        return DateTime.utc().toMillis().toString();
    }

    toDate(input)
    {
        return input ? input.substr(0, 10) : null;
    }

    dateAdd(date, amount, type)
    {
        return date ? DateTime.fromISO(date).plus({ [`${type}`]: amount }).toString() : null;
    }

    adjustDates(payload) { return payload; }

    getDifferencefromToday(date)
    {
        // get difference between the date and today.. today - date.. (future date would be negative)
        const diff = DateTime.utc().diff(DateTime.fromJSDate(date), ['days']);

        // return the float
        return diff.toObject().days;
    }

    fastForward(targetDate, secondDate)
    {
        const tempSecondDate = secondDate;
        targetDate = tempSecondDate.plus({ days: 1, hours: 1 }).toUTC();
        return targetDate;
    }

    getStateCode(state)
    {
        return states.getStateCodeByStateName(state) == null ? states.sanitizeStateCode(state) : states.getStateCodeByStateName(state);
    }

    cleanUpPhoneNumber(phone)
    {
        if (!phone)
        {
            return null;
        }

        // 0. clean up non-alphanumeric characters
        phone = phone.replace(/[^\w]|_/g, '');

        // 1. remove extensions
        phone = phone.replace(/[a-zA-Z]+\d*/, '');

        // 2. count the number of digits
        if (phone.length === 11 || phone.length === 10)
        {
            // 4. construct new phone string
            const matches = phone.match(/\d?(\d{3})(\d{3})(\d{4})/);
            phone = `(${matches[1]}) ${matches[2]}-${matches[3]}`;
        }
        else
        {
            phone = null;
        }

        return phone;
    }

    // currently overridden by child classes
    validateDispatch() { }

    static async handleCreate(post)
    {
        return LoadboardPost.fromJson(post);
    }

    static async handlePost(payloadMetadata, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);

        try
        {
            if (response.hasErrors)
            {
                objectionPost.isSynced = false;
                objectionPost.isPosted = false;
                objectionPost.hasError = true;
                objectionPost.apiError = response.errors;
            }
            else
            {
                objectionPost.setToPosted(response.guid);
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();

            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }
    }

    static async handleUnpost(payloadMetadata, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);

        try
        {
            if (response.hasErrors)
            {
                objectionPost.isSynced = false;
                objectionPost.isPosted = false;
                objectionPost.hasError = true;
                objectionPost.apiError = response.errors;
            }
            else
            {
                objectionPost.setToUnposted();
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();

            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }
    }

    static async handleRemove(payloadMetadata, response)
    {
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);
        if (response.hasErrors)
        {
            objectionPost.isSynced = false;
            objectionPost.isPosted = false;
            objectionPost.hasError = true;
            objectionPost.apiError = response.errors;
            objectionPost.updatedByGuid = payloadMetadata.userGuid;
        }
        else
        {
            objectionPost.externalPostGuid = null;
            objectionPost.status = 'removed';
            objectionPost.isSynced = true;
            objectionPost.isPosted = false;
            objectionPost.isCreated = false;
            objectionPost.isDeleted = true;
            objectionPost.deletedByGuid = payloadMetadata.userGuid;
            if (objectionPost.loadboard != 'SUPERDISPATCH' &&
                objectionPost.loadboard != 'CARDELIVERYNETWORK')
            {
                objectionPost.externalGuid = null;
            }
        }

        await LoadboardPost.query().patch(objectionPost).findById(objectionPost.guid);
        return;
    }

    static async handleStatusUpdate(payloadMetadata, response)
    {
        const trx = await OrderStop.startTransaction();
        try
        {
            // get all the stops for the completed stop type coming in from
            // the webhook response
            const stops = await OrderStop.query(trx)
                .select('orderStops.*', 'links.jobGuid')
                .leftJoinRelated('commodities')
                .leftJoinRelated('links')
                .leftJoin('rcgTms.loadboardPosts', 'links.jobGuid', 'rcgTms.loadboardPosts.jobGuid')
                .where({ 'rcgTms.loadboardPosts.externalGuid': payloadMetadata.externalGuid, stopType: response.stopType })
                .withGraphFetched('[commodities]').distinctOn('guid')
                .modifyGraph('commodities', builder => builder.select('guid').distinctOn('guid'));

            const promises = [];
            for (const stop of stops)
            {
                const params = {
                    jobGuid: stop.jobGuid,
                    stopGuid: stop.guid,
                    status: 'completed'
                };
                const body = {
                    commodities: stop.commodities.map(com => com.guid),
                    date: response.completedAtTime
                };
                promises.push({ func: OrderStopService.updateStopStatus, params, body, systemUser });
            }

            const attachments = [];
            for (const attachment of response.attachments)
            {
                attachments.push(Attachment.fromJson({
                    guid: uuid.v4(),
                    type: 'billOfLading',
                    url: attachment.attachmentUrl,
                    extension: 'application/pdf',
                    name: attachment.attachmentName,
                    parent: stops[0].jobGuid,
                    parent_table: 'jobs',
                    visibility: '{internal}',
                    createdByGuid: process.env.SYSTEM_USER
                }));
            }

            if (attachments.length > 0)
                await Attachment.query(trx).insert(attachments);

            await Promise.all(promises.map(async (prom) => await prom.func(prom.params, prom.body, systemUser)));

            await trx.commit();
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async handleCarrierAcceptDispatch(payloadMetadata, response)
    {
        const externalGuid = payloadMetadata.externalDispatchGuid || payloadMetadata.externalGuid;
        if (externalGuid)
        {
            const trx = await OrderJobDispatch.startTransaction();
            try
            {
                const dispatchRec = await OrderJobDispatch.query(trx)
                    .withGraphJoined('[job.order, vendor, vendorAgent, loadboardPost]')
                    .findOne({ 'orderJobDispatches.externalGuid': externalGuid });

                const orderRec = dispatchRec.job.order;
                const jobRec = dispatchRec.job;

                dispatchRec.setToAccepted();
                dispatchRec.setUpdatedBy(process.env.SYSTEM_USER);
                jobRec.setUpdatedBy(process.env.SYSTEM_USER);

                const dbQueries = [];
                dbQueries.push(dispatchRec.$query(trx).patch());
                dbQueries.push(jobRec.$query(trx).patch({
                    vendorGuid: dispatchRec.vendorGuid,
                    vendorContactGuid: dispatchRec.vendorContactGuid,
                    vendorAgentGuid: dispatchRec.vendorAgentGuid,
                    status: 'dispatched'
                }));

                dbQueries.push(
                    OrderJob.relatedQuery('stops')
                        .for(dispatchRec.jobGuid)
                        .withGraphJoined('terminal')
                        .whereNotNull('rcgTms.orderStopLinks.orderGuid')
                        .distinctOn('rcgTms.orderStops.guid')
                );

                dbQueries.push(OrderJobDispatch.query(trx).patch({ isValid: false })
                    .where({ jobGuid: dispatchRec.jobGuid }).andWhereNot({ guid: dispatchRec.guid }));

                const [, , orderStops] = await Promise.all(dbQueries);
                await trx.commit();

                for (const stop of orderStops)
                {
                    if (stop.isDelivery && stop.dateScheduledStart != undefined)
                    {
                        emitter.emit('order_stop_delivery_scheduled', { order: orderRec, job: jobRec, stop, datetime: stop.dateScheduledStart });
                    }
                }

                await StatusManagerHandler.registerStatus({
                    orderGuid: orderRec.guid,
                    userGuid: process.env.SYSTEM_USER,
                    statusId: 13,
                    jobGuid: dispatchRec.jobGuid,
                    extraAnnotations: {
                        loadboard: dispatchRec.loadboardPost.loadboard,
                        vendorGuid: dispatchRec.vendorGuid,
                        vendorAgentGuid: dispatchRec.vendorAgentGuid,
                        vendorName: dispatchRec.vendor.name,
                        vendorAgentName: dispatchRec.vendorAgent.name,
                        dotNumber: dispatchRec.vendor.dotNumber
                    }
                });

                return dispatchRec.jobGuid;
            }
            catch (e)
            {
                await trx.rollback(e);
                throw new Error(e.message);
            }
        }
    }
}

module.exports = Loadboard;

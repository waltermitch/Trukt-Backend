const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const LoadboardPost = require('../Models/LoadboardPost');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const OrderStop = require('../Models/OrderStop');
const OrderStopLink = require('../Models/OrderStopLink');
const Job = require('../Models/OrderJob');
const Commodity = require('../Models/Commodity');
const SFAccount = require('../Models/SFAccount');
const DateTime = require('luxon').DateTime;
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');

class Super extends Loadboard
{

    constructor(data)
    {
        super(data);
        this.loadboardName = 'SUPERDISPATCH';
        this.postObject = data.postObjects[this.loadboardName];
    }

    toJSON()
    {
        const payload =
        {
            customer: {
                notes: this.data.order.clientNotes?.note,
                address: this.data.order.client.billingStreet,
                city: this.data.order.client.billingCity,
                state: this.data.order.client.billingState,
                zip: this.data.order.client.billingPostalCode,

                contact_name: this.data.order.clientContact?.name,
                contact_phone: this.data.order.clientContact?.phoneNumber,
                contact_mobile_phone: this.data.order.clientContact?.mobileNumber,
                contact_email: this.data.order.clientContact?.email,
                name: this.data.order.client.name,
                business_type: this.setBusinessType(this.data.order.client.type),
                email: this.data.order.client?.email,
                phone: this.data.order.client?.phone,
                counterparty_guid: this.data.order.client.sdGuid,
                save_as_new: this.data.order.client.sdGuid === null
            },
            customer_payment: { tariff: currency(this.data.actualRevenue).value || '5' },
            tariff: currency(this.data.actualRevenue).value || '5',
            payment: { terms: 'ach' },
            price: currency(this.data.actualExpense).value || '5',
            number: this.data.number,
            purchase_order_number: this.data.order.referenceNumber,
            dispatcher_name: this.data.dispatcher?.name || 'Brad Marinov',
            instructions: this.data.order?.instructions.substring(0, 9998),
            loadboard_instructions: this.postObject.instructions || this.data.loadboardInstructions,
            transport_type: this.setEquipmentType(this.data.equipmentType?.name),
            inspection_type: this.data.order.inspectionType,
            pickup:
            {
                first_available_pickup_date: this.data.pickup.dateRequestedStart,
                scheduled_at: !this.data.pickup.dateScheduledStart.invalid ? this.data.pickup.dateScheduledStart : this.data.pickup.dateRequestedStart,
                scheduled_ends_at: !this.data.pickup.dateScheduledEnd.invalid ? this.data.pickup.dateScheduledEnd : this.data.pickup.dateRequestedEnd,
                scheduled_at_by_customer: this.data.pickup.dateRequestedStart,
                scheduled_ends_at_by_customer: this.data.pickup.dateRequestedEnd,
                date_type: this.setDateType(this.data.pickup.dateRequestedType),
                notes: this.data.pickup.notes,
                venue:
                {
                    address: this.data.pickup.terminal.street1,
                    city: this.data.pickup.terminal.city,
                    state: this.data.pickup.terminal.state,
                    zip: this.data.pickup.terminal.zipCode,
                    name: this.data.pickup.terminal.name,
                    business_type: this.setBusinessType(this.data.pickup.terminal.locationType),
                    contact_name: this.data.pickup?.primaryContact?.name || null,
                    contact_email: this.data.pickup?.primaryContact?.email || null,
                    contact_phone: this.data.pickup?.primaryContact?.phoneNumber || null,
                    contact_mobile_phone: this.data.pickup?.primaryContact?.mobileNumber || null,
                    date_type: this.setDateType(this.data.pickup.dateScheduledType)
                }
            },
            delivery:
            {
                scheduled_at: !this.data.delivery.dateScheduledStart.invalid ? this.data.delivery.dateScheduledStart : this.data.delivery.dateRequestedStart,
                scheduled_ends_at: !this.data.delivery.dateScheduledEnd.invalid ? this.data.delivery.dateScheduledEnd : this.data.delivery.dateRequestedEnd,
                scheduled_at_by_customer: this.data.delivery.dateRequestedStart,
                scheduled_ends_at_by_customer: this.data.delivery.dateRequestedEnd,
                notes: this.data.delivery.notes,
                date_type: this.setDateType(this.data.delivery.dateRequestedType),
                venue:
                {
                    address: this.data.delivery.terminal.street1,
                    city: this.data.delivery.terminal.city,
                    state: this.data.delivery.terminal.state,
                    zip: this.data.delivery.terminal.zipCode,
                    name: this.data.delivery.terminal.name,
                    business_type: this.setBusinessType(this.data.delivery.terminal.locationType),
                    contact_name: this.data.delivery?.primaryContact?.name || null,
                    contact_email: this.data.delivery?.primaryContact?.email || null,
                    contact_phone: this.data.delivery?.primaryContact?.phoneNumber || null,
                    contact_mobile_phone: this.data.delivery?.primaryContact?.mobileNumber || null,
                    date_type: this.setDateType(this.data.delivery.dateRequestedType)
                }
            },

            vehicles: this.formatCommodities(this.data.commodities),

            guid: this.postObject.externalGuid
        };

        return payload;
    }

    dispatchJSON()
    {
        const payload = {
            carrier_guid: this.data.vendor.sdGuid,
            carrier_usdot: this.data.vendor.dotNumber,
            price: this.data.dispatch.price,
            pickup: {
                date_type: this.setDateType(this.data.pickup.dateScheduledType),
                date_requested: this.data.pickup.dateScheduledStart
            },
            delivery: {
                date_type: this.setDateType(this.data.delivery.dateScheduledType),
                date_requested: this.data.delivery.dateScheduledStart
            }
        };

        return payload;
    }

    setDateType(input)
    {
        switch (input)
        {
            case 'estimated':
                return 'estimated';
            case 'exactly':
                return 'exact';
            case 'no earlier than':
                return 'not_earlier_than';
            case 'no later than':
                return 'not_later_than';
            default:
                return null;
        }
    }

    setBusinessType(rcgType)
    {
        switch (rcgType)
        {
            case 'repo yard':
                return 'REPO_YARD';
            case 'dealer':
            case 'port':
            case 'private':
            case 'business':
            case 'auction':
                rcgType.toUpperCase();
            default:
                return 'BUSINESS';
        }
    }

    setEquipmentType()
    {
        switch (this.data.equipmentType?.name)
        {
            case 'Enclosed':
            case 'Van':
            case 'Reefer':
            case 'Box Truck':
            case 'Sprinter Van':
            case 'Van/Reefer':
            case 'Van/Flatbed/Step Deck':
            case 'Van w/Team':
                return 'ENCLOSED';
            case 'Power Only':
            case 'Driveaway':
                return 'DRIVEAWAY';
            default:
                return 'OPEN';
        }
    }

    formatCommodities(commodities)
    {
        const vehicles = [];
        for (const com of commodities)
        {
            vehicles.push({
                vin: com.identifier || 'vin',
                year: com.vehicle?.year || 2005,
                make: com.vehicle?.make || 'make',
                model: com.vehicle?.model || com.description || 'model',
                type: this.setVehicleType(com.commType.type),
                is_inoperable: com.inoperable === 'yes',
                lot_number: com.lotNumber,
                price: com.bill?.amount || 5,
                tariff: com.invoice?.amount || 5,
                guid: com.extraExternalData?.sdGuid
            });
        }

        return vehicles;
    }

    setVehicleType(vehicleType)
    {
        switch (vehicleType)
        {
            case 'coupe':
            case 'convertible':
                return '2_door_coupe';
            case 'sedan':
                return 'sedan';
            case 'SUV':
                return 'suv';
            case 'minivan':
            case 'cargo van':
                return 'van';
            case 'box truck':
            case 'day cab':
                return 'truck_daycab';
            case 'sleeper cab':
                return 'truck_sleeper';
            case 'pickup truck (4 door)':
                return '4_door_pickup';
            case 'pickup truck (2 door)':
            case 'pickup dually':
                return 'pickup';
            case 'trailer (bumper pull)':
                return 'trailer_bumper_pull';
            case 'trailer (gooseneck)':
                return 'trailer_gooseneck';
            case 'trailer (5th wheel)':
                return 'trailer_5th_wheel';
            case 'RV':
                return 'rv';
            case 'motorcycle':
                return 'motorcycle';
            case 'ATV':
                return 'atv';
            case 'boat':
                return 'boat';
            default:
                return 'other';
        }
    }

    static async handleCreate(payloadMetadata, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);
        const allPromises = [];
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
                const job = await Job.query(trx).findById(objectionPost.jobGuid).withGraphFetched(`[
                    order.[client], commodities(distinct, isNotDeleted).[vehicle]
                ]`);

                const commodityPromises = this.updateCommodity(job.commodities, response.vehicles);
                for (const comPromise of commodityPromises)
                {
                    comPromise.transacting(trx);
                    allPromises.push(comPromise);
                }

                const client = job.order.client;
                if (client.sdGuid !== response.customer.counterparty_guid)
                {
                    client.sdGuid = response.customer.counterparty_guid;
                    allPromises.push(SFAccount.query(trx).patch(client).findById(client.guid));
                }

                objectionPost.externalGuid = response.guid;
                objectionPost.status = 'created';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);
            allPromises.push(LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid));

            await Promise.all(allPromises);

            await trx.commit();

            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }
    }

    static async handlePost(payloadMetadata, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);
        const allPromises = [];

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
                const job = await Job.query().findById(objectionPost.jobGuid).withGraphFetched(`[
                    order.[client], commodities(distinct, isNotDeleted).[vehicle]
                ]`);

                const commodityPromises = this.updateCommodity(job.commodities, response.vehicles);
                for (const comPromise of commodityPromises)
                {
                    comPromise.transacting(trx);
                    allPromises.push(comPromise);
                }

                const client = job.order.client;
                if (client.sdGuid !== response.customer.counterparty_guid)
                {
                    client.sdGuid = response.customer.counterparty_guid;
                    allPromises.push(SFAccount.query(trx).patch(client).findById(client.guid));
                }

                objectionPost.externalGuid = response.guid;
                objectionPost.externalPostGuid = response.guid;
                objectionPost.status = 'posted';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);
            allPromises.push(LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid));

            await Promise.all(allPromises);
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
                objectionPost.externalPostGuid = null;
                objectionPost.status = 'unposted';
                objectionPost.isSynced = true;
                objectionPost.isPosted = false;
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

    static async handleUpdate(payloadMetadata, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);
        const allPromises = [];
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
                const job = await Job.query().findById(objectionPost.jobGuid).withGraphFetched(`[
                    order.[client], commodities(distinct, isNotDeleted).[vehicle]
                ]`);

                const commodityPromises = this.updateCommodity(job.commodities, response.vehicles);
                for (const comPromise of commodityPromises)
                {
                    comPromise.transacting(trx);
                    allPromises.push(comPromise);
                }

                const client = job.order.client;
                if (client.sdGuid !== response.customer.counterparty_guid)
                {
                    client.sdGuid = response.customer.counterparty_guid;
                    allPromises.push(SFAccount.query(trx).patch(client).findById(client.guid));
                }

                objectionPost.externalGuid = response.guid;
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            allPromises.push(LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid));

            await Promise.all(allPromises);
            await trx.commit();
            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }

        return objectionPost;
    }

    static async handleDispatch(payloadMetadata, response)
    {
        const trx = await OrderJobDispatch.startTransaction();
        const allPromises = [];
        try
        {
            const dispatch = OrderJobDispatch.fromJson(payloadMetadata.dispatch);
            dispatch.externalGuid = response.dispatchRes.guid;
            dispatch.setUpdatedBy(dispatch.createdByGuid);
            allPromises.push(OrderJobDispatch.query(trx).patch(dispatch).findById(dispatch.guid));
            const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);
            if (response.hasErrors)
            {
                objectionPost.isSynced = false;
                objectionPost.isPosted = false;
                objectionPost.hasError = true;
                objectionPost.apiError = response.errors;
            }
            else
            {
                objectionPost.externalPostGuid = null;
                objectionPost.status = 'unposted';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isPosted = false;
                objectionPost.externalGuid = response.order.guid;

                const job = await Job.query(trx).findById(objectionPost.jobGuid).withGraphFetched(`[
                    order.[client], commodities(distinct, isNotDeleted).[vehicle], vendor, vendorAgent
                ]`);

                const commodityPromises = this.updateCommodity(job.commodities, response.order.vehicles);
                for (const comPromise of commodityPromises)
                {
                    comPromise.transacting(trx);
                    allPromises.push(comPromise);
                }

                const client = job.order.client;
                if (client.sdGuid !== response.order.customer.counterparty_guid)
                {
                    client.sdGuid = response.order.customer.counterparty_guid;
                    allPromises.push(SFAccount.query(trx).patch(client).findById(client.guid));
                }

                StatusManagerHandler.registerStatus({
                    orderGuid: job.orderGuid,
                    userGuid: dispatch.createdByGuid,
                    statusId: 10,
                    jobGuid: dispatch.jobGuid,
                    extraAnnotations: {
                        dispatchedTo: 'SUPERDISPATCH',
                        vendorGuid: job.vendorGuid,
                        vendorAgentGuid: job.vendorAgentGuid,
                        vendorName: job.vendor.name,
                        vendorAgentName: job.vendorAgent.name,
                        code: 'pending'
                    }
                });
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);
            allPromises.push(LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid));

            await Promise.all(allPromises);
            await trx.commit();

            return dispatch.jobGuid;
        }
        catch (e)
        {
            await trx.rollback();
        }
    }

    static async handleUndispatch(payloadMetadata, response)
    {
        const trx = await OrderJobDispatch.startTransaction();
        const allPromises = [];
        try
        {
            const job = Job.fromJson({
                vendorGuid: null,
                vendorContactGuid: null,
                vendorAgentGuid: null,
                dateStarted: null,
                status: 'ready'
            });
            job.setUpdatedBy(process.env.SYSTEM_USER);
            allPromises.push(Job.query(trx).patch(job).findById(payloadMetadata.dispatch.jobGuid));

            const dispatch = OrderJobDispatch.fromJson(payloadMetadata.dispatch);
            dispatch.isPending = false;
            dispatch.isAccepted = false;
            dispatch.isCanceled = true;
            dispatch.setUpdatedBy(dispatch.updatedByGuid);

            const objectionPost = LoadboardPost.fromJson({
                isSynced: true,
                guid: dispatch.loadboardPost.guid
            });
            allPromises.push(OrderStop.query(trx)
                .patch({ dateScheduledStart: null, dateScheduledEnd: null, dateScheduledType: null, updatedByGuid: process.env.SYSTEM_USER })
                .whereIn('guid',
                    OrderStopLink.query().select('stopGuid')
                        .where({ 'jobGuid': dispatch.jobGuid })
                        .distinctOn('stopGuid')
                ));
            if (response.hasErrors)
            {
                objectionPost.isSynced = false;
                objectionPost.isPosted = false;
                objectionPost.hasError = true;
                objectionPost.apiError = response.errors;
            }
            else
            {
                objectionPost.externalPostGuid = null;
                objectionPost.isSynced = true;
                objectionPost.isPosted = false;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            allPromises.push(LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid));

            allPromises.push(OrderJobDispatch.query(trx).patch(dispatch).findById(payloadMetadata.dispatch.guid));

            const vendor = await SFAccount.query(trx)
                .findById(dispatch.vendorGuid)
                .leftJoin('salesforce.contacts', 'salesforce.accounts.sfId', 'salesforce.contacts.accountId')
                .where({ 'salesforce.contacts.guid': dispatch.vendorAgentGuid })
                .select('salesforce.accounts.name as vendorName',
                    'salesforce.accounts.guid as vendorGuid',
                    'salesforce.contacts.guid as agentGuid',
                    'salesforce.contacts.name as agentName');

            await Promise.all(allPromises);
            await trx.commit();

            StatusManagerHandler.registerStatus({
                orderGuid: dispatch.job.orderGuid,
                userGuid: dispatch.updatedByGuid,
                statusId: 12,
                jobGuid: dispatch.jobGuid,
                extraAnnotations: {
                    undispatchedFrom: 'SUPERDISPATCH',
                    code: 'offer canceled',
                    vendorGuid: vendor.vendorGuid,
                    vendorAgentGuid: vendor.agentGuid,
                    vendorName: vendor.vendorName,
                    vendorAgentName: vendor.agentName
                }
            });
            return dispatch.jobGuid;
        }
        catch (e)
        {
            await trx.rollback();
        }

    }

    static async handleCarrierAcceptDispatch(payloadMetadata, response)
    {
        if (payloadMetadata.externalDispatchGuid || payloadMetadata.externalGuid)
        {
            const trx = await OrderJobDispatch.startTransaction();
            try
            {
                const { orderGuid, vendorName, vendorAgentName, ...dispatch } = await OrderJobDispatch.query(trx).leftJoinRelated('job').leftJoinRelated('vendor').leftJoinRelated('vendorAgent')
                    .findOne({ 'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid })
                    .select('rcgTms.orderJobDispatches.*', 'job.orderGuid', 'vendor.name as vendorName', 'vendorAgent.name as vendorAgentName');

                dispatch.isPending = false;
                dispatch.isAccepted = true;
                dispatch.setUpdatedBy(process.env.SYSTEM_USER);

                // have to put table name because externalGuid is also on loadboard post and not
                // specifying it makes the query ambiguous
                await OrderJobDispatch.query(trx).patch(dispatch).where({
                    'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid,
                    isPending: true,
                    isCanceled: false
                });

                // update the job status to accepted. It's a string, we can literally write anything to this
                await Job.query(trx).patch({
                    status: 'dispatched',
                    updatedByGuid: process.env.SYSTEM_USER
                }).findById(dispatch.jobGuid);

                await trx.commit();

                StatusManagerHandler.registerStatus({
                    orderGuid,
                    userGuid: process.env.SYSTEM_USER,
                    statusId: 13,
                    jobGuid: dispatch.jobGuid,
                    extraAnnotations: {
                        dispatchedTo: 'SUPERDISPATCH',
                        code: 'dispatched',
                        vendorGuid: dispatch.vendorGuid,
                        vendorAgentGuid: dispatch.vendorAgentGuid,
                        vendorName: vendorName,
                        vendorAgentName: vendorAgentName
                    }
                });
                return dispatch.jobGuid;
            }
            catch (e)
            {
                await trx.rollback(e);
            }
        }
    }

    static async handleCarrierDeclineDispatch(payloadMetadata, response)
    {
        if (payloadMetadata.externalDispatchGuid || payloadMetadata.externalGuid)
        {
            const trx = await OrderJobDispatch.startTransaction();

            try
            {
                // getting the dispatch record because it has the job guid, which we need in order to operate
                // on the job
                const { orderGuid, vendorName, vendorAgentName, ...dispatch } = await OrderJobDispatch.query(trx).leftJoinRelated('job').leftJoinRelated('vendor').leftJoinRelated('vendorAgent')
                    .findOne({ 'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid })
                    .select('rcgTms.orderJobDispatches.*', 'job.orderGuid', 'vendor.name as vendorName', 'vendorAgent.name as vendorAgentName');

                dispatch.isPending = false;
                dispatch.isAccepted = false;
                dispatch.isCanceled = true;
                dispatch.setUpdatedBy(process.env.SYSTEM_USER);

                await OrderStop.query(trx)
                    .patch({ dateScheduledStart: null, dateScheduledEnd: null, dateScheduledType: null, updatedByGuid: process.env.SYSTEM_USER })
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid')
                            .where({ 'jobGuid': dispatch.jobGuid })
                            .distinctOn('stopGuid')
                    );

                const job = Job.fromJson({
                    vendorGuid: null,
                    vendorContactGuid: null,
                    vendorAgentGuid: null,
                    dateStarted: null,
                    status: 'declined'
                });
                job.setUpdatedBy(process.env.SYSTEM_USER);
                await Job.query(trx).patch(job).findById(dispatch.jobGuid);

                // have to put table name because externalGuid is also on loadboard post and not
                // specifying it makes the query ambiguous
                await OrderJobDispatch.query().patch(dispatch).findById(dispatch.guid);

                await trx.commit();

                StatusManagerHandler.registerStatus({
                    orderGuid,
                    userGuid: process.env.SYSTEM_USER,
                    statusId: 14,
                    jobGuid: dispatch.jobGuid,
                    extraAnnotations: {
                        undispatchedFrom: 'SUPERDISPATCH',
                        code: 'declined',
                        vendorGuid: dispatch.vendorGuid,
                        vendorAgentGuid: dispatch.vendorAgentGuid,
                        vendorName: vendorName,
                        vendorAgentName: vendorAgentName
                    }
                });

                return dispatch.jobGuid;
            }
            catch (e)
            {
                await trx.rollback(e);
            }
        }
    }

    static updateCommodity(ogCommodities, newCommodities)
    {
        const comsToUpdate = [];
        while (ogCommodities.length !== 0)
        {
            const com = ogCommodities.shift();
            this.commodityUpdater(com, newCommodities);
            com.setUpdatedBy(process.env.SYSTEM_USER);
            comsToUpdate.push(Commodity.query().patch(com).findById(com.guid));
        }

        return comsToUpdate;
    }

    static commodityUpdater(com, newCommodities)
    {
        for (let i = 0; i < newCommodities.length; i++)
        {
            const commodity = newCommodities[i];
            const newName = commodity.vin + ' ' + commodity.year + ' ' + commodity.make + ' ' + commodity.model;
            const comDescription = (com.vehicle?.year || '2005') + ' ' + (com.vehicle?.make || 'make') + ' ' + (com.vehicle?.model || com.description || 'model');
            const comName = (com.identifier || 'vin') + ' ' + comDescription;
            if (comName === newName)
            {
                if (com.extraExternalData == undefined)
                {
                    com.extraExternalData = {};
                }
                com.extraExternalData.sdGuid = commodity.guid;
                newCommodities.shift(i);
                break;
            }
        }
    }
}

module.exports = Super;

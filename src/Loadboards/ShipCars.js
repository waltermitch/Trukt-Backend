const Loadboard = require('./Loadboard');
const DateTime = require('luxon').DateTime;
const LoadboardPost = require('../Models/LoadboardPost');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const OrderStop = require('../Models/OrderStop');
const OrderStopLink = require('../Models/OrderStopLink');
const Job = require('../Models/OrderJob');
const Commodity = require('../Models/Commodity');
const SFAccount = require('../Models/SFAccount');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const knex = require('../Models/BaseModel').knex();

const anonUser = process.env.SYSTEM_USER;

class ShipCars extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'SHIPCARS';
        this.needsCreation = true;
        this.postObject = data.postObjects[this.loadboardName];
        this.saltOrderNumber();
    }

    toJSON()
    {
        const payload =
        {
            pickup_name: this.data.pickup.terminal.name,
            pickup_contact: this.data.pickup?.primaryContact?.name,
            pickup_phone_1: this.cleanUpPhoneNumber(this.data.pickup?.primaryContact?.phoneNumber),
            pickup_phone_2: this.cleanUpPhoneNumber(this.data.pickup?.primaryContact?.mobileNumber),
            pickup_address: this.data.pickup.terminal.street1,
            pickup_city: this.data.pickup.terminal.city,
            pickup_state: this.getStateCode(this.data.pickup.terminal.state),
            pickup_zip: this.data.pickup.terminal.zipCode,
            pickup_notes: this.data.pickup?.notes ? this.pickup?.notes : ' ',
            pickup_estimate_type: this.setDateType(this.data.pickup.dateRequestedType),
            pickup_requested_date_start_type: this.setDateType(this.data.pickup.dateRequestedType),
            pickup_requested_date_start: this.data.pickup.dateRequestedStart.toISODate(),
            pickup_requested_date_end: this.data.pickup.dateRequestedEnd.toISODate(),

            delivery_name: this.data.delivery.terminal.name,
            delivery_contact: this.data.delivery?.primaryContact?.name,
            delivery_phone_1: this.cleanUpPhoneNumber(this.data.delivery?.primaryContact?.phoneNumber),
            delivery_phone_2: this.cleanUpPhoneNumber(this.data.delivery?.primaryContact?.mobileNumber),
            delivery_address: this.data.delivery.terminal.street1,
            delivery_city: this.data.delivery.terminal.city,
            delivery_state: this.getStateCode(this.data.delivery.terminal.state),
            delivery_zip: this.data.delivery.terminal.zipCode,
            delivery_estimate_type: this.setDateType(this.data.delivery.dateRequestedType),
            delivery_requested_date_start_type: this.setDateType(this.data.delivery.dateRequestedType),
            delivery_requested_date_start: this.data.delivery.dateRequestedStart.toISODate(),
            delivery_requested_date_end: this.data.delivery.dateRequestedEnd.toISODate(),
            delivery_notes: this.data.delivery?.notes ? this.data.delivery?.notes : ' ',

            first_available_date: this.data.pickup.dateRequestedStart.toISODate(),
            shipper_load_id: process.env.NODE_ENV != 'prod' || process.env.NODE_ENV != 'production' ? this.saltOrderNumber(this.data.number) : this.data.number,
            instructions: this.data.loadboardInstructions,
            specific_load_requirements: this.postObject.instructions,
            enclosed_trailer: this.getEnclosedTrailer(this.data.equipmentType?.name),
            vehicles: this.formatCommodities(this.data.commodities),
            id: this.postObject.externalGuid,

            payment_method: 'ach',
            total_payment_to_carrier: this.data.actualExpense || 5,
            payment_to_carrier: this.data.actualExpense || 5,
            payment_term_begins: 'delivery',
            payment_term_business_days: 2
        };

        // console.log(payload);
        return payload;
    }

    dispatchJSON()
    {
        const payload = {
            'carrier': this.data.vendor.scId,

            // 'carrier_dot': this.data.vendor.dotNumber,
            'expiration_time': DateTime.now().plus({ hours: 12 }).toString()
        };

        return payload;
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
                lot_number: com.lotNumber,
                operable: com.inoperable === 'no' || com.inoperable === 'unknown',
                id: com.extraExternalData?.scGuid,
                load_id: this.postObject.externalGuid,
                shipper_vehicle_id: com.guid
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
            case 'sedan':
            case 'ATV':
                return 'sedan';
            case 'RV':
            case 'cargo van':
                return 'van';
            case 'SUV':
                return 'suv';
            case 'minivan':
                return 'mini-van';
            case 'pickup truck (2 door)':
            case 'pickup truck (4 door)':
            case 'pickup dually':
            case 'boat':
            case 'trailer (5th wheel)':
            case 'trailer (bumper pull)':
            case 'trailer (gooseneck)':
            case 'box truck':
            case 'day cab':
            case 'sleeper cab':
                return 'pickup';
            case 'motorcycle':
                return 'motorcycle';
            default:
                return 'sedan';
        }
    }

    getEnclosedTrailer(equipmentType)
    {
        switch (equipmentType)
        {
            case 'Enclosed':
            case 'Van':
            case 'Reefer':
            case 'Box Truck':
            case 'Sprinter Van':
            case 'Van/Reefer':
            case 'Van/Flatbed/Step Deck':
            case 'Flatbed/Van/Reefer':
            case 'Van w/Team':
                return true;
            default:
                return false;
        }
    }

    setDateType(input)
    {
        switch (input)
        {
            case 'estimated':
                return 'estimated';
            case 'exactly':
                return 'exactly';
            case 'no earlier than':
                return 'not_earlier';
            case 'no later than':
                return 'not_later';
            default:
                return null;
        }
    }

    cleanUpPhoneNumber(phone)
    {
        if (!phone)
        {
            return undefined;
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
            phone = undefined;
        }

        return phone;
    }

    // adjustDates(payload)
    // {
    //     payload.pickup_requested_date_start = payload.pickup_requested_date_start.toISODate();
    //     payload.pickup_requested_date_end = payload.pickup_requested_date_end.toISODate();

    //     payload.delivery_requested_date_start = payload.delivery_requested_date_start.toISODate();
    //     payload.delivery_requested_date_end = payload.delivery_requested_date_end.toISODate();

    //     payload.first_available_date = payload.pickup_requested_date_start;
    //     return payload;
    // }

    static async handleCreate(post, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(post);

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
                const job = await Job.query().findById(objectionPost.jobGuid).withGraphFetched('[ commodities(distinct, isNotDeleted).[vehicle]]');
                this.updateCommodity(job.commodities, response.vehicles);
                for (const vehicle of job.commodities)
                {
                    vehicle.setUpdatedBy(anonUser);
                    await Commodity.query(trx).patch(vehicle).findById(vehicle.guid);
                }
                objectionPost.externalGuid = response.id;
                objectionPost.status = 'created';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
            }
            objectionPost.setUpdatedBy(anonUser);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.id);

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
                const job = await Job.query().findById(objectionPost.jobGuid).withGraphFetched('[ commodities(distinct, isNotDeleted).[vehicle]]');
                this.updateCommodity(job.commodities, response.vehicles);

                for (const vehicle of job.commodities)
                {
                    vehicle.setUpdatedBy(anonUser);
                    await Commodity.query(trx).patch(vehicle).findById(vehicle.guid);
                }
                objectionPost.externalGuid = response.id;
                objectionPost.externalPostGuid = response.id;
                objectionPost.status = 'posted';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
            }
            objectionPost.setUpdatedBy(anonUser);

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
                objectionPost.isPosted = false;
                objectionPost.externalPostGuid = null;
                objectionPost.status = 'unposted';
                objectionPost.isSynced = true;
            }
            objectionPost.setUpdatedBy(anonUser);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();
            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }
    }

    static async handleDispatch(payloadMetadata, response)
    {
        const trx = await OrderJobDispatch.startTransaction();

        try
        {
            const dispatch = OrderJobDispatch.fromJson(payloadMetadata.dispatch);
            dispatch.externalGuid = response.dispatchRes.id;
            dispatch.setUpdatedBy(anonUser);
            await OrderJobDispatch.query(trx).patch(dispatch).findById(dispatch.guid);

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
                if (objectionPost.externalGuid == null)
                {
                    objectionPost.externalGuid = response.order.id;

                    const job = await Job.query(trx).findById(objectionPost.jobGuid).withGraphFetched('[ commodities(distinct, isNotDeleted).[vehicle]]');
                    this.updateCommodity(job.commodities, response.dispatchRes.vehicles);
                    for (const vehicle of job.commodities)
                    {
                        vehicle.setUpdatedBy(anonUser);
                        await Commodity.query(trx).patch(vehicle).findById(vehicle.guid);
                    }
                }
            }
            objectionPost.setUpdatedBy(anonUser);
            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            
            trx.commit();

            // keeping this commented out until we figure out status log types
            // StatusManagerHandler.registerStatus({
            //     orderGuid: dispatch.loadboardPost.jobGuid,
            //     userGuid: anonUser,
            //     statusId: 4,
            //     jobGuid: objectionPost.guid,
            //     extraAnnotations: { dispatchedTo: 'SHIPCARS', code: 'dispatched' }
            // });

            return objectionPost.jobGuid;
        }
        catch (e)
        {
            trx.rollback();
        }
    }

    static async handleUndispatch(payloadMetadata, response)
    {
        const trx = await OrderJobDispatch.startTransaction();
        try
        {
            const job = Job.fromJson({
                vendorGuid: null,
                vendorContactGuid: null,
                vendorAgentGuid: null,
                dateStarted: null,
                status: 'ready'
            });
            job.setUpdatedBy(anonUser);
            await Job.query(trx).patch(job).findById(payloadMetadata.dispatch.jobGuid);

            const dispatch = OrderJobDispatch.fromJson(payloadMetadata.dispatch);
            dispatch.isPending = false;
            dispatch.isAccepted = false;
            dispatch.isCanceled = true;
            dispatch.setUpdatedBy(anonUser);

            const objectionPost = dispatch.loadboardPost;
            objectionPost.externalGuid = response.id;
            objectionPost.externalPostGuid = null;
            objectionPost.status = 'unposted';
            objectionPost.isPosted = false;
            objectionPost.isSynced = true;

            await OrderStop.query(trx)
                .patch({ dateScheduledStart: null, dateScheduledEnd: null, dateScheduledType: null, updatedByGuid: anonUser })
                .whereIn('guid',
                    OrderStopLink.query(trx).select('stopGuid')
                        .where({ 'jobGuid': dispatch.jobGuid })
                        .distinctOn('stopGuid')
                );

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
            objectionPost.setUpdatedBy(anonUser);

            const commodities = await Commodity.query().where({ isDeleted: false }).whereIn('guid',
                OrderStopLink.query(trx).select('commodityGuid')
                    .where({ 'jobGuid': dispatch.jobGuid })
                    .distinctOn('commodityGuid')).withGraphFetched('[vehicle]');
            this.updateCommodity(commodities, response.vehicles);
            for (const vehicle of commodities)
            {
                vehicle.setUpdatedBy(anonUser);
                await Commodity.query(trx).patch(vehicle).findById(vehicle.guid);
            }

            delete dispatch.job;

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);

            await OrderJobDispatch.query(trx).patch(dispatch).findById(payloadMetadata.dispatch.guid);

            await trx.commit();

            // keeping this commented out until we figure out status log types
            // StatusManagerHandler.registerStatus({
            //     orderGuid: dispatch.job.orderGuid,
            //     userGuid: currentUser,
            //     statusId: 6,
            //     jobGuid,
            //     extraAnnotations: {
            //         undispatchedFrom: 'SHIPCARS',
            //         code: 'ready'
            //     }
            // });

            return objectionPost.jobGuid;
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
                const dispatch = await OrderJobDispatch.query(trx).leftJoinRelated('job').leftJoinRelated('vendor')
                    .findOne({ 'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid })
                    .select('rcgTms.orderJobDispatches.*', 'job.orderGuid', 'vendor.name as vendorName');

                dispatch.isPending = false;
                dispatch.isAccepted = true;
                dispatch.setUpdatedBy(anonUser);

                // move queried data into variables
                // because they are not part of the orer_job_dispatch
                // table and will cause dml errors
                const orderGuid = dispatch.orderGuid;
                const vendorName = dispatch.vendorName;
                delete dispatch.orderGuid;
                delete dispatch.vendorName;

                // have to put table name because externalGuid is also on loadboard post and not
                // specifying it makes the query ambiguous
                await OrderJobDispatch.query(trx).patch(dispatch).where({
                    'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid,
                    isPending: true,
                    isCanceled: false
                });

                await Job.query(trx).patch({
                    status: 'dispatched',
                    updatedByGuid: anonUser
                }).findById(dispatch.jobGuid);

                await trx.commit();

                // keeping this commented out until we figure out status log types
                // StatusManagerHandler.registerStatus({
                //     orderGuid,
                //     userGuid: anonUser,
                //     statusId: 4,
                //     jobGuid: dispatch.jobGuid,
                //     extraAnnotations: { dispatchedTo: 'SHIPCARS', code: 'dispatched', vendor: dispatch.vendorGuid, vendorName: vendorName }
                // });

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
                // 1. Set Dispatch record to canceled
                const dispatch = await OrderJobDispatch.query().leftJoinRelated('job').leftJoinRelated('vendor')
                    .findOne({ 'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid })
                    .select('rcgTms.orderJobDispatches.*', 'job.orderGuid', 'vendor.name as vendorName');

                dispatch.isPending = false;
                dispatch.isAccepted = false;
                dispatch.isCanceled = true;
                dispatch.setUpdatedBy(anonUser);

                // move queried data into variables
                // because they are not part of the orer_job_dispatch
                // table and will cause dml errors
                const orderGuid = dispatch.orderGuid;
                const vendorName = dispatch.vendorName;
                delete dispatch.orderGuid;
                delete dispatch.vendorName;

                // have to put table name because externalGuid is also on loadboard post and not
                // specifying it makes the query ambiguous
                await OrderJobDispatch.query(trx).patch(dispatch).where({
                    'orderJobDispatches.externalGuid': payloadMetadata.externalDispatchGuid,
                    isPending: true,
                    isCanceled: false
                });

                // 2. Remove vendor fields from the job
                const job = Job.fromJson({
                    vendorGuid: null,
                    vendorContactGuid: null,
                    vendorAgentGuid: null,
                    dateStarted: null,
                    status: 'declined'
                });
                job.setUpdatedBy(anonUser);
                await Job.query(trx).patch(job).findById(dispatch.jobGuid);

                // 3. Set the loadboard post record external guid to the new
                // load that has been created
                const objectionPost = LoadboardPost.fromJson({
                    externalGuid: response.id,
                    externalPostGuid: null,
                    isCreated: true,
                    isSynced: true,
                    hasError: false,
                    apiError: null
                });
                objectionPost.setUpdatedBy(anonUser);
                await LoadboardPost.query(trx).patch(objectionPost).findById(dispatch.loadboardPostGuid);

                // 4. update the vehicle ship car ids
                const commodities = await Commodity.query().where({ isDeleted: false }).whereIn('guid',
                    OrderStopLink.query().select('commodityGuid')
                        .where({ 'jobGuid': dispatch.jobGuid })
                        .distinctOn('commodityGuid')).withGraphFetched('[vehicle]');
                const vehicles = this.updateCommodity(commodities, response.vehicles);
                for (const vehicle of vehicles)
                {
                    vehicle.setUpdatedBy(anonUser);
                    await Commodity.query(trx).patch(vehicle).findById(vehicle.guid);
                }

                // 5. unset the stop scheduled dates
                await OrderStop.query(trx)
                    .patch({ dateScheduledStart: null, dateScheduledEnd: null, dateScheduledType: null, updatedByGuid: anonUser })
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid')
                            .where({ 'jobGuid': dispatch.jobGuid })
                            .distinctOn('stopGuid')
                    );

                await trx.commit();

                // keeping this commented out until we figure out status log types
                // StatusManagerHandler.registerStatus({
                //     orderGuid,
                //     userGuid: anonUser,
                //     statusId: 4,
                //     jobGuid: dispatch.jobGuid,
                //     extraAnnotations: { dispatchedTo: 'SHIPCARS', code: 'declined', vendor: dispatch.vendorGuid, vendorName: vendorName }
                // });

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
        // reducing the incoming vehicles to an object where the keys are trukt commodity guids
        // ship cars lets partners store their own guids on commodities to make
        // integration easier
        const shipCarsVehicles = newCommodities.reduce((acc, curr) => (acc[curr.shipper_vehicle_id] = curr, acc), {});

        for (const com of ogCommodities)
        {
            if (com.extraExternalData == undefined)
            {
                com.extraExternalData = {};
            }
            com.extraExternalData.scGuid = shipCarsVehicles[`${com.guid}`].id;
        }
    }
}

module.exports = ShipCars;
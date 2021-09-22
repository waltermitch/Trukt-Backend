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

const anonUser = '00000000-0000-0000-0000-000000000000';

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
            pickup_requested_date_start: DateTime.fromISO(this.data.pickup.dateRequestedStart).toISODate(),
            pickup_requested_date_end: DateTime.fromISO(this.data.pickup.dateRequestedEnd).toISODate(),

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
            delivery_requested_date_start: DateTime.fromISO(this.data.delivery.dateRequestedStart),
            delivery_requested_date_end: DateTime.fromISO(this.data.delivery.dateRequestedEnd),
            delivery_notes: this.data.delivery?.notes ? this.data.delivery?.notes : ' ',

            first_available_date: this.toStringDate(this.data.pickup.dateRequestedStart),
            shipper_load_id: process.env.NODE_ENV != 'prod' || process.env.NODE_ENV != 'production' ? this.saltOrderNumber(this.data.number) : this.data.number,
            instructions: this.data.loadboardInstructions,
            specific_load_requirements: this.postObject.instructions,
            enclosed_trailer: this.getEnclosedTrailer(this.data.equipmentType?.name),
            vehicles: this.formatCommodities(this.data.commodities),
            id: this.postObject.externalGuid,

            payment_method: 'ach',
            total_payment_to_carrier: this.data.estimatedExpense,
            payment_to_carrier: this.data.estimatedExpense,
            payment_term_begins: 'delivery',
            payment_term_business_days: 2
        };

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
                const vehicles = this.updateCommodity(job.commodities, response.vehicles);
                for (const vehicle of vehicles)
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
        }
        catch (err)
        {
            await trx.rollback();
        }

        return objectionPost;
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
                const vehicles = this.updateCommodity(job.commodities, response.vehicles);
                for (const vehicle of vehicles)
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
        }
        catch (err)
        {
            await trx.rollback();
        }

        return objectionPost;
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
        }
        catch (err)
        {
            await trx.rollback();
        }

        return objectionPost;
    }

    static updateCommodity(ogCommodities, newCommodities)
    {
        const comsToUpdate = [];
        while (ogCommodities.length !== 0)
        {
            const com = ogCommodities.shift();
            this.commodityUpdater(com, newCommodities);
            comsToUpdate.push(com);
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
                com.extraExternalData.scGuid = commodity.id;
                newCommodities.shift(i);
            }
        }
    }
}

module.exports = ShipCars;
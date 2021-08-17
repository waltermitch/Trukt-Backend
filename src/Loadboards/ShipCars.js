const Loadboard = require('./Loadboard');
const DateTime = require('luxon').DateTime;
const currency = require('currency.js');
const states = require('us-state-codes');
const Job = require('../Models/OrderJob');
const Commodity = require('../Models/Commodity');
const SFAccount = require('../Models/SFAccount');

const needsCreation = true;

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
            pickup_contact: this.data.pickup?.primaryContact.firstName + ' ' + this.data.pickup?.primaryContact.lastName,
            pickup_phone_1: this.data.pickup?.primaryContact.phoneNumber,
            pickup_phone_2: this.data.pickup?.primaryContact.mobilePhone,
            pickup_address: this.data.pickup.terminal.street1,
            pickup_city: this.data.pickup.terminal.city,
            pickup_state: states.getStateCodeByStateName(this.data.pickup.terminal.state),
            pickup_zip: this.data.pickup.terminal.zipCode,
            pickup_notes: this.data.pickup?.notes ? this.pickup?.notes : ' ',
            pickup_estimate_type: this.setDateType(this.data.pickup.dateScheduledType),

            delivery_name: this.data.delivery.terminal.name,
            delivery_contact: this.data.delivery?.primaryContact.firstName + ' ' + this.data.delivery?.primaryContact.lastName,
            delivery_phone_1: this.data.delivery?.primaryContact.phoneNumber,
            delivery_phone_2: this.data.delivery?.primaryContact.mobilePhone,
            delivery_address: this.data.delivery.terminal.street1,
            delivery_city: this.data.delivery.terminal.city,
            delivery_state: states.getStateCodeByStateName(this.data.delivery.terminal.state),
            delivery_zip: this.data.delivery.terminal.zipCode,
            delivery_estimate_type: this.setDateType(this.data.delivery.dateScheduledType),
            delivery_notes: this.data.delivery?.notes ? this.data.delivery?.notes : ' ',

            first_available_date: this.toStringDate(this.data.pickup.dateScheduledStart),
            shipper_load_id: process.env.NODE_ENV != 'prod' || process.env.NODE_ENV != 'production' ? this.saltOrderNumber(this.data.number) : this.data.number,
            instructions: this.data.loadboardInstructions,
            specific_load_requirements: this.postObject.instructions,
            enclosed_trailer: this.getEnclosedTrailer(this.data.equipmentType?.name),
            vehicles: this.formatCommodities(this.data.commodities),
            id: this.postObject.externalGuid,

            payment_method: 'ach',
            payment_on_pickup_method: 'cash',
            payment_on_delivery_method: 'uship',
            total_payment_to_carrier: this.data.estimatedExpense,
            payment_to_carrier: this.data.carrierPay,
            payment_term_begins: 'delivery',
            payment_term_business_days: 2
        };

        return payload;
    }

    formatCommodities(commodities)
    {
        const vehicles = [];
        for (const com of commodities)
        {
            if (com.vehicle === null)
            {
                com.vehicle = { year: 2000, make: 'make', model: com.description };
            }
            vehicles.push({
                type: this.setVehicleType(com.commType.type),
                year: com.vehicle.year,
                make: com.vehicle.make,
                model: com.vehicle.model,
                vin: com.identifier !== null ? com.identifier.substring(0, 19) : null,
                lot_number: com.lotNumber,
                operable: com.inoperable === 'no' ? false : true,
                id: com.extraExternalData?.scGuid,
                load_id: this.postObject.externalGuid
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

    static async handlepost(post, response)
    {
        const job = await Job.query().findById(post.jobGuid).withGraphFetched('[ commodities(distinct, isNotDeleted)]');
        const vehicles = this.updateCommodity(job.commodities, response.vehicles);
        for (const vehicle of vehicles)
        {
            vehicle.setUpdatedBy(this.curentUser);
            await Commodity.query().patch(vehicle).findById(vehicle.guid);
        }
        post.externalGuid = response.id;
        post.externalPostGuid = response.id;
        post.status = 'posted';
        post.isSynced = true;
        post.isPosted = true;
    }

    static async handleunpost(post, response)
    {
        post.externalPostGuid = null;
        post.status = 'unposted';
        post.isSynced = true;
        post.isPosted = false;
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
            const comName = com.identifier + ' ' + com.description;
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
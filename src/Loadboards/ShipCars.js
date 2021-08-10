const Loadboard = require('./Loadboard');
const DateTime = require('luxon').DateTime;
const currency = require('currency.js');
const states = require('us-state-codes');

// const loadboardName = 'SHIPCARS';
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
            shipper_load_id: this.data.number,
            instructions: this.data.loadboardInstructions,
            specific_load_requirements: this.postObject.instructions,
            enclosed_trailer: this.getEnclosedTrailer(),
            vehicles: this.formatCommodities(this.data.commodities),
            guid: this.postObject.externalGuid,

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
                operable: com.inoperable === 'no' ? false : true
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

    setEquipmentType(equipmentType)
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
            case 'Van w/Team':
                return true;
            default:
                return false;
        }

    }

    getEnclosedTrailer()
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

    // updateCommodities()
    // {
    //     for (let i = 0; i < this.commodities.length; i++)
    //     {
    //         delete this.commodities[i].GUID;
    //         this.commodities[i].type = this.setVehicleType(this.commodities[i].vehicleType);
    //         this.commodities[i].operable = !this.commodities[i]?.isInoperable;
    //     }
    // }

    // setVehicleType(vehicleType)
    // {
    //     switch (vehicleType)
    //     {
    //         case 'Coupe':
    //         case 'Convertible':
    //         case 'Sedan':
    //             return 'sedan';
    //         case 'SUV':
    //             return 'suv';
    //         case 'Minivan':
    //             return 'mini-van';
    //         case 'Cargo Van':
    //             return 'van';
    //         case 'Motorcycle':
    //             return 'motorcycle';
    //         case 'Box Truck':
    //         case 'Sleeper Cab':
    //         case 'Day Cab':
    //         case 'Pickup':
    //         default:
    //             return 'pickup';
    //     }
    // }

    // setEquipmentType(equipmentType)
    // {
    //     switch (equipmentType)
    //     {
    //         case 'Enclosed':
    //         case 'Van':
    //         case 'Reefer':
    //         case 'Box Truck':
    //         case 'Sprinter Van':
    //         case 'Van/Reefer':
    //         case 'Van/Flatbed/Step Deck':
    //         case 'Van w/Team':
    //             this.enclosed_trailer = true;
    //             break;
    //         default:
    //             this.enclosed_trailer = false;
    //     }

    // }

    // setReturnValues(order, data, action)
    // {
    //     switch (action)
    //     {

    //         // update post GUID
    //         case 'create':
    //             order.loadGUID = (data.id || this.loadGUID);
    //             break;
    //         case 'update':
    //             // following the same logic in the update function
    //             // only update the postGUID if it exists because it would have only updated the posting
    //             if (order.postGUID)

    //                 order.postGUID = (data.id || this.postGUID);

    //             else

    //                 order.loadGUID = (data.id || this.loadGUID);

    //             break;
    //         case 'post':
    //         case 'repost':
    //             order.postGUID = (data.id || this.postGUID);
    //             break;
    //         case 'get':
    //             Object.assign(order, data);
    //             break;
    //         default:
    //             break;

    //     }
    // }

    // setNotes(notes)
    // {
    //     return notes ? notes : ' ';
    // }

    // toJSON()
    // {
    //     const payload =
    //     {
    //         'delivery_name': this.delivery.name,
    //         'delivery_contact': this.delivery.contactName,
    //         'delivery_phone_1': this.delivery.contactPhone,
    //         'delivery_phone_2': this.delivery.contactMobile,
    //         'delivery_address': this.delivery.address,
    //         'delivery_city': this.delivery.city,
    //         'delivery_state': this.delivery.state,
    //         'delivery_zip': this.delivery.zip,
    //         'delivery_notes': this.setNotes(this.delivery?.notes),

    //         'pickup_name': this.pickup.name,
    //         'pickup_contact': this.pickup.contactName,
    //         'pickup_phone_1': this.pickup.contactPhone,
    //         'pickup_phone_2': this.pickup.contactMobile,
    //         'pickup_address': this.pickup.address,
    //         'pickup_city': this.pickup.city,
    //         'pickup_state': this.pickup.state,
    //         'pickup_zip': this.pickup.zip,
    //         'pickup_notes': this.setNotes(this.pickup.notes),

    //         'first_available_date': this.firstAvailablePickupDate,
    //         'shipper_load_id': this.orderNumber,
    //         'instructions': this.loadboardInstructions,
    //         'total_payment_to_carrier': this.carrierPay,
    //         'payment_to_carrier': this.carrierPay,
    //         'enclosed_trailer': this.enclosed_trailer,

    //         'vehicles': this.commodities

    //     };

    //     return payload;
    // }

    // fromJSON(data)
    // {
    //     // compose vehicles
    //     const comms = [];

    //     for (let i = 0; i < data?.vehicles?.length; i++)
    //     {
    //         const comm =
    //         {
    //             'year': data.vehicles[i].year,
    //             'make': data.vehicles[i].make,
    //             'model': data.vehicles[i].model,
    //             'type': data.vehicles[i].type

    //         };

    //         comms.push(comm);
    //     }

    //     const payload =
    //     {
    //         'orderNumber': data.shipper_load_id,
    //         'carrierPay': data.total_payment_to_carrier,
    //         'distance': data.distance,
    //         'loadGUID': data.id,
    //         'delivery':
    //         {
    //             'name': data.delivery_name,
    //             'notes': data.delivery_notes,
    //             'address': data.delivery_address,
    //             'city': data.delivery_city,
    //             'state': data.delivery_state,
    //             'zip': data.delivery_zip,
    //             'contactName': data.delivery_contact,
    //             'contactPhone': data.delivery_phone_1
    //         },
    //         'pickup':
    //         {
    //             'name': data.pickup_name,
    //             'notes': data.pickup_notes,
    //             'address': data.pickup_address,
    //             'city': data.pickup_city,
    //             'state': data.pickup_state,
    //             'zip': data.pickup_zip,
    //             'contactName': data.pickup_contact,
    //             'contactPhone': data.pickup_phone_1
    //         },
    //         'commodities': comms
    //     };

    //     return payload;
    // }

    // async create()
    // {
    //     // get sc
    //     const sc = await this.getSC();

    //     // make request
    //     const res = await sc.post('/shipper_loads/', this.toJSON());

    //     return res.data;
    // }

    // async delete()
    // {
    //     return { 'status': 200 };
    // }

    // async update()
    // {
    //     let res;

    //     // get instance
    //     const sc = await this.getSC();

    //     // TODO: do not repost here, need to call update funcitonality
    //     // if post then update post ship car documentation to update
    //     // cannot update post and load at the same time because ship cars
    //     // will return a 409
    //     if (this.postGUID)

    //         res = await sc.patch(`/postings/${this.postGUID}`, this.toJSON());

    //     else

    //         res = await sc.patch(`/loads/${this.loadGUID}`, this.toJSON());

    //     return res?.data;
    // }

    // async get()
    // {
    //     // get instance
    //     const sc = await this.getSC();

    //     // make request to get load
    //     const res = await sc.get(`/loads/${this.loadGUID}/`);

    //     // convert payload
    //     const payload = this.fromJSON(res.data);

    //     return payload;
    // }

    // async repost()
    // {
    //     // remove
    //     await this.unpost();

    //     // post again
    //     return await this.post();
    // }

    // async post()
    // {
    //     // get sc
    //     const sc = await this.getSC();

    //     if (!this.loadGUID)
    //     {
    //         // create order
    //         const order = await this.create();

    //         // save id
    //         this.loadGUID = order.id;
    //     }

    //     // make request
    //     const res = await sc.post(`/loads/${this.loadGUID}/post_to_loadboard/`);

    //     return res.data;
    // }

    // async unpost()
    // {
    //     // get sc
    //     const sc = await this.getSC();

    //     // make request
    //     const res = await sc.post(`/postings/${this.postGUID}/remove_from_loadboard/`);

    //     return res.data;
    // }

    // async sendOffer()
    // {
    //     // get sc connection
    //     const sc = await this.getSC();

    //     // if order doesn't exist yet - create it?
    //     if (!this.GUID)
    //         this.GUID = (await this.create()).id;

    //     // get carrier url
    //     const carrier = await sc.get(`/carriers/${this.carrierDOT}/`);

    //     // send offer
    //     const res = await sc.post(`/postings/${this.GUID}/offer/`, { 'carrier': carrier.data.url });

    //     return res.data;
    // }

    // async cancelOffer()
    // {
    //     // get sc connection
    //     const sc = await this.getSC();

    //     // cancel offer
    //     const res = await sc.post(`/postings/${this.GUID}/shipper_cancel/`);

    //     return res.data;
    // }

    // async getSC()
    // {
    //     // check for exp and connection
    //     if (!sc || !sc?.expCheck())
    //     {
    //         // get config
    //         const config = this.getConfig();

    //         // compose options for class
    //         const opts =
    //         {
    //             url: config.ShipCarsApiUrl,
    //             tokenName: config.ShipCarsTokenName
    //         };

    //         // create new http class
    //         sc = new HTTPController(opts);

    //         // get token
    //         const token = await sc.getSecret({ 'name': opts.tokenName });

    //         // save exp time
    //         sc.exp = token.exp;

    //         if (!sc.instance)

    //             // create instance
    //             sc.connect();

    //         // set token
    //         sc.setToken(token.value);
    //     }

    //     return sc.instance;
    // }
}

module.exports = ShipCars;
// const HTTPController = require('../Azure/HTTPController');
const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const states = require('us-state-codes');

class Super extends Loadboard
{

    constructor(data)
    {
        super(data);
        this.loadboardName = 'SUPERDISPATCH';
        this.needsCreation = true;
        this.data = data;
        this.postObject = data.postObjects[this.loadboardName];

        // this.setEquipmentType(this.data.equipmentType?.name);
    }

    static validate(post)
    {
        console.log('validtaing for super');
    }

    toJSON()
    {
        const payload =
        {
            customer: {
                notes: 'these are notes for customer visibile in the customer portal',
                address: this.data.order.client.billingStreet,
                city: this.data.order.client.billingCity,
                state: this.data.order.client.billingState,
                zip: this.data.order.client.billingPostalCode,
                contact_name: this.data.order.clientContact?.firstName + ' ' + this.data.order.clientContact?.lastName,
                contact_phone: this.data.order.clientContact?.phone,
                contact_mobile_phone: this.data.order.clientContact?.mobilePhone,
                contact_email: this.data.order.clientContact?.email,
                name: this.data.order.client.name,
                business_type: this.data.order.client.type,
                email: this.data.order.client?.email,
                phone: this.data.order.client?.phone,
                counterparty_guid: this.data.order.client.sdGuid,
                save_as_new: this.data.order.client.sdGuid === null
            },
            customer_payment: { tariff: currency(this.data.estimatedRevenue).value },
            number: this.data.number,
            purchase_order_number: this.data.order.referenceNumber,
            price: currency(this.data.estimatedExpense).value,
            dispatcher_name: this.data.order.dispatcher.name,
            instructions: this.data.order.instructions,
            loadboard_instructions: this.postObject.instructions || this.data.loadboardInstructions,
            transport_type: this.setEquipmentType(this.data.equipmentType?.name),
            tariff: currency(this.data.estimatedRevenue).value,
            inspection_type: this.data.order.inspectionType,
            payment: { terms: 'ach' },
            pickup:
            {
                first_available_pickup_date: this.data.pickup.dateScheduledStart,
                scheduled_at: this.data.pickup.dateScheduledStart,
                scheduled_ends_at: this.data.pickup.dateScheduledEnd,
                scheduled_at_by_customer: this.data.pickup.dateScheduledStart,
                scheduled_ends_at_by_customer: this.data.pickup.dateScheduledEnd,
                date_type: this.setDateType(this.data.pickup.dateScheduledType),
                notes: this.data.pickup.notes,
                venue:
                {
                    address: this.data.pickup.terminal.street1,
                    city: this.data.pickup.terminal.city,
                    state: states.getStateCodeByStateName(this.data.pickup.terminal.state),
                    zip: this.data.pickup.terminal.zipCode,
                    name: this.data.pickup.terminal.name,
                    business_type: this.setBusinessType(this.data.pickup.terminal.locationType),
                    contact_name: this.data.pickup.primaryContact.firstName + ' ' + this.data.pickup.primaryContact.lastName,
                    contact_email: this.data.pickup.primaryContact.email,
                    contact_phone: this.data.pickup.primaryContact.phoneNumber,
                    contact_mobile_phone: this.data.pickup.primaryContact.mobileNumber,
                    date_type: this.setDateType(this.data.pickup.dateScheduledType)
                }
            },
            delivery:
            {
                scheduled_at: this.data.delivery.dateScheduledStart,
                scheduled_ends_at: this.data.delivery.dateScheduledEnd,
                scheduled_at_by_customer: this.data.delivery.dateScheduledStart,
                scheduled_ends_at_by_customer: this.data.delivery.dateScheduledEnd,
                notes: this.data.delivery.notes,
                date_type: this.setDateType(this.data.delivery.dateScheduledType),
                venue:
                {
                    address: this.data.delivery.terminal.street1,
                    city: this.data.delivery.terminal.city,
                    state: states.getStateCodeByStateName(this.data.delivery.terminal.state),
                    zip: this.data.delivery.terminal.zipCode,
                    name: this.data.delivery.terminal.name,
                    business_type: this.setBusinessType(this.data.delivery.terminal.locationType),
                    contact_name: this.data.delivery.primaryContact.firstName + ' ' + this.data.delivery.primaryContact.lastName,
                    contact_email: this.data.delivery.primaryContact.email,
                    contact_phone: this.data.delivery.primaryContact.phoneNumber,
                    contact_mobile_phone: this.data.delivery.primaryContact.mobileNumber,
                    date_type: this.setDateType(this.data.delivery.dateScheduledType)
                }
            },

            vehicles: this.formatCommodities(this.data.commodities),
            guid: this.postObject.externalGuid
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
            default:
                return rcgType.toUpperCase();
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
        return commodities.map(x =>
        {
            if (x.vehicle === null)
            {
                x.vehicle = { year: '', make: 'make', model: x.description };
            }
            const veh = {
                'year': x.vehicle.year,
                'make': x.vehicle.make,
                'model': x.vehicle.model,
                'type': this.setVehicleType(x.commType.type),
                'is_inoperable': false,
                'lot_number': x.lotNumber,
                'price': 12,
                'tariff': 13,
                'guid': null,
                'vin': x.identifier
            };
            return veh;
        });
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
            case 'pickup truck (4 Door)':
                return '4_door_pickup';
            case 'pickup truck (2 Door)':
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
}

module.exports = Super;

const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const states = require('us-state-codes');

const loadboardName = 'CARDELIVERYNETWORK';
const needsCreation = true;

class CarDeliveryNetwork extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'CARDELIVERYNETWORK';
        this.needsCreation = true;
        this.data = data;
        this.postObject = data.postObjects[loadboardName];
    }

    toJSON()
    {
        const payload = {
            loadId: this.data.number,
            Notes: 'These notes are sent to the driver',
            ServiceRequired: 1,
            JobInitiator: this.data.order.owner.name,
            Customer: {
                AddressLines: '9300 Tech Center Drive',
                City: 'Sacramento',
                Contact: null,
                OrganisationName: 'RCG Logistics LLC',
                QuickCode: null,
                StateRegion: 'CA',
                ZipPostCode: '95832'
            },
            Pickup: {
                Destination: {
                    AddressLines: this.data.pickup.terminal.street1,
                    City: this.data.pickup.terminal.city,
                    Contact: this.data.pickup.primaryContact.firstName + ' ' + this.data.pickup.primaryContact.lastName,
                    OrganisationName: this.data.pickup.terminal.name,
                    QuickCode: null,
                    StateRegion: states.getStateCodeByStateName(this.data.pickup.terminal.state),
                    ZipPostCode: this.data.pickup.terminal.zipCode
                },
                RequestedDate: this.data.pickup.dateScheduledStart
            },
            Dropoff: {
                Destination: {
                    AddressLines: this.data.delivery.terminal.street1,
                    City: this.data.delivery.terminal.city,
                    Contact: this.data.delivery.primaryContact.firstName + ' ' + this.data.delivery.primaryContact.lastName,
                    OrganisationName: this.data.delivery.terminal.name,
                    QuickCode: null,
                    StateRegion: states.getStateCodeByStateName(this.data.delivery.terminal.state),
                    ZipPostCode: this.data.delivery.terminal.zipCode
                },
                RequestedDate: this.data.delivery.dateScheduledStart,
                RequestedDateIsExact: true
            },
            Vehicles: this.formatCommodities(this.data.commodities)
        };

        return payload;
    }

    formatCommodities(commodities)
    {
        const vehicles = [];
        for (const com of commodities)
        {
            vehicles.push({
                Make: com.vehicle.make,
                Model: com.vehicle.model,
                Registration: com.vehicle.year,
                Vin: com.identifier,
                Variant: com.commType.type
            });
        }

        return vehicles;
    }
}

module.exports = CarDeliveryNetwork;
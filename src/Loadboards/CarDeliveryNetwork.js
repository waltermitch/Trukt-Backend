const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const states = require('us-state-codes');
const localSettings = require('../../local.settings.json');
const LoadboardPost = require('../Models/LoadboardPost');

const anonUser = '00000000-0000-0000-0000-000000000000';

class CarDeliveryNetwork extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'CARDELIVERYNETWORK';
        this.postObject = data.postObjects[this.loadboardName];
    }

    toJSON()
    {
        const orderNumber = process.env.NODE_ENV != 'prod' || process.env.NODE_ENV != 'production' ? this.saltOrderNumber(this.data.number) : this.data.number;
        const payload = {
            loadId: orderNumber,
            Notes: this.data.instructions,
            AdvertiseType: 'Both',
            JobNumberSuffix: 'RC',
            PaymentTerm: 2,
            BuyPrice: this.data.estimatedExpense,
            ServiceRequired: 1,
            JobInitiator: this.data.order.dispatcher.name,
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
                    Contact: this.data.pickup.primaryContact.name,
                    OrganisationName: this.data.pickup.terminal.name,
                    QuickCode: null,
                    StateRegion: this.data.pickup.terminal.state.length > 2 ? states.getStateCodeByStateName(this.data.pickup.terminal.state) : this.data.pickup.terminal.state,
                    ZipPostCode: this.data.pickup.terminal.zipCode
                },
                RequestedDate: this.data.pickup.dateScheduledStart
            },
            Dropoff: {
                Destination: {
                    AddressLines: this.data.delivery.terminal.street1,
                    City: this.data.delivery.terminal.city,
                    Contact: this.data.delivery.primaryContact.name,
                    OrganisationName: this.data.delivery.terminal.name,
                    QuickCode: null,
                    StateRegion: this.data.delivery.terminal.state.length > 2 ? states.getStateCodeByStateName(this.data.delivery.terminal.state) : this.data.delivery.terminal.state,
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
            if (com.vehicle === null)
            {
                com.vehicle = { year: '', make: 'make', model: com.description };
            }
            com.identifier = com.identifier !== null ? com.identifier.substring(0, 17) : null;
            vehicles.push({
                Make: com.vehicle.make,
                Model: com.vehicle.model,
                Registration: com.vehicle.year,
                Vin: com.identifier,
                Variant: com.commType?.type
            });
        }

        return vehicles;
    }

    static async handlepost(post, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(post);

        try
        {
            objectionPost.externalGuid = response.id;
            objectionPost.externalPostGuid = response.id;
            objectionPost.status = 'posted';
            objectionPost.isSynced = true;
            objectionPost.isPosted = true;
            objectionPost.setUpdatedBy(anonUser);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.id);

            trx.commit();
        }
        catch (err)
        {
            await trx.rollback();
        }

        return objectionPost;
    }

    static async handleunpost(post, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(post);

        try
        {
            objectionPost.externalPostGuid = null;
            objectionPost.status = 'unposted';
            objectionPost.isSynced = true;
            objectionPost.isPosted = false;
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
}

module.exports = CarDeliveryNetwork;
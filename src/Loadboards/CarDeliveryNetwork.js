const LoadboardPost = require('../Models/LoadboardPost');
const Loadboard = require('./Loadboard');

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
        const orderNumber = process.env.NODE_ENV == 'prod' || process.env.NODE_ENV == 'production' ? this.data.number : this.saltOrderNumber(this.data.number);
        const payload = {
            loadId: orderNumber,
            Notes: this.data.instructions,
            AdvertiseType: 'Both',
            JobNumberSuffix: 'RC',
            PaymentTerm: 2,
            BuyPrice: this.data.actualExpense,
            ServiceRequired: 1,
            JobInitiator: this.data.dispatcher?.name || 'Brad Marinov',
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
                    Contact: this.data.pickup?.primaryContact?.name || null,
                    Phone: this.data.pickup?.primaryContact?.phoneNumber || null,
                    MobilePhone: this.data.pickup?.primaryContact?.mobilePhone || null,
                    OrganisationName: this.data.pickup.terminal.name,
                    QuickCode: this.data.pickup.terminal.guid,
                    StateRegion: this.data.pickup.terminal.state,
                    ZipPostCode: this.data.pickup.terminal.zipCode
                },
                RequestedDate: this.data.pickup.dateRequestedStart
            },
            Dropoff: {
                Destination: {
                    AddressLines: this.data.delivery.terminal.street1,
                    City: this.data.delivery.terminal.city,
                    Contact: this.data.delivery?.primaryContact?.name || null,
                    Phone: this.data.delivery?.primaryContact?.phoneNumber || null,
                    MobilePhone: this.data.delivery?.primaryContact?.mobilePhone || null,
                    OrganisationName: this.data.delivery.terminal.name,
                    QuickCode: this.data.delivery.terminal.guid,
                    StateRegion: this.data.delivery.terminal.state,
                    ZipPostCode: this.data.delivery.terminal.zipCode
                },
                RequestedDate: this.data.delivery.dateRequestedStart,
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
            com.identifier = com.identifier !== null ? com.identifier.substring(0, 17) : null;
            vehicles.push({
                Vin: com.identifier || 'vinNumber',
                Registration: com.vehicle?.year || 2005,
                Make: com.vehicle?.make || 'make',
                Model: com.vehicle?.model || com.description || 'model',
                Variant: com.commType?.type,
                Location: com.lotNumber
            });
        }

        return vehicles;
    }

    static async handleCreate(payloadMetadata, response)
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
                objectionPost.externalGuid = response.guid;
                objectionPost.status = 'created';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isDeleted = false;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.id);

            await trx.commit();

            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }
    }
}

module.exports = CarDeliveryNetwork;
const Loadboard = require('./Loadboard');
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
                    Contact: this.data.pickup?.primaryContact?.name,
                    Phone: this.data.pickup?.primaryContact?.phoneNumber,
                    MobilePhone: this.data.pickup?.primaryContact?.mobilePhone,
                    OrganisationName: this.data.pickup.terminal.name,
                    QuickCode: this.data.pickup.terminal.guid,
                    StateRegion: this.getStateCode(this.data.pickup.terminal.state),
                    ZipPostCode: this.data.pickup.terminal.zipCode
                },
                RequestedDate: this.data.pickup.dateRequestedStart
            },
            Dropoff: {
                Destination: {
                    AddressLines: this.data.delivery.terminal.street1,
                    City: this.data.delivery.terminal.city,
                    Contact: this.data.delivery?.primaryContact?.name,
                    Phone: this.data.delivery?.primaryContact?.phoneNumber,
                    MobilePhone: this.data.delivery?.primaryContact?.mobilePhone,
                    OrganisationName: this.data.delivery.terminal.name,
                    QuickCode: this.data.delivery.terminal.guid,
                    StateRegion: this.getStateCode(this.data.delivery.terminal.state),
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

    static async handlecreate(post, response)
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
                objectionPost.externalGuid = response.id;
                objectionPost.status = 'created';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
            }
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

    static async handlepost(post, response)
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
                objectionPost.externalGuid = response.id;
                objectionPost.externalPostGuid = response.id;
                objectionPost.status = 'posted';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
            }
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
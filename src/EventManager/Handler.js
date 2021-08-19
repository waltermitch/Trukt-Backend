const SFAccount = require('../Models/SFAccount');
const PubSub = require('../Azure/PubSub');
const Triumph = require('../Triumph/API');
const QB = require('../QuickBooks/API');
const Super = require('../Super/API');

class Handler
{
    static async jobStatusChanged(data)
    {
        // send to group
        await PubSub.publishToGroup(data.guid, data);
    }

    static async accountUpdated(data)
    {
        // get account info
        const res = await SFAccount.query().findOne('guid', data.guid).withGraphFetched('rectype');

        const recordType = res.rectype.name;

        // build generic payload
        const payload =
        {
            accountNumber: res.accountNumber,
            billingCity: res.billingCity,
            billingCountry: res.billingCountry,
            billingPostalCode: res.billingPostalCode,
            billingState: res.billingState,
            billingStreet: res.billingStreet,
            dotNumber: res.dotNumber,
            email: res.email,
            fax: res.fax,
            firstName: res.name,
            guid: res.guid,
            mcNumber: res.mcNumber,
            name: res.name,
            phone: res.phone,
            qbId: res.qbId,
            sdGuid: res.sdGuid,
            sfId: res.sfId,
            shippingCity: res.shippingCity,
            shippingStreet: res.shippingStreet,
            shippingPostalCode: res.shippingPostalCode,
            shippingState: res.shippingState,
            shippingCountry: res.shippingCountry,
            taxId: res.taxId
        };

        // make api calls, add additional fields base on recordType
        switch (recordType)
        {
            case 'Client':
                payload.orderInstructions = res.orderInstructions;
                payload.internalNotes = res.internalNotes;
                payload.businessType = res.businessType;
                payload.notes = res.notes;

                await Promise.all([QB.upsertClient(payload), Super.upsertClient(payload)]);
                break;

            case 'Carrier':
                payload.bankRoutingNumber = res.bankRoutingNumber;
                payload.bankAccountNumber = res.bankAccountNumber;
                payload.blacklist = res.blacklist;
                payload.insuranceExpiration = res.insuranceExpiration;
                payload.preferred = res.preferred;

                const result = await Promise.allSettled([QB.upsertVendor(payload), Super.upsertCarrier(payload), Triumph.createCarrierProfile(payload)]);

                for (const r of result)
                {
                    if (r.status === 'fulfilled')
                    {
                        console.log('Fulfilled');
                    }
                    else
                    {
                        console.log(r.reason);
                    }
                }
                break;

            case 'Vendor':
                await QB.upsertCarrier(payload);
                break;

            default:
                return;
        }
    }
}

module.exports = Handler;
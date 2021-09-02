const SFAccount = require('../Models/SFAccount');
const Queue = require('../Azure/ServiceBus');
const { mergeDeepRight } = require('ramda');
const Triumph = require('../Triumph/API');
const NodeCache = require('node-cache');
const QB = require('../QuickBooks/API');
const Super = require('../Super/API');
const LoadboardsFunc = require('../Loadboards/API');

// duplicate checking cache
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 10 });

class AccountUpdateManager
{
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
            scId: res.scId,
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
        let response;
        switch (recordType)
        {
            case 'Client':
                payload.orderInstructions = res.orderInstructions;
                payload.internalNotes = res.internalNotes;
                payload.businessType = res.businessType;
                payload.notes = res.notes;

                response = await Promise.allSettled([QB.upsertClient(payload), Super.upsertClient(payload)]);
                break;

            case 'Carrier':
                payload.bankRoutingNumber = res.bankRoutingNumber;
                payload.bankAccountNumber = res.bankAccountNumber;
                payload.blacklist = res.blacklist;
                payload.insuranceExpiration = res.insuranceExpiration;
                payload.preferred = res.preferred;

                response = await Promise.allSettled([
                    QB.upsertVendor(payload),
                    Super.upsertCarrier(payload),
                    Triumph.createCarrierProfile(payload),
                    AccountUpdateManager.getShipCarsUpdate(payload)
                ]);

                break;

            case 'Vendor':
                response = await Promise.allSettled([QB.upsertVendor(payload)]);
                break;

            default:
                return;
        }

        let update = {};
        for (const r of response)
        {
            if (r.status !== 'fulfilled')
                console.log(r.reason?.response?.data ? JSON.stringify(r.reason?.response?.data) : r.reason);
            else if (r.value != undefined)
                update = mergeDeepRight(update, r.value);

        }

        // update database
        await SFAccount.query().patch(update).where('guid', data?.guid);
    }

    static async checkAccountUpdatedQueue()
    {
        const res = await Queue.pop('accountupdated');

        if (res.status == 204)
            return;
        else
            await AccountUpdateManager.accountUpdated(res.data);
    }

    static async pushToQueue(qName, data)
    {
        if (!cache.has(data.guid || data.sfid))
        {
            cache.set((data.guid || data.sfid), true, 10);

            await Queue.push(qName, data);
        }
    }

    static async getShipCarsUpdate(payload)
    {
        if (!payload.scId)
        {
            const res = await LoadboardsFunc.getShipCarsCarrier(payload.dotNumber);

            return { scId: res.id };
        }
        else
            return {};
    }
}

module.exports = AccountUpdateManager;
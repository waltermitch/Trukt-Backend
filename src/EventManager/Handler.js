const SFAccount = require('../Models/SFAccount');
const Queue = require('../Azure/ServiceBus');
const PubSub = require('../Azure/PubSub');
const Triumph = require('../Triumph/API');
const QB = require('../QuickBooks/API');
const Super = require('../Super/API');
const NodeCache = require('node-cache');

// duplicate checking cache
const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 10 });

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
                    if (r.status !== 'fulfilled')
                        console.log(r.reason?.response?.data ? JSON.stringify(r.reason?.response?.data) : r.reason);
                }
                break;

            case 'Vendor':
                await QB.upsertVendor(payload);
                break;

            default:
                return;
        }
    }

    static async checkAccountUpdatedQueue()
    {
        const res = await Queue.pop('accountupdated');

        if (res.status == 204)
            return;
        else
            await Handler.accountUpdated(res.data);
    }

    static async pushToQueue(qName, data)
    {
        if (!cache.has(data))
        {
            cache.set(data, true, 10);

            await Queue.push(qName, data);
        }
    }
}

module.exports = Handler;
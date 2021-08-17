const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const states = require('us-state-codes');

class DAT extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'DAT';
        this.data = data;
        this.postObject = data.postObjects[this.loadboardName];
    }

    static validate(options)
    {

    }

    toJSON()
    {
        const payload = {
            freight: {
                equipmentType: this.postObject.values.equipmentType, // equipment type id as string
                fullPartial: this.postObject.values.loadType, // either FULL or PARTIAL
                comments: [
                    {
                        comment: this.postObject.values.comment1
                    },
                    {
                        comment: this.postObject.values.comment2
                    }
                ],
                lengthFeet: this.postObject.values.length, // integer good between 1 and 199
                weightPounds: this.postObject.values.weight // integer good between 1 and 999998
            },
            lane: {
                origin: {
                    city: this.data.pickup.terminal.city,
                    stateProv: this.data.pickup.terminal.state, // abbreviated state
                    postalCode: this.data.pickup.terminal.zipCode
                },
                destination: {
                    city: this.data.delivery.terminal.city,
                    stateProv: this.data.delivery.terminal.state,
                    postalCode: this.data.delivery.terminal.zipCode
                }
            },
            exposure: {
                audience: { loadBoard: { includesExtendedNetwork: this.postObject.values.extendedNetwork } },
                earliestAvailabilityWhen: this.data.pickup.dateScheduledStart,
                latestAvailabilityWhen: this.data.pickup.dateScheduledEnd,

                // endWhen - (From DAT) this is the date and time whent he posting is no longer visible to the target audience.
                // this fueld gives you the flexibility to fine tune when the posting will no longer be available, separate from the end of the pick up window.
                endWhen: this.dateAdd(this.data.pickup.dateScheduledEnd, 30, 'day'),
                preferredContactMethod: 'PRIMARY_PHONE',
                transactionDetails: {
                    loadOfferRateUsd: this.data.estimatedExpense // job.estimated_expense
                }
            }
        };

        return payload;
    }

    static async handlepost(post, response)
    {
        post.externalGuid = response.id;
        post.externalPostGuid = response.id;
        post.status = 'posted';
        post.isSynced = true;
        post.isPosted = true;
    }

    static async handleunpost(post, response)
    {
        post.externalGuid = null;
        post.externalPostGuid = null;
        post.status = 'unposted';
        post.isSynced = true;
        post.isPosted = false;
    }
}

module.exports = DAT;
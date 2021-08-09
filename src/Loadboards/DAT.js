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

    createLoad()
    {
        const payload = {
            freight: {
                equipmentType: this.postObject.values.equipmentTypeValue, // equipment type id as string
                fullPartial: this.postObject.values.loadTypeValue, // either FULL or PARTIAL
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
                audience: { includesExtendedNetwork: this.values.extendedNetwork, includesLoadBoard: true },
                earliestAvailabilityWhen: this.pickup.dateScheduledStart,
                latestAvailabilityWhen: this.pickup.dateScheduledEnd,

                // endWhen - (From DAT) this is the date and time whent he posting is no longer visible to the target audience.
                // this fueld gives you the flexibility to fine tune when the posting will no longer be available, separate from the end of the pick up window.
                endWhen: '30 days after customer end date', // this.minusMinutes(this.pickup.customerEndDate, 30),
                preferredContactMethod: 'PRIMARY_PHONE',
                transactionDetails: {
                    loadOfferRateUsd: this.data.estimatedExpense // job.estimated_expense
                }
            }
        };

        return payload;
    }
}

module.exports = DAT;
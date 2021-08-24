const Loadboard = require('./Loadboard');
const LoadboardPost = require('../Models/LoadboardPost');

const anonUser = '00000000-0000-0000-0000-000000000000';

class DAT extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'DAT';
        this.postObject = data.postObjects[this.loadboardName];
    }

    static validate(options)
    {

    }

    toJSON()
    {
        this.adjustDates();
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
                commodity: {
                    details: this.postObject.values.commodity
                },
                lengthFeet: this.postObject.values.length, // integer good between 1 and 199
                weightPounds: this.postObject.values.weight // integer good between 1 and 999998
            },
            lane: {
                origin: {
                    city: this.data.pickup.terminal.city,
                    stateProv: this.data.pickup.terminal.state,
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
                earliestAvailabilityWhen: this.data.pickup.dateRequestedStart,
                latestAvailabilityWhen: this.data.pickup.dateRequestedEnd,

                // endWhen - (From DAT) this is the date and time whent he posting is no longer visible to the target audience.
                // this fueld gives you the flexibility to fine tune when the posting will no longer be available, separate from the end of the pick up window.
                endWhen: this.minusMinutes(this.data.pickup.dateRequestedEnd, 30),
                preferredContactMethod: 'PRIMARY_PHONE',
                transactionDetails: {
                    loadOfferRateUsd: this.data.estimatedExpense
                }
            }
        };

        return payload;
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
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
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
                objectionPost.externalGuid = null;
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
            await trx.rolback();
        }

        return objectionPost;
    }
}

module.exports = DAT;
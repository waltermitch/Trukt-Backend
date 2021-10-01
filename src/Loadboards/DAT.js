const Loadboard = require('./Loadboard');
const LoadboardPost = require('../Models/LoadboardPost');
const DateTime = require('luxon').DateTime;

class DAT extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'DAT';
        this.postObject = data.postObjects[this.loadboardName];
    }

    static validate(requiredFields, values)
    {
        for (const requiredField of requiredFields)
        {
            if (!Object.keys(values).includes(requiredField))
            {
                throw `${requiredField} is required`;
            }
            else if ((
                requiredField == 'commodity' ||
                requiredField == 'comment1' ||
                requiredField == 'comment2') &&
                (values[requiredField].length < 1 ||
                    values[requiredField].length > 69))
            {
                throw `${requiredField} should be between 1 and 70 characters`;
            }
            else if (requiredField == 'weight' && (values[requiredField] < 1 || values[requiredField] > 999999))
            {
                throw `${requiredField} should be between 1 and 999999 pounds`;
            }
            else if (requiredField == 'length' && (values[requiredField] < 1 || values[requiredField] > 199))
            {
                throw `${requiredField} should be between 1 and 199 feet`;
            }
        }
    }

    toJSON()
    {
        const payload = {
            freight: {
                // equipment type id as string
                equipmentType: this.postObject.values.equipmentType,

                // either FULL or PARTIAL
                fullPartial: this.postObject.values.loadType,
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

                // integer good between 1 and 199
                lengthFeet: this.postObject.values.length,

                // integer good between 1 and 999998
                weightPounds: this.postObject.values.weight
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
                audience: {
                    loadBoard: {
                        includesExtendedNetwork: this.postObject.values.extendedNetwork,
                        transactionDetails: {
                            transactionType: 'NONBOOKABLE_OFFER_RATE',
                            loadOfferRateUsd: parseFloat(this.data?.actualExpense) || 5
                        }
                    }
                },
                earliestAvailabilityWhen: this.data.pickup.dateRequestedStart,
                latestAvailabilityWhen: this.data.pickup.dateRequestedEnd,

                // endWhen - (From DAT) this is the date and time whent he posting is no longer visible to the target audience.
                // this field gives you the flexibility to fine tune when the posting will no longer be available, separate from the end of the pick up window.
                endWhen: this.data.pickup.dateRequestedEnd,
                preferredContactMethod: 'PRIMARY_PHONE'
            },
            referenceId: this.data.number
        };

        return payload;
    }

    adjustDates(payload)
    {
        const now = DateTime.now().toUTC();

        if (payload.exposure.earliestAvailabilityWhen < now)
        {
            payload.exposure.earliestAvailabilityWhen = now;
        }

        if (payload.exposure.latestAvailabilityWhen < payload.exposure.earliestAvailabilityWhen)
        {
            payload.exposure.latestAvailabilityWhen = this.fastForward(payload.exposure.latestAvailabilityWhen, payload.exposure.earliestAvailabilityWhen);
        }

        const tempLatestAvail = payload.exposure.latestAvailabilityWhen;
        payload.exposure.endWhen = tempLatestAvail.minus({ minutes: 20 });

        return payload;
    }

    static async handlePost(payloadMetadata, response)
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
                objectionPost.externalGuid = response.id;
                objectionPost.externalPostGuid = response.id;
                objectionPost.status = 'posted';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();

            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rollback();
        }
    }

    static async handleUnpost(payloadMetadata, response)
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
                objectionPost.externalGuid = null;
                objectionPost.externalPostGuid = null;
                objectionPost.status = 'unposted';
                objectionPost.isSynced = true;
                objectionPost.isPosted = false;
            }
            objectionPost.setUpdatedBy(process.env.SYSTEM_USER);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();

            return objectionPost.jobGuid;
        }
        catch (err)
        {
            await trx.rolback();
        }
    }
}

module.exports = DAT;
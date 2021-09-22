const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const fs = require('fs');

const LoadboardPost = require('../Models/LoadboardPost');

const localPicklistPath = 'localdata/picklists.json';

const anonUser = '00000000-0000-0000-0000-000000000000';

class Truckstop extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'TRUCKSTOP';
        this.postObject = this.data.postObjects[this.loadboardName];
    }

    static async validate(postObject)
    {
        console.log('validating');
        console.log(postObject.values);
        const pickles = JSON.parse(fs.readFileSync(localPicklistPath, 'utf8'));
        console.log(pickles.loadboardData.TRUCKSTOP.equipmentOptions);
        return postObject.values;
    }

    toJSON()
    {
        this.adjustDates();
        const payload = {
            postAsUserId: this.postObject.values.contact.externalId,
            equipmentAttributes:
            {
                equipmentTypeId: this.postObject.values.equipmentType,
                equipmentOptions: this.postObject.values.equipmentOptions,
                transportationModeId: this.postObject.values.loadType
            },
            loadStops: [
                {
                    type: 1, // indicates what kind of stop this is i.e 1 = pickup, 2 = delivery
                    sequence: 1, // indicates order in stops
                    earlyDateTime: this.data.pickup.dateRequestedStart,
                    lateDateTime: this.data.pickup.dateRequestedEnd,
                    location: {
                        locationName: this.data.pickup.terminal.name,
                        city: this.data.pickup.terminal.city,
                        state: this.getStateCode(this.data.pickup.terminal.state),
                        streetAddress1: this.data.pickup.terminal.street1,
                        streetAddress2: this.data.pickup.terminal.street2,
                        countryCode: this.data.pickup.terminal?.country?.toUpperCase(),
                        postalCode: this.data.pickup.terminal.zipCode

                    },
                    contactName: this.data.pickup.primaryContact?.name,
                    contactPhone: this.data.pickup.primaryContact?.phoneNumber?.substring(0, 10),
                    stopNotes: this.data.pickup.notes
                },
                {
                    type: 2, // indicates what kind of stop this is i.e 1 = pickup, 2 = delivery
                    earlyDateTime: this.data.delivery.dateRequestedStart,
                    lateDateTime: this.data.delivery.dateRequestedEnd,
                    location: {
                        locationName: this.data.delivery.terminal.name,
                        city: this.data.delivery.terminal.city,
                        state: this.getStateCode(this.data.delivery.terminal.state),
                        streetAddress1: this.data.delivery.terminal.street1,
                        streetAddress2: this.data.delivery.terminal.street2,
                        countryCode: this.data.delivery.terminal?.country?.toUpperCase(),
                        postalCode: this.data.delivery.terminal.zipCode

                    },
                    contactName: this.data.delivery?.primaryContact?.name,
                    contactPhone: this.data.delivery?.primaryContact?.phoneNumber?.substring(0, 10),
                    stopNotes: this.data.delivery.notes
                }
            ],
            note: this.postObject.instructions || this.data.loadboardInstructions,
            freightClassId: 1,
            loadNumber: this.data.number,
            rateAttributes: { postedAllInRate: { amount: currency(this.data.actualExpense).value } },
            dimensional: {
                length: this.postObject.values.length,
                weight: this.postObject.values.weight,
                width: 1,
                height: 1,
                cube: 1
            },
            loadActionAttributes: { loadActionId: '4' },
            loadLabel: this.data.number,
            loadReferenceNumbers: [],
            termsAndConditions: { id: null }
        };

        return payload;
    }

    static async handlePost(payloadMetadata, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(payloadMetadata.post);
        try
        {
            if (response.hasErrors !== undefined)
            {
                objectionPost.status = 'fresh';
                objectionPost.isSynced = false;
                objectionPost.hasError = true;
                objectionPost.apiError = response.errors;
            }
            else
            {
                objectionPost.externalGuid = response.loadId;
                objectionPost.externalPostGuid = response.loadId;
                objectionPost.status = 'posted';
                objectionPost.isCreated = true;
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
                objectionPost.hasError = false;
                objectionPost.apiError = null;

            }
            objectionPost.setUpdatedBy(anonUser);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();
        }
        catch (err)
        {
            console.log(err);
            await trx.rollback();
        }

        return objectionPost;
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
            objectionPost.setUpdatedBy(anonUser);

            await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.guid);
            await trx.commit();
        }
        catch (err)
        {
            await trx.rollback();
        }

        return objectionPost;
    }

}

module.exports = Truckstop;
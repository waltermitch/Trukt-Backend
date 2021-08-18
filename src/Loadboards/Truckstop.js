const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const states = require('us-state-codes');
const fs = require('fs');

const localPicklistPath = 'localdata/picklists.json';

class Truckstop extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'TRUCKSTOP';
        this.data = data;
        this.postObject = this.data.postObjects[this.loadboardName];

        // this.valid = this.validate(data.postObjects[this.loadboardName]);
    }

    static async validate(postObject)
    {
        console.log('validating');
        console.log(postObject.values);
        const pickles = JSON.parse(fs.readFileSync(localPicklistPath, 'utf8'));
        console.log(pickles.loadboardData.TRUCKSTOP.equipmentOptions);
        return postObject.values;
    }

    /* eslint-disable */
    toJSON()
    {
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
                    earlyDateTime: this.data.pickup.dateScheduledStart,
                    lateDateTime: this.data.pickup.dateScheduledEnd,
                    location: {
                        locationName: this.data.pickup.terminal.name,
                        city: this.data.pickup.terminal.city,
                        state: this.data.pickup.terminal.state.length > 2 ? states.getStateCodeByStateName(this.data.pickup.terminal.state) : this.data.pickup.terminal.state, //states.getStateCodeByStateName(this.data.pickup.terminal.state), // must be two letter abbreviation
                        streetAddress1: this.data.pickup.terminal.street1,
                        streetAddress2: this.data.pickup.terminal.street2,
                        countryCode: this.data.pickup.terminal?.country.toUpperCase(),
                        postalCode: this.data.pickup.terminal.zipCode

                    },
                    contactName: this.data.pickup.primaryContact.name,
                    contactPhone: this.data.pickup.primaryContact?.phoneNumber.substring(0, 10),
                    stopNotes: this.data.pickup.notes
                },
                {
                    type: 2, // indicates what kind of stop this is i.e 1 = pickup, 2 = delivery
                    earlyDateTime: this.data.delivery.dateScheduledStart,
                    lateDateTime: this.data.delivery.dateScheduledEnd,
                    location: {
                        locationName: this.data.delivery.terminal.name,
                        city: this.data.delivery.terminal.city,
                        state: this.data.delivery.terminal.state.length > 2 ? states.getStateCodeByStateName(this.data.delivery.terminal.state) : this.data.delivery.terminal.state, //states.getStateCodeByStateName(this.data.delivery.terminal.state), // must be two letter abbreviation
                        streetAddress1: this.data.delivery.terminal.street1,
                        streetAddress2: this.data.delivery.terminal.street2,
                        countryCode: this.data.delivery.terminal?.country.toUpperCase(),
                        postalCode: this.data.delivery.terminal.zipCode

                    },
                    contactName: this.data.delivery.primaryContact.name,
                    contactPhone: this.data.delivery.primaryContact?.phoneNumber.substring(0, 10),
                    stopNotes: this.data.delivery.notes
                }
            ],
            note: this.postObject.instructions || this.data.loadboardInstructions,
            freightClassId: 1,
            loadNumber: this.data.number,
            rateAttributes: { postedAllInRate: { amount: currency(this.data.estimatedExpense).value } },
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

    fastForwardExpired(date, forwardAmount)
    {
        //get current date
        const now = DateTime.utc().toString();

        //if forward amount not provided return now
        if (date < now && forwardAmount === undefined)
            return now;
        //if date is behind fast forward
        else if (date < now)
            return DateTime.fromISO(date).plus({ days: forwardAmount }).toString();
        //if not expired return date;
        else
            return date;
    }

    static async handlepost(post, response)
    {
        const trx = await LoadboardPost.startTransaction();
        const objectionPost = LoadboardPost.fromJson(post);
        try
        {
            if (response.hasErrors !== undefined)
            {
                objectionPost.status = 'fresh';
                objectionPost.hasError = true;
                objectionPost.apiError = response.errors;
            } else
            {
                objectionPost.externalGuid = response.loadId;
                objectionPost.externalPostGuid = response.loadId;
                objectionPost.status = 'posted';
                objectionPost.isSynced = true;
                objectionPost.isPosted = true;
                objectionPost.hasError = false;
                objectionPost.apiError = null;

                await LoadboardPost.query(trx).patch(objectionPost).findById(objectionPost.id);
                await trx.commit();
            }
        } catch (err)
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
            objectionPost.externalGuid = null;
            objectionPost.externalPostGuid = null;
            objectionPost.status = 'unposted';
            objectionPost.isSynced = true;
            objectionPost.isPosted = false;

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

module.exports = Truckstop;
const Loadboard = require('./Loadboard');
const currency = require('currency.js');
const { DateTime } = require('luxon');
const { ValidationError } = require('../ErrorHandling/Exceptions');

class Truckstop extends Loadboard
{
    constructor(data)
    {
        super(data);
        this.loadboardName = 'TRUCKSTOP';
        this.postObject = this.data.postObjects[this.loadboardName];
    }

    static validate(requiredFields, values)
    {
        for (const requiredField of requiredFields)
        {
            if (!Object.keys(values).includes(requiredField))
            {
                throw new ValidationError(`${requiredField} is required`);
            }
            else if (requiredField == 'weight' && (values[requiredField] < 1 || values[requiredField] > 999999))
            {
                throw new ValidationError(`${requiredField} should be between 1 and 999999 pounds`);
            }
            else if (requiredField == 'length' && (values[requiredField] < 1 || values[requiredField] > 999))
            {
                throw new ValidationError(`${requiredField} should be between 1 and 999 feet`);
            }
            else if (requiredField == 'equipmentOptions' && !Array.isArray(values[requiredField]))
            {
                throw new ValidationError(`${requiredField} should be array of truckstop valid equipment option ids`);
            }
        }
    }

    toJSON()
    {
        if (this.data.pickup.notes.length > 250 || this.data.delivery.notes.length > 250)
        {
            throw new ValidationError('First pickup and last delivery stop notes must be less than 250 characters');
        }
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
                    // indicates what kind of stop this is i.e 1 = pickup, 2 = delivery
                    type: 1,

                    // indicates order in stops
                    sequence: 1,
                    earlyDateTime: this.data.pickup.dateRequestedStart ?? DateTime.now().toUTC(),
                    lateDateTime: this.data.pickup.dateRequestedEnd,
                    location: {
                        locationName: this.data.pickup.terminal.name,
                        city: this.data.pickup.terminal.city,
                        state: this.data.pickup.terminal.state,
                        streetAddress1: this.data.pickup.terminal.street1,
                        streetAddress2: this.data.pickup.terminal.street2,
                        countryCode: this.data.pickup.terminal?.country?.toUpperCase(),
                        postalCode: this.data.pickup.terminal.zipCode

                    },
                    contactName: this.data.pickup.primaryContact?.name || null,
                    contactPhone: this.data.pickup.primaryContact?.phoneNumber?.replace(/[^\d]/g, '').substring(0, 10) || null,
                    stopNotes: this.data.pickup.notes
                },
                {
                    // indicates what kind of stop this is i.e 1 = pickup, 2 = delivery
                    type: 2,
                    sequence: 2,
                    earlyDateTime: this.data.delivery.dateRequestedStart ?? DateTime.now().toUTC(),
                    lateDateTime: this.data.delivery.dateRequestedEnd,
                    location: {
                        locationName: this.data.delivery.terminal.name,
                        city: this.data.delivery.terminal.city,
                        state: this.data.delivery.terminal.state,
                        streetAddress1: this.data.delivery.terminal.street1,
                        streetAddress2: this.data.delivery.terminal.street2,
                        countryCode: this.data.delivery.terminal?.country?.toUpperCase(),
                        postalCode: this.data.delivery.terminal.zipCode

                    },
                    contactName: this.data.delivery?.primaryContact?.name || null,
                    contactPhone: this.data.delivery?.primaryContact?.phoneNumber?.replace(/[^\d]/g, '').substring(0, 10) || null,
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

    adjustDates(payload)
    {
        const now = DateTime.now().toUTC();

        if (payload.loadStops[0].earlyDateTime < now)
        {
            payload.loadStops[0].earlyDateTime = now;
        }

        if (payload.loadStops[0].lateDateTime < payload.loadStops[0].earlyDateTime)
        {
            payload.loadStops[0].lateDateTime = this.fastForward(payload.loadStops[0].lateDateTime, payload.loadStops[0].earlyDateTime);
        }

        if (payload.loadStops[1].earlyDateTime < payload.loadStops[0].lateDateTime)
        {
            payload.loadStops[1].earlyDateTime = this.fastForward(payload.loadStops[1].earlyDateTime, payload.loadStops[0].lateDateTime);
        }

        if (payload.loadStops[1].lateDateTime < payload.loadStops[1].earlyDateTime)
        {
            payload.loadStops[1].lateDateTime = this.fastForward(payload.loadStops[1].lateDateTime, payload.loadStops[1].earlyDateTime);
        }

        return payload;
    }
}

module.exports = Truckstop;
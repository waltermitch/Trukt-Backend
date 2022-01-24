const { DateTime } = require('luxon');

/**
 * The payload sent to the Logic App that handles mapping to EDI file
 * {
        "order": {
            "guid" : "cf55abe5-7287-4fc4-a7d3-17c64cbc0b99",
            "number" : "RC10000"
        },
        "partner": "0017A00000eFQBTQA4",
        "reference": "1402786",
        "sla" : "free response",
        "datetime": "2021-09-16T09:26:16.731+00:00", // ISO standard datetime string
        "location": {
            "city": "Jenkinsburg",
            "state": "GA",
            "country": "US",
            "latitude": null,
            "longitude": null
        },
        "status": {
            "type": "status",
            "code": "X1",
            "reason": "NS"
        },
        "commodities" : { Commodity } // this is model
        "edi" : { object } // edi document attached to the order
    }
 */

class EDI214Payload
{
    constructor()
    {
        this.order;
        this.partner;
        this.reference;
        this.datetime;
        this.location;
        this.status = {};
    }

    /**
     * @description Add the Order information to the payload
     * @param {Order} order
     */
    addOrder(order)
    {
        this.order = {
            guid: order.guid,
            number: order.number
        };
        this.reference = order.referenceNumber;
    }

    /**
     * @description Add the EDI partner to the payload.
     * @param {SFAccount} sfAccount
     */
    addPartner(sfAccount)
    {
        this.partner = sfAccount.sfId;
        this.sla = sfAccount.slaDays + ' days';
    }

    /**
     * @description Add the Location to the payload. The information is not identical to the Terminal
     * @param {Terminal} terminal
     */
    addLocation(terminal)
    {
        this.location = {
            city: terminal.city,
            state: terminal.state,
            country: terminal.country || 'US',
            latitude: terminal.latitude || '',
            longitude: terminal.longitude || ''
        };

    }

    addStatus(status)
    {
        this.status.code = status;
        this.status.type = 'status';
    }

    addAppointment(status)
    {
        this.status.code = status;
        this.status.type = 'appointment';
    }

    addReason(reason)
    {
        this.status.reason = reason;
    }

    /**
     * @description Include the EDI data that was sent over back to create proper document
     * @param {EDIData} ediData
     */
    addEDIData(ediData)
    {
        this.edi = ediData.data;
    }

    /**
     *
     * @param {8601 Datetime string} datetime
     */
    addDatetime(datetime)
    {
        let datetimeObj;
        if (typeof datetime === 'string')
        {
            datetimeObj = DateTime.fromISO(datetime);
        }
        else if (datetime == undefined)
        {
            datetimeObj = DateTime.now();
        }

        this.datetime = datetimeObj.toUTC().toISO();
    }

    /**
     * @param {Commodity[]} comms
     */
    addCommodities(comms)
    {
        this.commodities = comms;
    }

    toJson()
    {
        return Object.assign({}, this);
    }
}

module.exports = EDI214Payload;

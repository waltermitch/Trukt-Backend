const EDIPayload = require('./EDIPayload');
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

class EDI214Payload extends EDIPayload
{
    constructor()
    {
        super();
        this.datetime;
        this.location;
        this.pickupStop;
        this.status = {};
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
     *
     * @param {8601 Datetime string} datetime
     */
    addDatetime(datetime)
    {
        let datetimeObj = datetime;
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

    /**
     *
     * @param {OrderStop} stop
     */
    addPickupStop(stop)
    {
        this.pickupStop = stop;
    }

    toJson()
    {
        return Object.assign({}, this);
    }
}

module.exports = EDI214Payload;

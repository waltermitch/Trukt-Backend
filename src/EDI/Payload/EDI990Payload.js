const EDIPayload = require('./EDIPayload');
const { DateTime } = require('luxon');
const { ValidationError } = require('../../ErrorHandling/Exceptions');

class EDI990Payload extends EDIPayload
{
    constructor()
    {
        super();

        this.action;
        this.date;
        this.scac = 'RCGQ';
        this.reason;
    }

    /**
     *
     * @param {('accept' | 'reject')} action
     * @returns {EDIPayload}
     */
    addAction(action)
    {
        if (action != 'accept' && action != 'reject')
        {
            throw new ValidationError(`Invalid action assigned to EDI990Payload: ${action}`);
        }
        this.action = action;
        return this;
    }

    /**
     *
     * @param {8601 Datetime string} datetime
     */
    addDatetime(datetime)
    {
        let datetimeObj = datetime;
        if (typeof datetime == 'string')
        {
            datetimeObj = DateTime.fromISO(datetime);
        }
        else if (datetime == undefined)
        {
            datetimeObj = DateTime.now();
        }
        this.date = datetimeObj.toUTC().toISO();
        return this;
    }

    addSCAC(scac)
    {
        this.scac = scac;
        return this;
    }

    addReason(reason)
    {
        this.reason = reason;
        return this;
    }
}

module.exports = EDI990Payload;
const LoadboardPost = require('../Models/LoadboardPost');
const DateTime = require('luxon').DateTime;
const states = require('us-state-codes');
const R = require('ramda');

const anonUser = '00000000-0000-0000-0000-000000000000';
const returnTo = process.env['azure.servicebus.loadboards.subscription.to'];
const loadboardName = '';

class Loadboard
{
    constructor(data)
    {
        this.data = R.clone(data);
    }

    static validate() { }

    create()
    {
        let payload = {};
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName, jobNumber: this.data.number };
        payloadMetadata.action = 'create';
        payloadMetadata.user = returnTo;
        payload = this.toJSON();

        return { payload, payloadMetadata };
    }

    post()
    {
        let payload = {};
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName, jobNumber: this.data.number };
        payloadMetadata.action = 'post';
        payloadMetadata.user = returnTo;
        payload = this.toJSON();

        return { payload, payloadMetadata };
    }

    unpost()
    {
        const payload = { guid: this.postObject.externalPostGuid };
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = 'unpost';
        payloadMetadata.user = returnTo;

        return { payload, payloadMetadata };
    }

    update()
    {
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = ['update'];
        payloadMetadata.user = returnTo;

        return { payload: this.toJSON(), payloadMetadata };
    }

    dispatch()
    {
        const payloadMetadata = { post: this.postObject, dispatch: this.data.dispatch, loadboard: this.loadboardName };
        const payload = {};

        // send the order payload because the load may not exist in the loadboard
        // or it needs to be updated after dispatching
        payload.order = this.toJSON();
        payload.dispatch = this.dispatchJSON();
        payloadMetadata.action = 'dispatch';
        payloadMetadata.user = returnTo;
        return { payload, payloadMetadata };
    }

    undispatch()
    {
        const payloadMetadata = { post: this.postObject, dispatch: this.data.dispatch, loadboard: this.loadboardName };
        const payload = {};

        // sending the order because ship cars archives orders that are canceled
        // so they will need to be recreated
        payload.order = this.toJSON();
        payload.dispatch = { externalLoadGuid: this.postObject.externalGuid, externalDispatchGuid: this.data.dispatch.externalGuid };
        payloadMetadata.action = 'undispatch';
        payloadMetadata.user = returnTo;
        return { payload, payloadMetadata };
    }

    toStringDate(input)
    {
        const date = DateTime.fromJSDate(input).c;
        return input ? date.year + '-' + date.month + '-' + date.day : null;
    }

    saltOrderNumber(orderNumber)
    {
        // adding salt with ms to prevent duplicate name error
        return `${orderNumber}#${this.getMilliSeconds().substr(4, 12)}`;
    }

    getMilliSeconds()
    {
        return DateTime.utc().toMillis().toString();
    }

    toDate(input)
    {
        return input ? input.substr(0, 10) : null;
    }

    dateAdd(date, amount, type)
    {
        return date ? DateTime.fromJSDate(date).plus({ [`${type}`]: amount }).toString() : null;
    }

    minusMinutes(date, amount)
    {
        return DateTime.fromJSDate(date).minus({ minutes: amount }).toUTC().toString();
    }

    adjustDates()
    {
        const now = new Date(Date.now());

        if (this.data.pickup.dateRequestedStart < now)
        {
            this.data.pickup.dateRequestedStart = now;
        }

        if (this.data.pickup.dateRequestedEnd < this.data.pickup.dateRequestedStart)
        {
            this.data.pickup.dateRequestedEnd = this.fastForward(this.data.pickup.dateRequestedEnd, this.data.pickup.dateRequestedStart);
        }

        if (this.data.delivery.dateRequestedStart < this.data.pickup.dateRequestedEnd)
        {
            this.data.delivery.dateRequestedStart = this.fastForward(this.data.delivery.dateRequestedStart, this.data.pickup.dateRequestedEnd);
        }

        if (this.data.delivery.dateRequestedEnd < this.data.delivery.dateRequestedStart)
        {
            this.data.delivery.dateRequestedEnd = this.fastForward(this.data.delivery.dateRequestedEnd, this.data.delivery.dateRequestedStart);
        }
    }

    getDifferencefromToday(date)
    {
        // get difference between the date and today.. today - date.. (future date would be negative)
        const diff = DateTime.utc().diff(DateTime.fromJSDate(date), ['days']);

        // return the float
        return diff.toObject().days;
    }

    fastForward(targetDate, secondDate)
    {
        targetDate = DateTime.fromJSDate(targetDate);
        secondDate = DateTime.fromJSDate(secondDate);
        targetDate = secondDate.plus({ hours: 1 });
        return targetDate.toJSDate();
    }

    getStateCode(state)
    {
        return states.getStateCodeByStateName(state) == null ? states.sanitizeStateCode(state) : states.getStateCodeByStateName(state);
    }

    static async handlecreate(post, response)
    {
        return LoadboardPost.fromJson(post);
    }
}

module.exports = Loadboard;

const DateTime = require('luxon').DateTime;
const currency = require('currency.js');
const states = require('us-state-codes');
const R = require('ramda');

const loadboardName = '';

class Loadboard
{
    constructor(data)
    {
        this.data = R.clone(data);
    }

    static validate() { }

    post()
    {
        let payload = {};
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName, jobNumber: this.data.number };
        payloadMetadata.action = 'post';
        payloadMetadata.user = process.env['developerName'];
        payload = this.toJSON();

        return { payload, payloadMetadata };
    }

    unpost()
    {
        const payload = { guid: this.postObject.externalPostGuid };
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = 'unpost';
        payloadMetadata.user = process.env['developerName'];

        return { payload, payloadMetadata };
    }

    update()
    {
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = ['update'];
        payloadMetadata.user = process.env['developerName'];

        return { payload: this.toJSON(), payloadMetadata };
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
}

module.exports = Loadboard;

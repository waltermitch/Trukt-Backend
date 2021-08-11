const DateTime = require('luxon').DateTime;
const currency = require('currency.js');
const states = require('us-state-codes');

const loadboardName = '';

class Loadboard
{
    constructor(data)
    {
        this.data = data;
        this.needsCreation = false;
        this.postObject;
    }

    static validate() { }

    post()
    {
        let payload = {};
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        if (this.needsCreation && !this.postObject?.externalGuid)
        {
            // console.log(this.loadboardName, ' needs to be created first');
            // payload = this.toJSON();
            payloadMetadata.action = ['create', 'post'];
        }
        else if (this.needsCreation && this.postObject?.externalGuid)
        {
            // console.log(this.loadboardName, ' has post already, posting with existing guid');
            // payload = { guid: this.postObject?.externalGuid };
            // payload = this.toJSON();
            payloadMetadata.action = ['post'];
        }
        else if (!this.needsCreation && !this.postObject?.externalGuid)
        {
            // console.log(this.loadboardName, ' does not need creation, posting directly');
            // payload = this.toJSON();
            payloadMetadata.action = ['post'];
        }
        payload = this.toJSON();
        return { payload, payloadMetadata };

        // return { payload, payloadMetadata };
    }

    unpost()
    {
        const payload = { guid: this.postObject.externalPostGuid };
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = ['unpost'];
        return { payload, payloadMetadata };
    }

    update()
    {
        const payloadMetadata = { post: this.postObject, loadboard: this.loadboardName };
        payloadMetadata.action = ['update'];
        return { payload: this.toJSON(), payloadMetadata };
    }

    toStringDate(input)
    {
        const date = DateTime.fromJSDate(input).c;
        return input ? date.year + '-' + date.month + '-' + date.day : null;
    }

    saltOrderNumber()
    {
        // adding salt with ms to prevent duplicate name error
        this.data.number = `${this.data.number}#${this.getMilliSeconds().substr(4, 12)}`;
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

class EDIPayload
{
    constructor()
    {
        this.order;
        this.partner;
        this.reference;
        this.edi;
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
        return this;
    }

    /**
     * @description Add the EDI partner to the payload.
     * @param {SFAccount} sfAccount
     */
    addPartner(sfAccount)
    {
        this.partner = sfAccount.sfId;
        this.sla = sfAccount.slaDays + ' days';
        return this;
    }

    /**
     * @description Include the EDI data that was sent over back to create proper document
     * @param {EDIData} ediData
     */
    addEDIData(ediData)
    {
        this.edi = ediData.data;
        return this;
    }
}

module.exports = EDIPayload;
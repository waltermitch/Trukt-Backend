class Client
{
    constructor(data)
    {
        this.address = data.billingStreet;
        this.business_type = data.businessType;
        this.city = data.billingCity;
        this.custom_external_id = data.sfId;
        this.email = data.email;
        this.fax = data.fax;
        this.internal_notes = data.internalNotes;
        this.loadboard_instructions = data.loadboardInstructions;
        this.name = data.name;
        this.notes = data.notes;
        this.order_instructions = data.orderInstructions;
        this.personal_page_url = data?.website;
        this.phone = data.phone;
        this.state = data.billingState;
        this.zip = data.billingPostalCode;
    }
}

module.exports = Client;
const ContactSelectors = require('./ContactSelector');

class AccountSelectors
{
    constructor()
    {
        this.select = [];
        this.searchIn = [];
    }

    joinSelectors()
    {
        return this.select.join(', ');
    }

    withContacts()
    {
        const contactsSelector = new ContactSelectors().withFirstName().withLastName().withPhone().withGUID();

        this.select.push(` (select coalesce(json_agg(contacts), '[]'::json) as contacts from
                    (select ${contactsSelector.joinSelectors()}
                    from salesforce.contact c where a.sfid = c.accountid)
                    as contacts) `);

        return this;
    }

    withReferralAmount()
    {
        this.select.push('referral_amount__c as "referralAmount"');

        return this;
    }

    withName()
    {
        this.select.push('name');

        return this;
    }

    withEmail()
    {
        this.select.push('email__c as email');

        return this;
    }

    withPhone()
    {
        this.select.push('phone');

        return this;
    }

    withGUID()
    {
        this.select.push('guid__c as GUID');

        return this;
    }

    withOrderInstructions()
    {
        this.select.push('order_instructions__c as "orderInstructions"');

        return this;
    }

    withLoadboardInstructions()
    {
        this.select.push('loadboard_instructions__c as "loadboardInstructions"');

        return this;
    }

    withAddress(type)
    {
        type = type.toLowerCase();

        this.select.push(
            `${type}street as "${type}Street"`,
            `${type}city as "${type}City"`,
            `${type}state as "${type}State"`,
            `${type}postalcode as "${type}PostalCode"`
        );

        return this;
    }

    withDOTNumber()
    {
        this.select.push('dot_number__c as "dotNumber"');

        return this;
    }

    inDOTNumber()
    {
        this.searchIn.push('dot_number__c');

        return this;
    }

    inName()
    {
        this.searchIn.push('name');

        return this;
    }

    inAddress(type)
    {
        type = type.toLowerCase();

        this.searchIn.push(
            `${type}street`,
            `${type}city`,
            `${type}state`,
            `${type}postalcode`
        );

        return this;
    }

    static likeOnNColumns(value, columns)
    {
        const search = [];
        for (let i = 0; i < columns.length; i++)
            search.push(`${columns[i]} ilike '%${value}%'`);

        return search.join(' or ');
    }
}

module.exports = AccountSelectors;
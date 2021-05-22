class ContactSelectors
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

    withFirstName()
    {
        this.select.push('firstname as "firstName"');

        return this;
    }

    withLastName()
    {
        this.select.push('lastname as "lastName"');

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
}

module.exports = ContactSelectors;
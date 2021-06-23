const SalesforceModel = require('./Salesforce');

class SFContact extends SalesforceModel
{
    static get tableName()
    {
        return 'salesforce.contact';
    }

    static get idColumn()
    {
        return 'guid__c';
    }

    static get relationMappings()
    {
        return {
            'account': {
                relation: SalesforceModel.BelongsToOneRelation,
                modelClass: require('./SFAccount'),
                join: {
                    from: 'salesforce.contact.accountid',
                    to: 'salesforce.account.sfid'
                }
            }
        };
    }

    // keys are external field names, values are internal field names
    static mappingFromExternal = {
        accountId: 'accountid',
        accountingContact: 'accountingContactC',
        assistantName: 'assistantname',
        assistantphone: 'assistantphone',
        birthDate: 'birthdate',
        createdDate: 'createddate',
        department: 'department',
        description: 'description',
        email: 'email',
        emailBouncedDate: 'emailbounceddate',
        emailBouncedReason: 'emailbouncedreason',
        fax: 'fax',
        firstName: 'firstname',
        guid: 'guidC',
        homePhone: 'homephone',
        id: 'id',
        individualId: 'individualid',
        isDeleted: 'isdeleted',
        isEmailBounced: 'isemailbounced',
        isPersonAccount: 'ispersonaccount',
        lastName: 'lastname',
        leadSource: 'leadsource',
        lkqTrainingItems: 'lkqTrainingItemsC',
        mailingCity: 'mailingcity',
        mailingCountry: 'mailingcountry',
        mailingGeocodeAccuracy: 'mailinggeocodeaccuracy',
        mailingLatitude: 'mailinglatitude',
        mailingLongitude: 'mailinglongitude',
        mailingPostalCode: 'mailingpostalcode',
        mailingState: 'mailingstate',
        mailingStreet: 'mailingstreet',
        mobilePhone: 'mobilephone',
        name: 'name',
        otherCity: 'othercity',
        otherCountry: 'othercountry',
        otherGeocodeAccuracy: 'othergeocodeaccuracy',
        otherLatitude: 'otherlatitude',
        otherLongitude: 'otherlongitude',
        otherPhone: 'otherphone',
        otherPostalcode: 'otherpostalcode',
        otherState: 'otherstate',
        otherStreet: 'otherstreet',
        phone: 'phone',
        photoUrl: 'photourl',
        primaryContact: 'primaryContactC',
        recordTypeId: 'recordtypeid',
        salutation: 'salutation',
        sdGuid: 'sdGuidC',
        secondaryContact: 'secondaryContactC',
        sfid: 'sfid',
        title: 'title',
        trainer: 'trainerC',
        trainingDate: 'trainingDateC',
        trainingItems: 'trainingItemsC'
    }

    static fieldsToHideFromDatabase = [
        '_HcErr',
        '_HcLastop',
        'accountingContactC',
        'assistantname',
        'assistantphone',
        'birthdate',
        'createddate',
        'department',
        'description',
        'emailbounceddate',
        'emailbouncedreason',
        'id',
        'individualid',
        'isemailbounced',
        'ispersonaccount',
        'leadsource',
        'lkqTrainingItemsC',
        'mailingcity',
        'mailingcountry',
        'mailinggeocodeaccuracy',
        'mailinglatitude',
        'mailinglongitude',
        'mailingpostalcode',
        'mailingstate',
        'mailingstreet',
        'mobilephone',
        'othercity',
        'othercountry',
        'othergeocodeaccuracy',
        'otherlatitude',
        'otherlongitude',
        'otherphone',
        'otherpostalcode',
        'otherstate',
        'otherstreet',
        'photourl',
        'primaryContactC',
        'salutation',
        'sdGuidC',
        'secondaryContactC',
        'systemmodstamp',
        'title',
        'trainerC',
        'trainingDateC',
        'trainingItemsC',
    ]

    static fieldsToHideFromExternal = [
        'sfid',
        'accountId',
        'isDeleted',
        'recordTypeId',
        'homePhone'
    ]
}

module.exports = SFContact;
const SalesforceModel = require('./Salesforce');

class SFAccount extends SalesforceModel
{
    static get tableName()
    {
        return 'salesforce.account';
    }

    static get idColumn()
    {
        return 'guid__c';
    }

    static get relationMappings()
    {
        const SFContact = require('./SFContact');
        return {
            contacts: {
                relation: SalesforceModel.HasManyRelation,
                modelClass: SFContact,
                join: {
                    from: 'salesforce.account.sfid',
                    to: 'salesforce.contact.accountid'
                }
            },
            primaryContact: {
                relation: SalesforceModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'salesforce.account.primary_contact__c',
                    to: 'salesforce.contact.sfid'
                }
            },
            rectype: {
                relation: SalesforceModel.HasOneRelation,
                modelClass: require('./RecordType'),
                join: {
                    from: 'salesforce.account.recordtypeid',
                    to: 'salesforce.recordtype.sfid',
                }
            }
        };
    }

    // eslint-disable-next-line
    static modifiers = {
        byType(query, type)
        {
            query.select('rectype.name as rtype', 'salesforce.account.*').leftJoinRelated('rectype').where('rectype.name', 'ilike', type);
        }
    }

    /**
     * this is to send the object to external source
     */
    $formatJson(json)
    {
        json = super.$formatJson(json);
        // based on rtype
        if ('rtype' in json)
        {
            const rtype = json.rtype.toLowerCase();
            switch (rtype)
            {
                case 'client':
                    delete json.dotNumber;
                    delete json.referralAmount;

                    break;
                case 'carrier':
                    delete json.loadboardInstructions;
                    delete json.orderInstructions;

                    break;
                case 'referrer':
                    delete json.dotNumber;
                    for (const field of ['Street', 'State', 'PostalCode', 'Longitude', 'Latitude', 'GeocodeAccuracy', 'Country', 'City'])
                    {
                        for (const type of ['billing', 'shipping'])
                        {
                            delete json[type + field];
                        }
                    }
                    delete json.orderInstructions;
                    delete json.loadboardInstructions;
                    break;
            }
            delete json.rtype;
        }
        return json;
    }

    /**
     * this is making object from external source
     */
    $parseJson(json, opt)
    {
        json = super.$parseJson(json, opt);

        return json;
    }

    /**
     * this is making model from database
     */
    $parseDatabaseJson(json)
    {
        json = super.$parseDatabaseJson(json);

        return json;
    }


    // keys are external field names, values are internal field names
    static mappingFromExternal = {
        vendorType: 'vendorTypeC',
        usesFactoringCompany: 'usesFactoringCompanyC',
        userRole: 'userRoleC',
        upsellOpportunity: 'upsellOpportunityC',
        truckstopUsername: 'truckstopUsernameC',
        trainingItems: 'trainingItemsC',
        trainingDate: 'trainingDateC',
        trainer: 'trainerC',
        trainee: 'traineeC',
        track1099: 'track1099C',
        taxId: 'taxIdC',
        suite: 'suiteC',
        subIndustry: 'subIndustryC',
        status: 'statusC',
        slaSerialNumber: 'slaSerialNumberC',
        slaExpirationDate: 'slaExpirationDateC',
        slaDays: 'slaDaysC',
        sla: 'slaC',
        shippingStreet: 'shippingstreet',
        shippingState: 'shippingstate',
        shippingPostalCode: 'shippingpostalcode',
        shippingLongitude: 'shippinglongitude',
        shippingLatitude: 'shippinglatitude',
        shippingGeocodeAccuracy: 'shippinggeocodeaccuracy',
        shippingCountry: 'shippingcountry',
        shippingCity: 'shippingcity',
        searchAddress: 'searchAddressC',
        sdGuidP: 'sdGuidPc',
        salesAccountManager: 'salesAccountManagerC',
        requiresattention: 'requiresattentionC',
        referralCode: 'referralCodeC',
        referralAmount: 'referralAmountC',
        qbId: 'qbIdC',
        primaryContactP: 'primaryContactPc',
        primaryContactId: 'primaryContactC',
        preferred: 'preferredC',
        portfolioCode: 'portfolioCodeC',
        pickupNotes: 'pickupNotesC',
        pendingCancellationDate: 'pendingCancellationDateC',
        paymentTerms: 'paymentTermsC',
        paymentMethod: 'paymentMethodC',
        orderInstructions: 'orderInstructionsC',
        operationsEmail: 'operationsEmailC',
        numberOfLocations: 'numberOfLocationsC',
        notes: 'notesC',
        mcNumber: 'mcNumberC',
        masterrecordGuid: 'masterrecordGuidC',
        loadboardInstructions: 'loadboardInstructionsC',
        lkqTrainingItemsP: 'lkqTrainingItemsPc',
        liabilityInsuranceExpiration: 'liabilityInsuranceExpirationC',
        lastName: 'lastname',
        jobTitle: 'jobTitleC',
        isDeleted: 'isdeleted',
        internalNotes: 'internalNotesC',
        insuranceOnFile: 'insuranceOnFileC',
        insuranceExpiration: 'insuranceExpirationC',
        inactive: 'inactiveC',
        icpMultiplier: 'icpMultiplierC',
        icpGp: 'icpGpC',
        icpEligible: 'icpEligibleC',
        guid: 'guidC',
        freePhone: 'freePhoneC',
        fraudIdentityTheftStatus: 'fraudIdentityTheftStatusC',
        flagHistory: 'flagHistoryC',
        flag: 'flagC',
        firstName: 'firstname',
        factoringCompany: 'factoringCompanyC',
        emergencyPhone: 'emergencyPhoneC',
        email: 'emailC',
        dotNumberStatus: 'dotNumberStatusC',
        dotNumber: 'dotNumberC',
        deliveryNotes: 'deliveryNotesC',
        dbaName: 'dbaNameC',
        datUsername: 'datUsernameC',
        customerPriority: 'customerPriorityC',
        customerInQbo: 'customerInQboC',
        creditLimitAmount: 'creditLimitAmountC',
        counterpartyGuid: 'counterpartyGuidC',
        contractauthority: 'contractauthorityC',
        commonauthority: 'commonauthorityC',
        coiRequestDate: 'coiRequestDateC',
        clientAccountManager: 'clientAccountManagerC',
        certificateHolder: 'certificateHolderC',
        cellPhone: 'cellPhoneC',
        carrierType: 'carrierTypeC',
        cargoInsuranceExpiration: 'cargoInsuranceExpirationC',
        businessType: 'businessTypeC',
        brokerauthority: 'brokerauthorityC',
        blacklist: 'blacklistC',
        billingStreet: 'billingstreet',
        billingState: 'billingstate',
        billingPostalCode: 'billingpostalcode',
        billingLongitude: 'billinglongitude',
        billingLatitude: 'billinglatitude',
        billingGeocodeAccuracy: 'billinggeocodeaccuracy',
        billingCountry: 'billingcountry',
        billingCity: 'billingcity',
        bankRoutingNumber: 'bankRoutingNumberC',
        bankAccountType: 'bankAccountTypeC',
        bankAccountNumber: 'bankAccountNumberC',
        bankAccountName: 'bankAccountNameC',
        azureId: 'azureIdC',
        autoimsClientId: 'autoimsClientIdC',
        autoInsuranceExpiration: 'autoInsuranceExpirationC',
        auctionId: 'auctionIdC',
        active: 'activeC',
        accountNameDuplicate: 'accountNameDuplicateC',
    }

    static fieldsToHideFromDatabase = [
        '_HcErr',
        '_HcLastop',
        'accountNameDuplicateC',
        'accountnumber',
        'accountsource',
        'activeC',
        'auctionIdC',
        'autoimsClientIdC',
        'autoInsuranceExpirationC',
        'azureIdC',
        'bankAccountNameC',
        'bankAccountNumberC',
        'bankAccountTypeC',
        'bankRoutingNumberC',
        'billinggeocodeaccuracy',
        'blacklistC',
        'brokerauthorityC',
        'businessTypeC',
        'cargoInsuranceExpirationC',
        'carrierTypeC',
        'cellPhoneC',
        'certificateHolderC',
        'clientAccountManagerC',
        'coiRequestDateC',
        'commonauthorityC',
        'contractauthorityC',
        'counterpartyGuidC',
        'createdbyid',
        'createddate',
        'creditLimitAmountC',
        'customerInQboC',
        'customerPriorityC',
        'datUsernameC',
        'dbaNameC',
        'deliveryNotesC',
        'description',
        'emergencyPhoneC',
        'factoringCompanyC',
        'fax',
        'flagC',
        'flagHistoryC',
        'fraudIdentityTheftStatusC',
        'freePhoneC',
        'icpEligibleC',
        'icpGpC',
        'icpMultiplierC',
        'industry',
        'insuranceExpirationC',
        'insuranceOnFileC',
        'internalNotesC',
        'iscustomerportal',
        'ispartner',
        'ispersonaccount',
        'jobTitleC',
        'lastmodifieddate',
        'lastreferenceddate',
        'lastvieweddate',
        'liabilityInsuranceExpirationC',
        'lkqTrainingItemsPc',
        'masterrecordGuidC',
        'masterrecordid',
        'mcNumberC',
        'notesC',
        'numberofemployees',
        'numberOfLocationsC',
        'operationsEmailC',
        'ownerid',
        'parentid',
        'paymentMethodC',
        'paymentTermsC',
        'pendingCancellationDateC',
        'personassistantname',
        'personassistantphone',
        'personbirthdate',
        'personcontactid',
        'persondepartment',
        'personemail',
        'personemailbounceddate',
        'personemailbouncedreason',
        'personhomephone',
        'personindividualid',
        'personlastcurequestdate',
        'personlastcuupdatedate',
        'personleadsource',
        'personmailingcity',
        'personmailingcountry',
        'personmailinggeocodeaccuracy',
        'personmailinglatitude',
        'personmailinglongitude',
        'personmailingpostalcode',
        'personmailingstate',
        'personmailingstreet',
        'personmobilephone',
        'personothercity',
        'personothercountry',
        'personothergeocodeaccuracy',
        'personotherlatitude',
        'personotherlongitude',
        'personotherphone',
        'personotherpostalcode',
        'personotherstate',
        'personotherstreet',
        'persontitle',
        'phone',
        'photourl',
        'pickupNotesC',
        'portfolioCodeC',
        'preferredC',
        'primaryContactPc',
        'qbIdC',
        'rating',
        'recordtypeid',
        'referralCodeC',
        'requiresattentionC',
        'salesAccountManagerC',
        'salutation',
        'sdGuidPc',
        'searchAddressC',
        'shippinggeocodeaccuracy',
        'sic',
        'sicdesc',
        'site',
        'slaC',
        'slaDaysC',
        'slaExpirationDateC',
        'slaSerialNumberC',
        'statusC',
        'subIndustryC',
        'suiteC',
        'systemmodstamp',
        'taxIdC',
        'track1099C',
        'traineeC',
        'trainerC',
        'trainingDateC',
        'trainingItemsC',
        'truckstopUsernameC',
        'upsellOpportunityC',
        'userRoleC',
        'usesFactoringCompanyC',
        'vendorTypeC',
        'website',
    ]

    static fieldsToHideFromExternal = [
        'sfid',
        'isDeleted',
        'id',
        'dotNumberStatus',
        'type',
        'firstName',
        'lastName',
        'primaryContactId'
    ]
}

module.exports = SFAccount;
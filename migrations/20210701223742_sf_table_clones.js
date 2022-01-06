
exports.up = function (knex)
{
    return knex
        .raw(`
        CREATE OR REPLACE VIEW salesforce.accounts AS
        SELECT
            accountnumber as account_number,
            accountsource as account_source,
            active__c as active,
            auction_id__c as auction_id,
            auto_insurance_expiration__c as auto_insurance_expiration,
            autoims_client_id__c as autoims_client_id,
            azure_id__c as azure_id,
            bank_account_name__c as bank_account_name,
            bank_account_number__c as bank_account_number,
            bank_account_type__c as bank_account_type,
            bank_routing_number__c as bank_routing_number,
            billingcity as billing_city,
            billingcountry as billing_country,
            billinggeocodeaccuracy as billing_geocode_accuracy,
            billinglatitude as billing_latitude,
            billinglongitude as billing_longitude,
            billingpostalcode as billing_postal_code,
            billingstate as billing_state,
            billingstreet as billing_street,
            blacklist__c as blacklist,
            brokerauthority__c as broker_authority,
            business_type__c as business_type,
            cargo_insurance_expiration__c as cargo_insurance_expiration,
            carrier_type__c as carrier_type,
            cell_phone__c as cell_phone,
            certificate_holder__c as certificate_holder,
            client_account_manager__c as client_account_manager,
            counterparty_guid__c as counter_party_guid,
            createddate as created_date,
            dat_username__c as dat_username,
            dba_name__c as dba_name,
            delivery_notes__c as delivery_notes,
            description as description,
            dot_number__c as dot_number,
            edi_client__c as edi_client,
            email__c as email,
            fax as fax,
            firstname as first_name,
            guid__c as guid,
            id as id,
            insurance_expiration__c as insurance_expiration,
            insurance_on_file__c as insurance_on_file,
            internal_notes__c as internal_notes,
            job_title__c as job_title,
            lastname as last_name,
            loadboard_instructions__c as loadboard_instructions,
            mc_number__c as mc_number,
            name as name,
            notes__c as notes,
            operations_email__c as operations_email,
            order_instructions__c as order_instructions,
            ownerid as owner_id,
            parentid as parent_id,
            payment_method__c as payment_method,
            payment_terms__c as payment_terms,
            pending_cancellation_date__c as pending_cancellation_date,
            phone as phone_number,
            photourl as photo_url,
            pickup_notes__c as pickup_notes,
            preferred__c as preferred,
            primary_contact__c as primary_contact_id,
            qb_id__c as qb_id,
            recordtypeid as record_type_id,
            sc_id__c as sc_id,
            sd_guid__c as sd_guid,
            sfid as sf_id,
            shippingcity as shipping_city,
            shippingcountry as shipping_country,
            shippinggeocodeaccuracy as shipping_geocode_accuracy,
            shippinglatitude as shipping_latitude,
            shippinglongitude as shipping_longitude,
            shippingpostalcode as shipping_postal_code,
            shippingstate as shipping_state,
            shippingstreet as shipping_street,
            sla__c as sla,
            sla_days__c as sla_days,
            sla_expiration_date__c as sla_expiration_date,
            sla_serial_number__c as sla_serial_number,
            status__c as status,
            suite__c as suite,
            sync_in_super__c as sync_in_super,
            systemmodstamp as system_mod_stamp,
            truckstop_username__c as truckstop_username,
            type as type,
            user_role__c as user_role,
            vendor_type__c as vendor_type,
            website as website,
            icp_gp__c as icp_gp,
            icp_multiplier__c as icp_multiplier
            FROM salesforce.account;
            
            CREATE OR REPLACE VIEW salesforce.contacts AS
            SELECT
            accountid as account_id,
            accounting_contact__c as accounting_contact,
            createddate as created_date,
            department as department,
            description as description,
            email as email,
            fax as fax,
            firstname as first_name,
            guid__c as guid,
            homephone as home_phone,
            id as id,
            isdeleted as is_deleted,
            ispersonaccount as is_person_account,
            lastname as last_name,
            leadsource as lead_source,
            mailingcity as mailing_city,
            mailingcountry as mailing_country,
            mailinggeocodeaccuracy as mailing_geocode_accuracy,
            mailinglatitude as mailing_latitude,
            mailinglongitude as mailing_longitude,
            mailingpostalcode as mailing_postal_code,
            mailingstate as mailing_state,
            mailingstreet as mailing_street,
            mobilephone as mobile_number,
            name as name,
            othercity as other_city,
            othercountry as other_country,
            othergeocodeaccuracy as other_geocode_accuracy,
            otherlatitude as other_latitude,
            otherlongitude as other_longitude,
            otherphone as other_phone,
            otherpostalcode as other_postal_code,
            otherstate as other_state,
            otherstreet as other_street,
            phone as phone_number,
            photourl as photo_url,
            recordtypeid as record_type_id,
            sd_guid__c as sd_guid,
            sfid as sf_id,
            systemmodstamp as system_mod_stamp,
            title as title,
            primary_contact__c as primary_contact
        FROM salesforce.contact;

        CREATE OR REPLACE VIEW salesforce.record_types AS
        SELECT
            createddate as created_date,
            name as name,
            systemmodstamp as system_mod_stamp,
            isactive as is_active,
            description as description,
            sfid as sf_id,
            id as id,
            sobjecttype as object_type
        FROM salesforce.recordtype;
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        DROP VIEW IF EXISTS salesforce.accounts;
        DROP VIEW IF EXISTS salesforce.contacts;
        DROP VIEW IF EXISTS salesforce.record_types;
    `);
};

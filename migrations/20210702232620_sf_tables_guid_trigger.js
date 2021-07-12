
exports.up = function(knex)
{
  return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.salesforce_guid_gen()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        COST 1
        STABLE NOT LEAKPROOF
    AS $BODY$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                IF (NEW.guid__c IS NULL) THEN
                    NEW.guid__c = gen_random_uuid();
                END IF;
            ELSEIF (TG_OP = 'UPDATE') THEN
                -- do not allow users to change the guid__c once it is assigned
                IF(NEW.guid__c <> OLD.guid__c) THEN
                    NEW.guid__c = OLD.guid__c;
                END IF;
            END IF;
            RETURN NEW;
        END;
    $BODY$;

    CREATE TRIGGER rcg_salesforce_contact_guid
        BEFORE INSERT OR UPDATE
        ON salesforce.contact
        FOR EACH ROW
        EXECUTE FUNCTION rcg_tms.salesforce_guid_gen();

    COMMENT ON TRIGGER rcg_salesforce_contact_guid ON salesforce.contact
        IS 'sets the guid__c field if it is not set already and prevents users from changing it';

    CREATE TRIGGER rcg_salesforce_account_guid
        BEFORE INSERT OR UPDATE
        ON salesforce.account
        FOR EACH ROW
        EXECUTE FUNCTION rcg_tms.salesforce_guid_gen();

    COMMENT ON TRIGGER rcg_salesforce_account_guid ON salesforce.account
        IS 'sets the guid__c field if it is not set already and prevents users from changing it';
  `);
};

exports.down = function(knex)
{
  return knex.raw(`
    DROP TRIGGER IF EXISTS rcg_salesforce_account_guid ON salesforce.account;
    DROP TRIGGER IF EXISTS rcg_salesforce_contact_guid ON salesforce.contact;
    DROP FUNCTION IF EXISTS rcg_tms.salesforce_guid_gen();
  `);
};

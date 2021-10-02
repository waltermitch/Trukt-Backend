const FUNCTION_NAME = 'account_upserted_trigger';
const TABLE_NAME = 'account';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION salesforce.${FUNCTION_NAME}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 100
        AS $function$
        BEGIN
                IF (TG_OP = 'UPDATE') THEN
                    IF((OLD.qb_id__c IS NULL AND NEW.qb_id__c IS NOT null) or (old.sync_in_super__c != new.sync_in_super__c)) THEN
                        RETURN NEW;
                    ELSE
                        PERFORM pg_notify('account_upserted',row_to_json((select d from (select new.guid__c as guid, new.sfid as sfid) d))::text);
                    END IF;
                ElSEIF (TG_OP = 'INSERT') then
		                 IF (NEW.guid__c IS NULL) THEN
		                    NEW.guid__c = gen_random_uuid();
		                END IF;
                    PERFORM pg_notify('account_upserted',row_to_json((select d from (select new.guid__c as guid, new.sfid as sfid) d))::text);
                END IF;
            RETURN NEW;
        END;
        $function$;

        CREATE TRIGGER account_upserted
            AFTER INSERT OR UPDATE
            ON salesforce.${TABLE_NAME}
            FOR EACH ROW
            EXECUTE FUNCTION salesforce.${FUNCTION_NAME}();

        COMMENT ON TRIGGER account_upserted ON salesforce.${TABLE_NAME}
            IS 'Notify On Account Upsert';

        COMMENT ON FUNCTION salesforce.${FUNCTION_NAME}()
            IS 'Triggers Notification';`);
};

exports.down = function (knex)
{
    return knex.raw(`  
    DROP TRIGGER account_upserted ON salesforce.${TABLE_NAME};
    
    DROP FUNCTION salesforce.${FUNCTION_NAME}();`);
};

const function_name = 'account_upserted_trigger';
const table_name = 'account';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION salesforce.${function_name}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 100
        AS $function$
        BEGIN
                IF (TG_OP = 'UPDATE') THEN
                    IF((OLD.qb_id__c IS NULL AND NEW.qb_id__c IS NOT null) or new.is_synced_in_super = true or new.is_synced_in_super = false) THEN
                        RETURN NEW;
                    ELSE
                        PERFORM pg_notify('account_upserted',row_to_json((select d from (select new.guid__c as guid) d))::text);
                    END IF;
                ElSEIF (TG_OP = 'INSERT') THEN
                    PERFORM pg_notify('account_upserted',row_to_json((select d from (select new.guid__c as guid) d))::text);
                END IF;
            RETURN NEW;
        END;
        $function$;

        CREATE TRIGGER account_upserted
            AFTER INSERT OR UPDATE
            ON salesforce.${table_name}
            FOR EACH ROW
            EXECUTE FUNCTION salesforce.${function_name}();

        COMMENT ON TRIGGER account_upserted ON salesforce.${table_name}
            IS 'Notify On Account Upsert';

        COMMENT ON FUNCTION salesforce.${function_name}()
            IS 'Triggers Notification';`);
};

exports.down = function (knex)
{
    return knex.raw(`  
    DROP TRIGGER account_upserted ON salesforce.${table_name};
    
    DROP FUNCTION salesforce.${function_name}();`);
};

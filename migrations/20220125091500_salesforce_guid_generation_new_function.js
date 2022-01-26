
exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE FUNCTION rcg_tms.uuid_valid(uuid varchar)
            returns boolean as $$
            select uuid IS NOT NULL AND uuid ~ '^[0-9a-f]{8}-(:\\?[0-9a-f]{4}-){3}[0-9a-f]{12}$';
        $$ language sql;

        CREATE OR REPLACE FUNCTION rcg_tms.salesforce_guid_gen()
            returns trigger 
            LANGUAGE plpgsql
            VOLATILE NOT LEAKPROOF
            AS $function$
        DECLARE
            is_old_uuid_valid boolean;
            is_new_uuid_valid boolean;
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                select rcg_tms.uuid_valid(NEW.guid__c) INTO is_new_uuid_valid;

                IF (is_new_uuid_valid IS false) THEN
                    NEW.guid__c = gen_random_uuid();
                END IF;
            ELSEIF (TG_OP = 'UPDATE') THEN  
                select rcg_tms.uuid_valid(OLD.guid__c) INTO is_old_uuid_valid;

                IF (is_old_uuid_valid is true) THEN
                    NEW.guid__c = OLD.guid__c;
                ELSE
                    select rcg_tms.uuid_valid(NEW.guid__c) INTO is_new_uuid_valid;

                    IF (is_new_uuid_valid is false) THEN
                        NEW.guid__c = gen_random_uuid();
                    END IF;
                END IF;                
            END IF;
        RETURN NEW;
        END;
        $function$
  `);
};

// Down operation sets salesforce_guid_gen() as it was in sf_tables_guid_trigger.js
exports.down = function (knex)
{
    return knex.raw(`
        DROP FUNCTION IF EXISTS rcg_tms.uuid_valid;

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
  `);
};

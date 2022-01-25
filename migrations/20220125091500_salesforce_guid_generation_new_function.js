
exports.up = function (knex)
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
                    IF (OLD.guid__c IS NOT NULL) THEN
                        NEW.guid__c = OLD.guid__c;
                    ELSE
                        NEW.guid__c = gen_random_uuid();
                    END IF;
                END IF;
                RETURN NEW;
            END;
        $BODY$;
  `);
};

// Down operation sets salesforce_guid_gen() as it was in sf_tables_guid_trigger.js
exports.down = function (knex)
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
  `);
};

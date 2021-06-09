const db_owner = require('../tools/migration').db_owner;

const function_name = 'rcg_created_updated_timestamps';
exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 1
            STABLE LEAKPROOF
        AS $BODY$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                NEW.date_created = now();
                NEW.date_updated = NULL;
            ELSEIF (TG_OP = 'UPDATE') THEN
            -- do not allow users to change the date_created field
                IF (NEW.date_created <> OLD.date_created) THEN
                    NEW.date_created = OLD.date_created;
                END IF;
                NEW.date_updated = now();
            END IF;
            RETURN NEW;
        END;
        $BODY$;

        ALTER FUNCTION rcg_tms.${function_name}()
            OWNER TO ${db_owner};

        COMMENT ON FUNCTION rcg_tms.${function_name}()
            IS 'Sets the date_created and date_updated fields, prevents users from changing date_created';
  `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION rcg_tms.${function_name}();`);
};

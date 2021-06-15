const db_owner = require('../tools/migration').db_owner;

const function_name = 'rcg_order_job_number_assign';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        COST 100
        STABLE NOT LEAKPROOF
    AS $BODY$
    DECLARE 
        order_number varchar;
    BEGIN
        IF (TG_OP = 'INSERT') THEN
            SELECT number INTO order_number FROM orders WHERE orders.id = NEW.order_id;
            NEW.number = rcg_tms.rcg_next_order_job_number(order_number);
        ELSEIF (TG_OP = 'UPDATE') THEN
        -- do not allow users to change the guid once it is assigned
            IF (NEW.number <> OLD.number ) THEN
                NEW.number = OLD.number;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $BODY$;

    ALTER FUNCTION rcg_tms.${function_name}()
        OWNER TO ${db_owner};

    COMMENT ON FUNCTION rcg_tms.${function_name}()
        IS 'Assigns the order job the next available order job number and prevents changing it';`);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION rcg_tms.${function_name}();`);
};

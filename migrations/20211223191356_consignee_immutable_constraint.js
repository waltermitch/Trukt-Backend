const FUNCTION_NAME = 'invoice_bills_consignee_immutable_constraint';
const TRIGGER_NAME = 'invoice_bills_before_update_trigger';
const TABLE_NAME = 'invoice_bills';

/* Trigger: Before Insert
    If is_paid is true, then consignee_guid cannot be changed.
*/

exports.up = function (knex)
{
    return knex.raw(
        `
        CREATE OR REPLACE FUNCTION ${FUNCTION_NAME}() 
            RETURNS trigger
            LANGUAGE plpgsql
            COST 100
        AS $function$
        BEGIN 
            IF NEW.is_paid = true AND NEW.consignee_guid <> OLD.consignee_guid THEN
                RAISE EXCEPTION 'Cannot change consignee when invoice/bill is paid';
            END IF;
            RETURN NEW;
        END;
        $function$;

        DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON rcg_tms.${TABLE_NAME};
        CREATE TRIGGER ${TRIGGER_NAME}
            BEFORE UPDATE ON rcg_tms.${TABLE_NAME}
            FOR EACH ROW
            EXECUTE FUNCTION rcg_tms.${FUNCTION_NAME}();

        COMMENT ON TRIGGER ${TRIGGER_NAME} ON rcg_tms.${TABLE_NAME} IS 'Check if is_paid is true, then consignee_guid cannot be changed.';
        `
    );
};

exports.down = function (knex)
{
    return knex.raw(
        `
        DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON rcg_tms.${TABLE_NAME};
        DROP FUNCTION IF EXISTS ${FUNCTION_NAME};
        `
    );
};

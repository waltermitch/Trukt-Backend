const LINE_FUNCTION_NAME = 'rcg_invoice_line_order_job_expense_summation';
const LINE_TRIGGER_NAME = 'rcg_lines_trigger_update';
const TABLE_NAME = 'invoice_bill_lines';

const LINKS_FUNCTION_NAME = 'rcg_line_links_sum_calculator';
const LINKS_TRIGGER_NAME = 'rcg_lines_links_trigger_update';
const LINKS_TABLE_NAME = 'invoice_bill_line_links';

exports.up = function (knex)
{
    return knex.raw(`
        DROP TRIGGER IF EXISTS ${LINE_TRIGGER_NAME} ON rcg_tms.${TABLE_NAME};
        DROP TRIGGER IF EXISTS ${LINKS_TRIGGER_NAME} ON rcg_tms.${LINKS_TABLE_NAME};

        CREATE OR REPLACE FUNCTION rcg_tms.${LINE_FUNCTION_NAME}()
            returns trigger 
            VOLATILE NOT LEAKPROOF
            AS $function$
        DECLARE
            is_revenue boolean;
            is_order_line boolean;
            order_guid uuid;
            job_guid uuid;
            amount decimal;
            actual_rev decimal;
        BEGIN
        -- first figure out if line is for order or for job, require different queries
        SELECT count(*) > 0 FROM rcg_tms.invoices i WHERE i.invoice_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) INTO is_order_line;

        SELECT (ibli.type = 'revenue') FROM rcg_tms.invoice_bill_line_items ibli WHERE ibli.id = COALESCE(NEW.item_id, OLD.item_id) INTO is_revenue;
        
        IF (is_order_line is true) THEN
            SELECT i.order_guid FROM rcg_tms.invoices i WHERE i.invoice_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) INTO order_guid;
            
            SELECT b.job_guid FROM rcg_tms.bills b 
            RIGHT JOIN rcg_tms.invoice_bill_lines ibl 
            ON ibl.invoice_guid = b.bill_guid
            RIGHT JOIN rcg_tms.invoice_bill_line_links ibll
            ON (ibll.line2_guid = ibl.guid) OR 
            (ibll.line1_guid = ibl.guid)
            WHERE (ibll.line2_guid = ibl.guid AND ibll.line1_guid = COALESCE(NEW.guid, OLD.guid)) OR 
            (ibll.line1_guid = ibl.guid AND ibll.line2_guid = COALESCE(NEW.guid, OLD.guid))
            INTO job_guid;
        ELSE
            SELECT b.job_guid, oj.order_guid 
            FROM rcg_tms.bills b 
            LEFT JOIN rcg_tms.order_jobs oj 
            ON oj.guid = b.job_guid 
            WHERE b.bill_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) 
            INTO job_guid, order_guid;

        END IF;

        --This prevent to update the revenue or expense with null values.
        --For initial order creation the values are calculated in the server, this is because to allow the calcs to be done here
        -- it will require refactoring almost completly order.create to allow invoice_lines to be created with an existing order, job, bill and invoice
        IF (order_guid is not NULL OR job_guid is not NULL) THEN
            IF (TG_OP = 'UPDATE') THEN
                IF (TG_WHEN = 'AFTER') THEN
                    amount = NEW.amount - OLD.amount;
                    IF (NEW.amount <> OLD.amount) THEN
                        IF (is_order_line = is_revenue) THEN
                            UPDATE rcg_tms.orders SET actual_revenue = actual_revenue + amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + amount
                            WHERE guid = job_guid AND job_guid IS NOT null;
                        ELSE
                            UPDATE rcg_tms.orders SET actual_expense = actual_expense + amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + amount
                            WHERE guid = job_guid AND job_guid IS NOT null;
                        END IF;
                    END IF;
                END IF;
            ELSEIF (TG_OP = 'INSERT') THEN
                IF (is_order_line = is_revenue) THEN
                    UPDATE rcg_tms.orders SET actual_revenue = actual_revenue + NEW.amount
                    WHERE guid = order_guid;

                    UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + NEW.amount
                    WHERE guid = job_guid AND job_guid IS NOT null;
                ELSE
                    UPDATE rcg_tms.orders SET actual_expense = actual_expense + NEW.amount
                    WHERE guid = order_guid;

                    UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + NEW.amount
                    WHERE guid = job_guid AND job_guid IS NOT null;
                END IF;
            ELSEIF (TG_OP = 'DELETE') THEN
                IF (OLD.is_deleted is false) THEN
                    IF(is_order_line) THEN
                            IF(is_revenue) THEN
                                UPDATE rcg_tms.orders SET actual_revenue = actual_revenue - OLD.amount
                                WHERE guid = order_guid;

                                UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue - OLD.amount
                                WHERE guid = job_guid AND job_guid IS NOT null;
                            ELSE
                                UPDATE rcg_tms.orders SET actual_expense = actual_expense - OLD.amount
                                WHERE guid = order_guid;

                                UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense - OLD.amount
                                WHERE guid = job_guid AND job_guid IS NOT null;
                            END IF;
                        ELSE
                            IF(is_revenue) THEN
                                UPDATE rcg_tms.orders SET actual_expense = actual_expense - OLD.amount
                                WHERE guid = order_guid;

                                UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense - OLD.amount
                                WHERE guid = job_guid AND job_guid IS NOT null;
                            ELSE
                                UPDATE rcg_tms.orders SET actual_revenue = actual_revenue - OLD.amount
                                WHERE guid = order_guid;

                                UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue - OLD.amount
                                WHERE guid = job_guid AND job_guid IS NOT null;
                            END IF;
                        END IF;
                END IF;
            END IF;
        END IF;

        
        RETURN NEW;
        END;
        $function$ LANGUAGE plpgsql;

        COMMENT ON FUNCTION rcg_tms.${LINE_FUNCTION_NAME}()
        IS 'Calculates the actual expense fields on the order and the job of a invoice bill line';

        CREATE OR REPLACE FUNCTION rcg_tms.${LINKS_FUNCTION_NAME}()
            returns trigger 
            VOLATILE NOT LEAKPROOF
            AS $function$
        DECLARE
            job_guid uuid;
            is_revenue boolean;
            invoice_line_guid uuid;
            invoice_line_amount decimal;
        BEGIN
        -- Grabs the invoice line that belongs to the order
        SELECT ibl.guid, ibl.amount, (ibli.type = 'revenue') FROM rcg_tms.invoice_bill_lines ibl 
        RIGHT JOIN rcg_tms.invoices i 
        ON ibl.invoice_guid = i.invoice_guid 
        LEFT JOIN rcg_tms.invoice_bill_line_items ibli
        ON ibl.item_id = ibli.id
        WHERE (ibl.guid = COALESCE(NEW.line1_guid, OLD.line1_guid)
        OR ibl.guid = COALESCE(NEW.line2_guid, OLD.line2_guid))
        INTO invoice_line_guid, invoice_line_amount, is_revenue;

        SELECT b.job_guid FROM rcg_tms.invoice_bill_lines ibl 
        RIGHT JOIN rcg_tms.bills b 
        ON ibl.invoice_guid = b.bill_guid
        WHERE (ibl.guid IN (COALESCE(NEW.line1_guid,OLD.line1_guid), COALESCE(NEW.line2_guid, OLD.line2_guid)))
        INTO job_guid;

        --This prevent to update the revenue or expense with null values
        IF (job_guid is not null and is_revenue is not null) THEN
            IF (TG_OP = 'INSERT') THEN
                IF (is_revenue) THEN
                    UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + invoice_line_amount
                    WHERE guid = job_guid AND job_guid IS NOT null;
                ELSE
                    UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + invoice_line_amount
                    WHERE guid = job_guid AND job_guid IS NOT null;
                END IF;
            -- The update operation case is already covered in the function rcg_tms.invoice_bill_links_func.
            -- That function already forbids update operations on records of this table so
            -- it is not needed here.
            ELSIF (TG_OP = 'DELETE') THEN
                IF (is_revenue) THEN
                    UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue - invoice_line_amount
                    WHERE guid = job_guid AND job_guid IS NOT null;
                ELSE
                    UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense - invoice_line_amount
                    WHERE guid = job_guid AND job_guid IS NOT null;
                END IF;
            END IF;
        END IF;
        RETURN NEW;
        END;
        $function$ LANGUAGE plpgsql;

        COMMENT ON FUNCTION rcg_tms.${LINKS_FUNCTION_NAME}()
        IS 'Calculates the actual expense fields on the order and the job of a invoice bill line when ';

        CREATE TRIGGER ${LINE_TRIGGER_NAME}
        AFTER INSERT OR UPDATE OR DELETE 
        ON rcg_tms.invoice_bill_lines
        FOR EACH ROW
        EXECUTE FUNCTION ${LINE_FUNCTION_NAME}();

        CREATE TRIGGER ${LINKS_TRIGGER_NAME}
        AFTER INSERT OR DELETE 
        ON rcg_tms.${LINKS_TABLE_NAME}
        FOR EACH ROW
        EXECUTE FUNCTION ${LINKS_FUNCTION_NAME}();

  `);
};

exports.down = function (knex)
{
    return knex.raw(`  
    DROP TRIGGER IF EXISTS ${LINE_TRIGGER_NAME} ON rcg_tms.${TABLE_NAME};
    DROP TRIGGER IF EXISTS ${LINKS_TRIGGER_NAME} ON rcg_tms.${LINKS_TABLE_NAME};
    DROP FUNCTION IF EXISTS rcg_tms.${LINE_FUNCTION_NAME}();
    DROP FUNCTION IF EXISTS rcg_tms.${LINKS_FUNCTION_NAME}();`);
};

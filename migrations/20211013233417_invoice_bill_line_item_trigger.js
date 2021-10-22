const LINE_FUNCTION_NAME = 'line_sum_calculator';
const LINE_TRIGGER_NAME = 'rcg_lines_trigger_update';
const TABLE_NAME = 'invoice_bill_lines';
const preventPriceChange = 'prvent_price_change';

const LINKS_FUNCTION_NAME = 'line_links_sum_calculator';
const LINKS_TRIGGER_NAME = 'rcg_lines_links_trigger_update';
const LINKS_TABLE_NAME = 'invoice_bill_line_links';

exports.up = function(knex)
{
  return knex.raw(`
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
                SELECT b.job_guid, oj.order_guid FROM rcg_tms.bills b LEFT JOIN rcg_tms.order_jobs oj ON oj.guid = b.job_guid 
                WHERE b.bill_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) INTO job_guid, order_guid;

           END IF;

            IF (TG_OP = 'UPDATE') THEN
                IF (TG_WHEN = 'BEFORE') THEN
                    IF(OLD.is_deleted is true AND NEW.is_deleted is true) THEN
                        RAISE EXCEPTION 'Updating forbiden on invoice bill line: (%), record is deleted', NEW.guid;
                    END IF;
                ELSIF (TG_WHEN = 'AFTER') THEN
                    amount = NEW.amount - OLD.amount;
                    -- soft delete scenario, same action as a hard delete
                    IF(NEW.is_deleted is true AND OLD.is_deleted is false) THEN
                        IF (is_revenue = is_order_line) THEN 
                            UPDATE rcg_tms.orders SET actual_revenue = actual_revenue - OLD.amount,
                            actual_income = actual_income - OLD.amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue - OLD.amount,
                            actual_income = actual_income - OLD.amount
                            WHERE guid = job_guid;
                        ELSE
                            UPDATE rcg_tms.orders SET actual_expense = actual_expense - OLD.amount,
                            actual_income = actual_income + OLD.amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense - OLD.amount,
                            actual_income = actual_income + OLD.amount
                            WHERE guid = job_guid;
                        END IF;
                    -- soft undelete scenario, same action as an insert
                    ELSIF(OLD.is_deleted is true AND NEW.is_deleted is false) THEN
                        IF (is_revenue = is_order_line) THEN 
                            UPDATE rcg_tms.orders SET actual_revenue = actual_revenue + NEW.amount,
                            actual_income = actual_income + NEW.amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + NEW.amount,
                            actual_income = actual_income + NEW.amount
                            WHERE guid = job_guid;
                        ELSE
                            UPDATE rcg_tms.orders SET actual_expense = actual_expense + NEW.amount,
                            actual_income = actual_income - NEW.amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + NEW.amount,
                            actual_income = actual_income - NEW.amount
                            WHERE guid = job_guid;
                        END IF;
                    -- updating active line
                    ELSIF(NEW.amount <> OLD.amount) THEN
                        IF (is_order_line = is_revenue) THEN 
                            UPDATE rcg_tms.orders SET actual_revenue = actual_revenue + amount,
                            actual_income = actual_income + amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + amount,
                            actual_income = actual_income + amount
                            WHERE guid = job_guid;
                        ELSE
                            UPDATE rcg_tms.orders SET actual_expense = actual_expense + amount,
                            actual_income = actual_income - amount
                            WHERE guid = order_guid;

                            UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + amount,
                            actual_income = actual_income - amount
                            WHERE guid = job_guid;     
                        END IF;
                    END IF;
                END IF;
            ELSEIF (TG_OP = 'INSERT') THEN
                IF (is_order_line = is_revenue) THEN 
                    UPDATE rcg_tms.orders SET actual_revenue = actual_revenue + NEW.amount,
                    actual_income = actual_income + NEW.amount
                    WHERE guid = order_guid;

                    UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + NEW.amount,
                    actual_income = actual_income + NEW.amount
                    WHERE guid = job_guid;
                ELSE
                    UPDATE rcg_tms.orders SET actual_expense = actual_expense + NEW.amount,
                    actual_income = actual_income - NEW.amount
                    WHERE guid = order_guid;

                    UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + NEW.amount,
                    actual_income = actual_income - NEW.amount
                    WHERE guid = job_guid;
                END IF;
            ELSEIF (TG_OP = 'DELETE') THEN
                IF (OLD.is_deleted is false) THEN
                     IF (is_revenue = is_order_line) THEN 
                        UPDATE rcg_tms.orders SET actual_revenue = actual_revenue - OLD.amount,
                        actual_income = actual_income - OLD.amount
                        WHERE guid = order_guid;

                        UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue - OLD.amount,
                        actual_income = actual_income - OLD.amount
                        WHERE guid = job_guid;
                    ELSE
                        UPDATE rcg_tms.orders SET actual_expense = actual_expense - OLD.amount,
                        actual_income = actual_income + OLD.amount
                        WHERE guid = order_guid;

                        UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense - OLD.amount,
                        actual_income = actual_income + OLD.amount
                        WHERE guid = job_guid; 
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
            SELECT ibl.guid, ibl.amount from rcg_tms.invoice_bill_lines ibl 
            LEFT JOIN rcg_tms.invoices i 
            ON ibl.invoice_guid = i.invoice_guid 
            WHERE (ibl.guid = COALESCE(NEW.line1_guid, OLD.line1_guid)
            OR ibl.guid = COALESCE(NEW.line2_guid, OLD.line2_guid)) 
            AND ibl.invoice_guid = i.invoice_guid
            INTO invoice_line_guid, invoice_line_amount;

            SELECT b.job_guid, (ibli.type = 'revenue') from rcg_tms.invoice_bill_lines ibl 
            LEFT JOIN rcg_tms.bills b 
            ON ibl.invoice_guid = b.bill_guid 
            LEFT JOIN rcg_tms.invoice_bill_line_items ibli
            ON ibl.item_id = ibli.id
            WHERE (ibl.guid in (COALESCE(NEW.line1_guid,OLD.line1_guid), COALESCE(NEW.line2_guid, OLD.line2_guid)) AND ibl.guid <> invoice_line_guid) 
            AND ibl.invoice_guid = b.bill_guid
            INTO job_guid, is_revenue;

            IF (TG_OP = 'INSERT') THEN
                IF (is_revenue is true) THEN
                    UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue + invoice_line_amount,
                    actual_income = actual_income + invoice_line_amount
                    WHERE guid = job_guid; 
                ELSE
                    UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense + invoice_line_amount,
                    actual_income = actual_income - invoice_line_amount
                    WHERE guid = job_guid;
                END IF;
            ELSIF (TG_OP = 'UPDATE') THEN
                RAISE EXCEPTION 'Updating records on this table is forbidden.';
            ELSIF (TG_OP = 'DELETE') THEN
                IF (is_revenue is true) THEN
                    UPDATE rcg_tms.order_jobs SET actual_revenue = actual_revenue - invoice_line_amount,
                    actual_income = actual_income - invoice_line_amount
                    WHERE guid = job_guid;
                ELSE
                    UPDATE rcg_tms.order_jobs SET actual_expense = actual_expense - invoice_line_amount,
                    actual_income = actual_income + invoice_line_amount
                    WHERE guid = job_guid;
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

    CREATE TRIGGER ${preventPriceChange}
    BEFORE UPDATE
    ON rcg_tms.invoice_bill_lines
    FOR EACH ROW
    EXECUTE FUNCTION ${LINE_FUNCTION_NAME}();

    CREATE TRIGGER ${LINKS_TRIGGER_NAME}
    AFTER INSERT OR UPDATE OR DELETE 
    ON rcg_tms.${LINKS_TABLE_NAME}
    FOR EACH ROW
    EXECUTE FUNCTION ${LINKS_FUNCTION_NAME}();

  `);
};

exports.down = function(knex)
{
    return knex.raw(`  
    DROP TRIGGER ${LINE_TRIGGER_NAME} ON rcg_tms.${TABLE_NAME};
    DROP TRIGGER ${preventPriceChange} ON rcg_tms.${TABLE_NAME};
    DROP TRIGGER ${LINKS_TRIGGER_NAME} ON rcg_tms.${LINKS_TABLE_NAME};
    DROP FUNCTION rcg_tms.${LINE_FUNCTION_NAME}();
    DROP FUNCTION rcg_tms.${LINKS_FUNCTION_NAME}();`);
};

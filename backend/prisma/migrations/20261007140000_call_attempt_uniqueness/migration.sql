DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "calls"
        GROUP BY "orderId", "attempt"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add unique call attempt index: duplicate (orderId, attempt) rows exist';
    END IF;
END $$;

CREATE UNIQUE INDEX "calls_orderId_attempt_key"
ON "calls"("orderId", "attempt");
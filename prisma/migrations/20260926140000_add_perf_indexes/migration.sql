-- CreateIndex
CREATE INDEX `payment_status_paidAt_idx` ON `payment`(`status`, `paidAt`);

-- CreateIndex
CREATE INDEX `program_isActive_scheduleAt_idx` ON `program`(`isActive`, `scheduleAt`);

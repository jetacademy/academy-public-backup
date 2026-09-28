-- AlterTable: modul bisa ditandai "Semua batch" — otomatis tampil di batch mana pun,
-- termasuk batch yang dibuat belakangan. Default FALSE supaya modul lama tetap
-- mengikuti centang batch (BatchModule) seperti sebelumnya.
ALTER TABLE `lmsmodule` ADD COLUMN `allBatches` BOOLEAN NOT NULL DEFAULT false;

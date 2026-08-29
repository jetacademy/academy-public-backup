-- CreateTable
CREATE TABLE `lead` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `whatsapp` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `source` ENUM('INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'REFERRAL', 'ORGANIC', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `programId` VARCHAR(191) NULL,
    `bidangUsaha` TEXT NULL,
    `pesanPertama` TEXT NULL,
    `ringkasanConversation` TEXT NULL,
    `objections` JSON NULL,
    `status` ENUM('NEW', 'INTERESTED', 'POTENTIAL', 'COLD') NOT NULL DEFAULT 'NEW',
    `hasil` ENUM('ACTIVE', 'REGISTERED', 'PAID', 'CANCELLED', 'NO_REPLY') NOT NULL DEFAULT 'ACTIVE',
    `nextFollowUpAt` DATETIME(3) NULL,
    `lastFollowUpAt` DATETIME(3) NULL,
    `followUpCount` INT NOT NULL DEFAULT 0,
    `followUpHistory` JSON NULL,
    `registrationId` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_status_idx`(`status`),
    INDEX `lead_hasil_idx`(`hasil`),
    INDEX `lead_source_idx`(`source`),
    INDEX `lead_nextFollowUpAt_idx`(`nextFollowUpAt`),
    INDEX `lead_createdAt_idx`(`createdAt`),
    INDEX `lead_whatsapp_idx`(`whatsapp`),
    INDEX `lead_programId_idx`(`programId`),
    UNIQUE INDEX `lead_registrationId_key`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `registration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
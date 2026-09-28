-- CreateTable
CREATE TABLE `helpdocchunk` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `section` VARCHAR(100) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `heading` VARCHAR(500) NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `order` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpchatsettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `dailyQuota` INTEGER NOT NULL DEFAULT 30,
    `docsHash` VARCHAR(64) NULL,
    `docsSyncedAt` DATETIME(3) NULL,
    `docsChunkCount` INTEGER NOT NULL DEFAULT 0,
    `docsTopics` TEXT NULL,
    `syncError` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpchatcache` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` MEDIUMTEXT NOT NULL,
    `sources` JSON NOT NULL,
    `hits` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `helpchatcache_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `helpchatlog` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `registrationId` VARCHAR(191) NULL,
    `question` TEXT NOT NULL,
    `answer` MEDIUMTEXT NULL,
    `sources` JSON NULL,
    `intent` VARCHAR(20) NOT NULL DEFAULT 'hermes',
    `cached` BOOLEAN NOT NULL DEFAULT false,
    `cacheKey` VARCHAR(64) NULL,
    `hasImage` BOOLEAN NOT NULL DEFAULT false,
    `unverified` JSON NULL,
    `model` VARCHAR(100) NULL,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `costUsd` DOUBLE NOT NULL DEFAULT 0,
    `latencyMs` INTEGER NOT NULL DEFAULT 0,
    `feedback` INTEGER NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `helpchatlog_identifier_createdAt_idx`(`identifier`, `createdAt`),
    INDEX `helpchatlog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


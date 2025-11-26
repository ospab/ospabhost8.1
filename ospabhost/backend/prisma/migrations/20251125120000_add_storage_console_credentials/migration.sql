-- CreateTable
CREATE TABLE `storage_console_credential` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bucketId` INTEGER NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `storage_console_credential_bucketId_key`(`bucketId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `storage_console_credential_bucketId_fkey` FOREIGN KEY (`bucketId`) REFERENCES `storage_bucket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

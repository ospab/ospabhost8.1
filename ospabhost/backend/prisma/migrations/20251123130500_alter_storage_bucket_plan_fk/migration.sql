-- AlterTable
ALTER TABLE `storage_bucket`
  ADD CONSTRAINT `storage_bucket_plan_fkey`
    FOREIGN KEY (`plan`) REFERENCES `storage_plan`(`code`) ON UPDATE CASCADE ON DELETE RESTRICT;

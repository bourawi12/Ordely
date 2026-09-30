-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accentColor" VARCHAR(7),
ADD COLUMN     "themeMode" VARCHAR(10) NOT NULL DEFAULT 'system';


-- DropIndex
DROP INDEX "physical_archives_archiveNo_idx";

-- CreateIndex
CREATE INDEX "physical_archives_fondsName_idx" ON "physical_archives"("fondsName");

-- CreateIndex
CREATE INDEX "physical_archives_fileNo_idx" ON "physical_archives"("fileNo");

-- CreateIndex
CREATE INDEX "physical_archives_responsibleParty_idx" ON "physical_archives"("responsibleParty");

-- CreateIndex (GIN for array search)
CREATE INDEX "physical_archives_keywords_idx" ON "physical_archives" USING GIN ("keywords");

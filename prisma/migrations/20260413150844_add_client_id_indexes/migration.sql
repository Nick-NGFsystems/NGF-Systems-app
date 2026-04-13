-- CreateIndex
CREATE INDEX "change_requests_client_id_idx" ON "change_requests"("client_id");

-- CreateIndex
CREATE INDEX "contracts_client_id_idx" ON "contracts"("client_id");

-- CreateIndex
CREATE INDEX "project_requests_client_id_idx" ON "project_requests"("client_id");

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "site_analytics_client_id_idx" ON "site_analytics"("client_id");

-- CreateIndex
CREATE INDEX "time_entries_client_id_idx" ON "time_entries"("client_id");

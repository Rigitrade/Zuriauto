-- Multi-company phase A (15.11.2026): a sign-in name is unique across every
-- company, because sign-in has only the name to go on. Production has one
-- company, whose usernames are already unique, so the index builds cleanly.

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

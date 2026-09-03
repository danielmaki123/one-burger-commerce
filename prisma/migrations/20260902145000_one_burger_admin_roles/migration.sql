ALTER TYPE "AdminRole" RENAME VALUE 'owner_admin' TO 'owner';
ALTER TYPE "AdminRole" RENAME VALUE 'inventory_staff' TO 'manager';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'kitchen';

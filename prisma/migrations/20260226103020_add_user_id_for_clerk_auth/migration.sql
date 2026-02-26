-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Trigger" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Execution_userId_idx" ON "Execution"("userId");

-- CreateIndex
CREATE INDEX "Trigger_userId_idx" ON "Trigger"("userId");

-- CreateIndex
CREATE INDEX "Workflow_userId_idx" ON "Workflow"("userId");

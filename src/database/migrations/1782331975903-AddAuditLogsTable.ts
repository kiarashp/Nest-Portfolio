import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAuditLogsTable1782331975903 implements MigrationInterface {
  name = 'AddAuditLogsTable1782331975903'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "userId" integer, "action" character varying(32) NOT NULL, "entity" character varying(64) NOT NULL, "entityId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`)
  }
}

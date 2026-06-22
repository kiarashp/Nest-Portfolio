import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddContactSubmissionsTable1782168767303 implements MigrationInterface {
  name = 'AddContactSubmissionsTable1782168767303'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contact_submission" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "email" character varying(254) NOT NULL, "subject" character varying(200) NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_105f8b67ed7acaf8a8d794e3619" PRIMARY KEY ("id"))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "contact_submission"`)
  }
}

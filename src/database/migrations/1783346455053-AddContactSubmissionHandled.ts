import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddContactSubmissionHandled1783346455053 implements MigrationInterface {
  name = 'AddContactSubmissionHandled1783346455053'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_submission" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    )
    await queryRunner.query(
      `ALTER TABLE "contact_submission" ADD "handled" boolean NOT NULL DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_submission" DROP COLUMN "handled"`,
    )
    await queryRunner.query(
      `ALTER TABLE "contact_submission" DROP COLUMN "updatedAt"`,
    )
  }
}

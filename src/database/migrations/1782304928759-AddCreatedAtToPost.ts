import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatedAtToPost1782304928759 implements MigrationInterface {
  name = 'AddCreatedAtToPost1782304928759'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "createdAt"`)
  }
}

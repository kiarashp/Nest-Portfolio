import { MigrationInterface, QueryRunner } from 'typeorm'

export class PublishOnTimestamptz1782227902403 implements MigrationInterface {
  name = 'PublishOnTimestamptz1782227902403'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "publishOn"`)
    await queryRunner.query(
      `ALTER TABLE "post" ADD "publishOn" TIMESTAMP WITH TIME ZONE`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "publishOn"`)
    await queryRunner.query(`ALTER TABLE "post" ADD "publishOn" TIMESTAMP`)
  }
}

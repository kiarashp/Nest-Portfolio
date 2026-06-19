import { MigrationInterface, QueryRunner } from 'typeorm'

export class IsEmailVerifiedDefaultFalse1781890561015 implements MigrationInterface {
  name = 'IsEmailVerifiedDefaultFalse1781890561015'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "isEmailVerified" SET DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "isEmailVerified" SET DEFAULT true`,
    )
  }
}

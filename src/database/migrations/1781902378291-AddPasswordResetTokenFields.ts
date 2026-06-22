import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPasswordResetTokenFields1781902378291 implements MigrationInterface {
  name = 'AddPasswordResetTokenFields1781902378291'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordResetToken" character varying(128)`,
    )
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiry" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "isEmailVerified" SET DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "isEmailVerified" SET DEFAULT true`,
    )
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "passwordResetTokenExpiry"`,
    )
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "passwordResetToken"`,
    )
  }
}

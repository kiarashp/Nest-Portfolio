import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSavedConfigurationQuoteReviewed1784052609877 implements MigrationInterface {
  name = 'AddSavedConfigurationQuoteReviewed1784052609877'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD "quoteReviewed" boolean NOT NULL DEFAULT false`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP COLUMN "quoteReviewed"`,
    )
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProductDescriptionHtml1783559515260 implements MigrationInterface {
  name = 'AddProductDescriptionHtml1783559515260'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" ADD "descriptionHtml" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN "descriptionHtml"`,
    )
  }
}

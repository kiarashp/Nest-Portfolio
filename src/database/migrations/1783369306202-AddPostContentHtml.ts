import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostContentHtml1783369306202 implements MigrationInterface {
  name = 'AddPostContentHtml1783369306202'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "contentHtml" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentHtml"`)
  }
}

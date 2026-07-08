import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostImagesGallery1783542936583 implements MigrationInterface {
  name = 'AddPostImagesGallery1783542936583'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "images" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "images"`)
  }
}

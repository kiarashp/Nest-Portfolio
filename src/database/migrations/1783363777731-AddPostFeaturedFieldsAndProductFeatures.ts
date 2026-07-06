import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostFeaturedFieldsAndProductFeatures1783363777731 implements MigrationInterface {
  name = 'AddPostFeaturedFieldsAndProductFeatures1783363777731'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "isFeatured" boolean NOT NULL DEFAULT false`,
    )
    await queryRunner.query(
      `ALTER TABLE "post" ADD "excerpt" character varying(160)`,
    )
    await queryRunner.query(
      `ALTER TABLE "post" ADD "publishedAt" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `ALTER TABLE "product" ADD "isFeatured" boolean NOT NULL DEFAULT false`,
    )
    await queryRunner.query(
      `ALTER TABLE "product_type" ADD "imageUrl" character varying(1024)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_type" DROP COLUMN "imageUrl"`)
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "isFeatured"`)
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "publishedAt"`)
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "excerpt"`)
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "isFeatured"`)
  }
}

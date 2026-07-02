import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveTagSchemaAndFeaturedImage1783003616116 implements MigrationInterface {
  name = 'RemoveTagSchemaAndFeaturedImage1783003616116'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "schema"`)
    await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "featuredImage"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tag" ADD "featuredImage" character varying(1024)`,
    )
    await queryRunner.query(`ALTER TABLE "tag" ADD "schema" text`)
  }
}

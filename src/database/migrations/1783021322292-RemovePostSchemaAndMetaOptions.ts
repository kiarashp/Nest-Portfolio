import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemovePostSchemaAndMetaOptions1783021322292 implements MigrationInterface {
  name = 'RemovePostSchemaAndMetaOptions1783021322292'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meta_option" DROP CONSTRAINT "FK_b492d76365f19dffc4d60a7f863"`,
    )
    await queryRunner.query(`DROP TABLE "meta_option"`)
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "schema"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "schema" text`)
    await queryRunner.query(
      `CREATE TABLE "meta_option" ("id" SERIAL NOT NULL, "metaValue" json NOT NULL, "createDate" TIMESTAMP NOT NULL DEFAULT now(), "updateDate" TIMESTAMP NOT NULL DEFAULT now(), "postId" integer, CONSTRAINT "REL_b492d76365f19dffc4d60a7f86" UNIQUE ("postId"), CONSTRAINT "PK_59e834d6ba39bd9bd7c99b8805d" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "meta_option" ADD CONSTRAINT "FK_b492d76365f19dffc4d60a7f863" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBioField1782151005998 implements MigrationInterface {
  name = 'AddUserBioField1782151005998'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bio"`)
  }
}

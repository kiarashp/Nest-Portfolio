import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAvatarOptionsTable1782160421751 implements MigrationInterface {
  name = 'AddAvatarOptionsTable1782160421751'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "avatar_option" ("id" SERIAL NOT NULL, "url" character varying(2048) NOT NULL, "publicId" character varying(256) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f95d5900a5d70926e97130c0cdb" PRIMARY KEY ("id"))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "avatar_option"`)
  }
}

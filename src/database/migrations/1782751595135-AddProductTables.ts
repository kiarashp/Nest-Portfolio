import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProductTables1782751595135 implements MigrationInterface {
  name = 'AddProductTables1782751595135'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_type" ("id" SERIAL NOT NULL, "name" character varying(256) NOT NULL, "slug" character varying(256) NOT NULL, "filterableFields" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8978484a9cee7a0c780cd259b88" UNIQUE ("name"), CONSTRAINT "UQ_9ea6957ecb3677204c580411f7f" UNIQUE ("slug"), CONSTRAINT "PK_e0843930fbb8854fe36ca39dae1" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "product" ("id" SERIAL NOT NULL, "name" character varying(512) NOT NULL, "slug" character varying(256) NOT NULL, "sku" character varying(128), "shortDescription" character varying(512) NOT NULL, "description" text, "imageUrl" character varying(1024), "images" jsonb, "specs" jsonb, "isPublished" boolean NOT NULL DEFAULT false, "productTypeId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_8cfaf4a1e80806d58e3dbe69224" UNIQUE ("slug"), CONSTRAINT "UQ_34f6ca1cd897cc926bdcca1ca39" UNIQUE ("sku"), CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_374bfd0d1b0e1398d7206456d9" ON "product"  ("productTypeId") `,
    )
    await queryRunner.query(
      `ALTER TABLE "product" ADD CONSTRAINT "FK_374bfd0d1b0e1398d7206456d98" FOREIGN KEY ("productTypeId") REFERENCES "product_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "FK_374bfd0d1b0e1398d7206456d98"`,
    )
    await queryRunner.query(
      `DROP INDEX "public"."IDX_374bfd0d1b0e1398d7206456d9"`,
    )
    await queryRunner.query(`DROP TABLE "product"`)
    await queryRunner.query(`DROP TABLE "product_type"`)
  }
}

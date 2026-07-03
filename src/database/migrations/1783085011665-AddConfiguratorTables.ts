import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddConfiguratorTables1783085011665 implements MigrationInterface {
  name = 'AddConfiguratorTables1783085011665'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."configurator_segment_definition_datatype_enum" AS ENUM('string', 'number', 'select')`,
    )
    await queryRunner.query(
      `CREATE TABLE "configurator_segment_definition" ("id" SERIAL NOT NULL, "name" character varying(256) NOT NULL, "label" character varying(256) NOT NULL, "dataType" "public"."configurator_segment_definition_datatype_enum" NOT NULL, "constraints" jsonb, "meaningTemplate" character varying(512) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1ebef65cae6aa7dc3f11696550a" UNIQUE ("name"), CONSTRAINT "PK_edb822750ebeeb16da9b369397f" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "configurator_segment_option" ("id" SERIAL NOT NULL, "definitionId" integer NOT NULL, "value" character varying(64) NOT NULL, "label" character varying(256) NOT NULL, "sortOrder" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_37c28f7293374b0865cb12e65ca" UNIQUE ("definitionId", "value"), CONSTRAINT "PK_50ee78427e46158919e7a750f40" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "configurator_product" ("id" SERIAL NOT NULL, "name" character varying(256) NOT NULL, "slug" character varying(256) NOT NULL, "codePrefix" character varying(32) NOT NULL, "separator" character varying(1) NOT NULL DEFAULT '-', "description" text, "imageUrl" character varying(1024), "imagePublicId" character varying(256), "isPublished" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_74e2ad48eba05a375a1fce1c776" UNIQUE ("name"), CONSTRAINT "UQ_739ba796b1de578a20987dd2350" UNIQUE ("slug"), CONSTRAINT "PK_ff91b021175648e248e08aadcf9" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "configurator_assignment" ("id" SERIAL NOT NULL, "productId" integer NOT NULL, "definitionId" integer NOT NULL, "position" integer NOT NULL, "condition" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ee71c7c4776a5dd1d5f2b0312c1" UNIQUE ("productId", "position"), CONSTRAINT "UQ_b3164848231b132eabf72c769c5" UNIQUE ("productId", "definitionId"), CONSTRAINT "PK_60e04b8d75e1d066f9b85a27058" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_segment_option" ADD CONSTRAINT "FK_a39c0fe9a9b6fccbddabcf9f467" FOREIGN KEY ("definitionId") REFERENCES "configurator_segment_definition"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_assignment" ADD CONSTRAINT "FK_4c8152906852dbbee64a68ab40c" FOREIGN KEY ("productId") REFERENCES "configurator_product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_assignment" ADD CONSTRAINT "FK_c3d055cc0c02f9be49d9543ad03" FOREIGN KEY ("definitionId") REFERENCES "configurator_segment_definition"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configurator_assignment" DROP CONSTRAINT "FK_c3d055cc0c02f9be49d9543ad03"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_assignment" DROP CONSTRAINT "FK_4c8152906852dbbee64a68ab40c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_segment_option" DROP CONSTRAINT "FK_a39c0fe9a9b6fccbddabcf9f467"`,
    )
    await queryRunner.query(`DROP TABLE "configurator_assignment"`)
    await queryRunner.query(`DROP TABLE "configurator_product"`)
    await queryRunner.query(`DROP TABLE "configurator_segment_option"`)
    await queryRunner.query(`DROP TABLE "configurator_segment_definition"`)
    await queryRunner.query(
      `DROP TYPE "public"."configurator_segment_definition_datatype_enum"`,
    )
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddConfiguratorSavedConfiguration1783690069236 implements MigrationInterface {
  name = 'AddConfiguratorSavedConfiguration1783690069236'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "configurator_saved_configuration" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "productId" integer, "productName" character varying(256) NOT NULL, "code" character varying(512) NOT NULL, "summary" jsonb NOT NULL, "selections" jsonb NOT NULL, "quoteRequestedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4acca4a096a10d2e8d6921a623e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD CONSTRAINT "FK_76328130fb0fa79d5344319afb8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD CONSTRAINT "FK_3a1b181882d8fb77a94e501693a" FOREIGN KEY ("productId") REFERENCES "configurator_product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP CONSTRAINT "FK_3a1b181882d8fb77a94e501693a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP CONSTRAINT "FK_76328130fb0fa79d5344319afb8"`,
    )
    await queryRunner.query(`DROP TABLE "configurator_saved_configuration"`)
  }
}

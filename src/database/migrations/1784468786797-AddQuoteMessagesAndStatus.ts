import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddQuoteMessagesAndStatus1784468786797 implements MigrationInterface {
  name = 'AddQuoteMessagesAndStatus1784468786797'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."configurator_quote_message_senderrole_enum" AS ENUM('user', 'admin')`,
    )
    await queryRunner.query(
      `CREATE TABLE "configurator_quote_message" ("id" SERIAL NOT NULL, "savedConfigurationId" integer NOT NULL, "senderId" integer, "senderRole" "public"."configurator_quote_message_senderrole_enum" NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8356d774aa9d410bc139ef067cd" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_3fc3b62bbf39eab3227fb82594" ON "configurator_quote_message"  ("savedConfigurationId", "createdAt") `,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP COLUMN "quoteReviewed"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."configurator_saved_configuration_quotestatus_enum" AS ENUM('PENDING', 'ANSWERED', 'CLOSED')`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD "quoteStatus" "public"."configurator_saved_configuration_quotestatus_enum"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD "userLastReadAt" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD "adminLastReadAt" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_quote_message" ADD CONSTRAINT "FK_678f9ad119fc5a1212944e81c60" FOREIGN KEY ("savedConfigurationId") REFERENCES "configurator_saved_configuration"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_quote_message" ADD CONSTRAINT "FK_78d0a7e06d40fe52957f1ee9b8a" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configurator_quote_message" DROP CONSTRAINT "FK_78d0a7e06d40fe52957f1ee9b8a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_quote_message" DROP CONSTRAINT "FK_678f9ad119fc5a1212944e81c60"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP COLUMN "adminLastReadAt"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP COLUMN "userLastReadAt"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" DROP COLUMN "quoteStatus"`,
    )
    await queryRunner.query(
      `DROP TYPE "public"."configurator_saved_configuration_quotestatus_enum"`,
    )
    await queryRunner.query(
      `ALTER TABLE "configurator_saved_configuration" ADD "quoteReviewed" boolean NOT NULL DEFAULT false`,
    )
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3fc3b62bbf39eab3227fb82594"`,
    )
    await queryRunner.query(`DROP TABLE "configurator_quote_message"`)
    await queryRunner.query(
      `DROP TYPE "public"."configurator_quote_message_senderrole_enum"`,
    )
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProductTypeIdToUploadFile1783552510396 implements MigrationInterface {
  name = 'AddProductTypeIdToUploadFile1783552510396'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload_file" ADD "productTypeId" integer`,
    )
    await queryRunner.query(
      `ALTER TABLE "upload_file" ADD CONSTRAINT "FK_31eccc74ee8b49cd0f075c3f5b3" FOREIGN KEY ("productTypeId") REFERENCES "product_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload_file" DROP CONSTRAINT "FK_31eccc74ee8b49cd0f075c3f5b3"`,
    )
    await queryRunner.query(
      `ALTER TABLE "upload_file" DROP COLUMN "productTypeId"`,
    )
  }
}

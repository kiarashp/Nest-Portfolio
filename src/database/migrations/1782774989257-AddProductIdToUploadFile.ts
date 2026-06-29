import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProductIdToUploadFile1782774989257 implements MigrationInterface {
  name = 'AddProductIdToUploadFile1782774989257'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "upload_file" ADD "productId" integer`)
    await queryRunner.query(
      `ALTER TABLE "upload_file" ADD CONSTRAINT "FK_c73354e2483f5c982e93b4d34ff" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload_file" DROP CONSTRAINT "FK_c73354e2483f5c982e93b4d34ff"`,
    )
    await queryRunner.query(`ALTER TABLE "upload_file" DROP COLUMN "productId"`)
  }
}

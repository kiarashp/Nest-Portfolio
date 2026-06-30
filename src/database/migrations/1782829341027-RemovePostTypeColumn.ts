import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePostTypeColumn1782829341027 implements MigrationInterface {
    name = 'RemovePostTypeColumn1782829341027'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "postType"`);
        await queryRunner.query(`DROP TYPE "public"."post_posttype_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."post_posttype_enum" AS ENUM('post', 'page', 'story', 'series')`);
        await queryRunner.query(`ALTER TABLE "post" ADD "postType" "public"."post_posttype_enum" NOT NULL DEFAULT 'post'`);
    }

}

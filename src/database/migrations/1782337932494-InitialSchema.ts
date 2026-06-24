import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782337932494 implements MigrationInterface {
    name = 'InitialSchema1782337932494'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "meta_option" ("id" SERIAL NOT NULL, "metaValue" json NOT NULL, "createDate" TIMESTAMP NOT NULL DEFAULT now(), "updateDate" TIMESTAMP NOT NULL DEFAULT now(), "postId" integer, CONSTRAINT "REL_b492d76365f19dffc4d60a7f86" UNIQUE ("postId"), CONSTRAINT "PK_59e834d6ba39bd9bd7c99b8805d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tag" ("id" SERIAL NOT NULL, "name" character varying(256) NOT NULL, "slug" character varying(256) NOT NULL, "description" text, "schema" text, "featuredImage" character varying(1024), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_6a9775008add570dc3e5a0bab7b" UNIQUE ("name"), CONSTRAINT "UQ_3413aed3ecde54f832c4f44f045" UNIQUE ("slug"), CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."upload_file_type_enum" AS ENUM('image')`);
        await queryRunner.query(`CREATE TABLE "upload_file" ("id" SERIAL NOT NULL, "name" character varying(1024) NOT NULL, "path" character varying(2048) NOT NULL, "publicId" character varying(256) NOT NULL, "type" "public"."upload_file_type_enum" NOT NULL DEFAULT 'image', "mime" character varying(128) NOT NULL, "size" integer NOT NULL, "userId" integer NOT NULL, "postId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_17afec80fc97979415eae19aee0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."post_posttype_enum" AS ENUM('post', 'page', 'story', 'series')`);
        await queryRunner.query(`CREATE TYPE "public"."post_status_enum" AS ENUM('draft', 'scheduled', 'review', 'published')`);
        await queryRunner.query(`CREATE TABLE "post" ("id" SERIAL NOT NULL, "title" character varying(512) NOT NULL, "postType" "public"."post_posttype_enum" NOT NULL DEFAULT 'post', "slug" character varying(256) NOT NULL, "status" "public"."post_status_enum" NOT NULL DEFAULT 'draft', "content" text, "schema" text, "featuredImage" character varying(1024), "publishOn" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "authorId" integer, CONSTRAINT "UQ_cd1bddce36edc3e766798eab376" UNIQUE ("slug"), CONSTRAINT "PK_be5fda3aac270b134ff9c21cdee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('user', 'editor', 'author', 'admin')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "firstName" character varying(96) NOT NULL, "lastName" character varying(96), "email" character varying(96) NOT NULL, "password" character varying(96), "googleId" character varying, "avatarUrl" character varying(2048), "bio" text, "role" "public"."user_role_enum" NOT NULL DEFAULT 'user', "isEmailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character varying(128), "emailVerificationTokenExpiry" TIMESTAMP WITH TIME ZONE, "passwordResetToken" character varying(128), "passwordResetTokenExpiry" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "avatar_option" ("id" SERIAL NOT NULL, "url" character varying(2048) NOT NULL, "publicId" character varying(256) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f95d5900a5d70926e97130c0cdb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "contact_submission" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "email" character varying(254) NOT NULL, "subject" character varying(200) NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_105f8b67ed7acaf8a8d794e3619" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "userId" integer, "action" character varying(32) NOT NULL, "entity" character varying(64) NOT NULL, "entityId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "post_tags_tag" ("postId" integer NOT NULL, "tagId" integer NOT NULL, CONSTRAINT "PK_e9b7b8e6a07bdccb6a954171676" PRIMARY KEY ("postId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b651178cc41334544a7a9601c4" ON "post_tags_tag"  ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_41e7626b9cc03c5c65812ae55e" ON "post_tags_tag"  ("tagId") `);
        await queryRunner.query(`ALTER TABLE "meta_option" ADD CONSTRAINT "FK_b492d76365f19dffc4d60a7f863" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "upload_file" ADD CONSTRAINT "FK_4cd0cae97752673f0c17addca27" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "upload_file" ADD CONSTRAINT "FK_54ead74a8a53870dd6a0da01e3d" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_c6fb082a3114f35d0cc27c518e0" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags_tag" ADD CONSTRAINT "FK_b651178cc41334544a7a9601c45" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "post_tags_tag" ADD CONSTRAINT "FK_41e7626b9cc03c5c65812ae55e8" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_tags_tag" DROP CONSTRAINT "FK_41e7626b9cc03c5c65812ae55e8"`);
        await queryRunner.query(`ALTER TABLE "post_tags_tag" DROP CONSTRAINT "FK_b651178cc41334544a7a9601c45"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_c6fb082a3114f35d0cc27c518e0"`);
        await queryRunner.query(`ALTER TABLE "upload_file" DROP CONSTRAINT "FK_54ead74a8a53870dd6a0da01e3d"`);
        await queryRunner.query(`ALTER TABLE "upload_file" DROP CONSTRAINT "FK_4cd0cae97752673f0c17addca27"`);
        await queryRunner.query(`ALTER TABLE "meta_option" DROP CONSTRAINT "FK_b492d76365f19dffc4d60a7f863"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41e7626b9cc03c5c65812ae55e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b651178cc41334544a7a9601c4"`);
        await queryRunner.query(`DROP TABLE "post_tags_tag"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TABLE "contact_submission"`);
        await queryRunner.query(`DROP TABLE "avatar_option"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`DROP TABLE "post"`);
        await queryRunner.query(`DROP TYPE "public"."post_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."post_posttype_enum"`);
        await queryRunner.query(`DROP TABLE "upload_file"`);
        await queryRunner.query(`DROP TYPE "public"."upload_file_type_enum"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`DROP TABLE "meta_option"`);
    }

}

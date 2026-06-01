import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class MetaOption {
  // id
  @PrimaryGeneratedColumn()
  id!: number
  // meta value
  @Column({
    type: 'json',
    nullable: false,
  })
  metaValue!: string
  // create date
  @CreateDateColumn()
  createDate!: Date
  // update date
  @UpdateDateColumn()
  updateDate!: Date
}

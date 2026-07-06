import { ApiProperty } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class ContactSubmission {
  // id
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number
  // sender name
  @ApiProperty({ example: 'Ada Lovelace' })
  @Column({ type: 'varchar', length: 100 })
  name!: string
  // sender email
  @ApiProperty({ example: 'ada@example.com' })
  @Column({ type: 'varchar', length: 254 })
  email!: string
  // message subject
  @ApiProperty({ example: 'Project inquiry' })
  @Column({ type: 'varchar', length: 200 })
  subject!: string
  // message body
  @ApiProperty({ example: "I'd like to discuss a collaboration." })
  @Column({ type: 'text' })
  message!: string
  // submission timestamp
  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date
  // last-modified timestamp — updated when an admin toggles `handled`
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date
  // whether an admin has reviewed this submission
  @ApiProperty({ example: false })
  @Column({ type: 'boolean', default: false })
  handled!: boolean
}

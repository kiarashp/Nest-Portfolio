import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity()
export class ContactSubmission {
  // id
  @PrimaryGeneratedColumn()
  id!: number
  // sender name
  @Column({ type: 'varchar', length: 100 })
  name!: string
  // sender email
  @Column({ type: 'varchar', length: 254 })
  email!: string
  // message subject
  @Column({ type: 'varchar', length: 200 })
  subject!: string
  // message body
  @Column({ type: 'text' })
  message!: string
  // submission timestamp
  @CreateDateColumn()
  createdAt!: Date
}

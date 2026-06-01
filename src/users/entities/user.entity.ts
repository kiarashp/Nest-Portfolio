import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class User {
  // Id
  @PrimaryGeneratedColumn()
  id!: number
  //   First name
  @Column({
    type: 'varchar',
    length: 96,
    nullable: false,
  })
  firstName!: string
  //   Last name
  @Column({
    type: 'varchar',
    length: 96,
    nullable: true,
  })
  lastName!: string | null
  //   Email
  @Column({
    type: 'varchar',
    length: 96,
    nullable: false,
    unique: true,
  })
  email!: string
  //   Password
  @Column({
    type: 'varchar',
    length: 96,
    nullable: false,
  })
  password!: string
}

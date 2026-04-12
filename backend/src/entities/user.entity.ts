import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Session } from "./session.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** EIP-55 checksummed address */
  @Column({ type: "varchar", length: 42, unique: true })
  walletAddress!: string;

  @CreateDateColumn({ type: "timestamptz" })
  registeredAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => Session, (s) => s.user)
  sessions!: Session[];
}

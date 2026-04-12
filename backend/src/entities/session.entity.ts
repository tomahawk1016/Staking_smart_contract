import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity({ name: "sessions" })
export class Session {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (u) => u.sessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  /** Matches JWT `jti` */
  @Column({ type: "varchar", length: 64, unique: true })
  jti!: string;

  @CreateDateColumn({ type: "timestamptz" })
  loginAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  logoutAt!: Date | null;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';

import { User } from '.';
import { Constants } from '../constants';

@Entity()
@Unique(['client_nonce', 'server_nonce', 'remote_ip'])
export class Challenge {

  @PrimaryGeneratedColumn()
  challenge_id: number;

  @Column('char', {length: Constants.NONCE_LENGTH * 2})
  client_nonce: string;

  @Column('char', {length: Constants.NONCE_LENGTH * 2})
  server_nonce: string;

  @Column({length: 45})
  remote_ip: string;

  @ManyToOne(type => User, user => user.challenges)
  user: User;

  @Column('bigint')
  expiration: string;

}

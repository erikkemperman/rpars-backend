import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';

import { User } from '.';
import { Constants } from '../constants';

@Entity()
@Unique(['session_token'])
export class Session {

    @PrimaryGeneratedColumn()
    session_id: number;

    @Column('char', {length: Constants.NONCE_LENGTH * 2})
    session_token: string;

    @ManyToOne(type => User, user => user.sessions)
    user: User;

    @Column('bigint')
    expiration: string;

}

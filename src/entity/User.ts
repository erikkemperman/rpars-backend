import { Entity, PrimaryGeneratedColumn, Column, Unique, OneToMany, ManyToOne, ManyToMany, JoinTable } from 'typeorm';

import { Constants } from '../constants';
import { Answer, Challenge, Group, Session, Key, OAuth, Oura } from '.';


@Entity()
@Unique(['email_hash'])
export class User {

    @PrimaryGeneratedColumn()
    user_id: number;

    @Column()
    admin: boolean;

    @Column('varchar')
    email: string;

    // multiply by 2 to get # hex chars
    @Column('char', {length: Constants.HASH_LENGTH * 2})
    email_hash: string;

    @Column('char', {length: Constants.HASH_LENGTH * 2})
    client_key: string;

    @Column('char', {length: Constants.HASH_LENGTH * 2})
    server_key: string;

    @Column('char', {length: Constants.NONCE_LENGTH * 2})
    client_salt: string;

    @Column()
    iterations: number;

    @OneToMany(type => Challenge, challenge => challenge.user)
    challenges: Promise<Challenge[]>;

    @OneToMany(type => Session, session => session.user)
    sessions: Promise<Session[]>;

    @OneToMany(type => Key, key => key.user)
    keys: Promise<Key[]>;

    @ManyToMany(() => OAuth)
    @JoinTable()
    oauths: OAuth[];

    @OneToMany(type => Oura, oura => oura.user)
    ouras: Promise<Oura[]>;

    @ManyToOne(type => Group, group => group.users)
    group: Group;

    @OneToMany(type => Answer, answer => answer.user)
    answers: Promise<Answer[]>;
}

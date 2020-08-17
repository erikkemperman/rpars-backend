//[email_hash, type, year, month, day, seq, JSON.stringify(row)]

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';

import { User, Key } from '.';

@Entity()
@Unique(['user', 'key', 'type', 'date', 'seq'])
export class Oura {

    @PrimaryGeneratedColumn()
    oura_id: number;

    @ManyToOne(type => User, user => user.ouras)
    user: User;

    @ManyToOne(type => Key, key => key.ouras)
    key: Key;

    @Column({length: 10})
    type: string;

    @Column('char', {length: 10})
    date: string;

    @Column()
    seq: number;

    @Column('text')
    value: string;

}
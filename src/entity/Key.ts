import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

import { User } from '.';

@Entity()
export class Key {

    @PrimaryGeneratedColumn()
    key_id: number;

    @ManyToOne(type => User, user => user.keys)
    user: User;

    @Column('text')
    public_key: string;



}

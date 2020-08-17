import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

import { User } from '.';

@Entity()
export class OAuth {

    @PrimaryGeneratedColumn()
    oauth_id: number;

    @ManyToOne(type => User, user => user.oauths)
    user: User;

    @Column()
    provider: string;

    @Column()
    scope: string;

    @Column()
    token: string;

    @Column()
    refresh: string;

    @Column('bigint')
    expiration: string;
}
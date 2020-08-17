import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';

import { User, Oura } from '.';

@Entity()
export class Key {

    @PrimaryGeneratedColumn()
    key_id: number;

    @ManyToOne(type => User, user => user.keys)
    user: User;

    @Column('text')
    public_key: string;

    @OneToMany(type => Oura, oura => oura.user)
    ouras: Promise<Oura[]>;

}

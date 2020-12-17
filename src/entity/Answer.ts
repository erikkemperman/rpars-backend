import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';

import { User } from '.';

@Entity()
@Unique(['user', 'date', 'key'])
export class Answer {

    @PrimaryGeneratedColumn()
    answer_id: number;

    @ManyToOne(type => User, user => user.answers)
    user: User;

    @Column('char', {length: 10})
    date: string;

    @Column('varchar', {length: 92})
    key: string;

    @Column('varchar', {length: 255})
    title: string;

    @Column('varchar', {length: 255})
    subtitle: string;

    @Column('text')
    content: string;

    @Column('bigint')
    time: string;

    @Column('bigint')
    expire: string;

    @Column('text')
    options: string;

    @Column('tinyint')
    answer: number;

}
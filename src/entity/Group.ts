import { Entity, PrimaryGeneratedColumn, Column, Unique, OneToMany, ManyToOne } from 'typeorm';

import { Project, User } from '.';

@Entity()
@Unique(['project', 'group_name'])
export class Group {

    @PrimaryGeneratedColumn()
    group_id: number;

    @Column('varchar', {length: 128})
    group_name: string;

    @ManyToOne(type => Project, project => project.groups)
    project: Project

    @OneToMany(type => User, user => user.group)
    users: Promise<User[]>;
}
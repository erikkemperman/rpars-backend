import { Entity, PrimaryGeneratedColumn, Column, Unique, OneToOne, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

import { Project, User, Script } from '.';

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

    @OneToOne(() => Script)
    @JoinColumn()
    script: Script;
}
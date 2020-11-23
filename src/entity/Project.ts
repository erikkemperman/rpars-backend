import { Entity, PrimaryGeneratedColumn, Column, Unique, OneToMany } from 'typeorm';

import { Group } from '.';

@Entity()
@Unique(['project_name'])
export class Project {

    @PrimaryGeneratedColumn()
    project_id: number;

    @Column('varchar', {length: 128})
    project_name: string;

    @OneToMany(type => Group, group => group.project)
    groups: Promise<Group[]>;
}
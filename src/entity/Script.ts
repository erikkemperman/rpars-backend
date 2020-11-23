
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

import { Group } from '.';

@Entity()
export class Script {

    @PrimaryGeneratedColumn()
    script_id: number;

    @Column('text')
    source: string;

    @Column()
    locked: boolean;

}
import { EventArgs } from "./queue";
import { Entity } from "./entity";
import { TankerEventArgs } from "./tanker";
import { globalTimeProvider } from "./gloabalTime";
import { Tow } from "./tow";
import * as _ from "lodash";
import { ProcessingLine } from "./processingLine";

export class StatisticsManager {
    public tankerCount: number = 0;
    public tankerStatistics: TankerStatistics[] = [];
    public towStatistics: TowStatistics[] = [];
    public processingLineStatistics: ProcessingLineStatistics[] = [];

    public handleQueueEvent(args: EventArgs<Entity>) {
        if (args instanceof TankerEventArgs) {
        } else if (args.entity instanceof Tow) {
            const towStats = this.getOrCreateTowStatistics(args.entity.id);
            const previousState = _(towStats.states).last();
            const previousStateTime = previousState ? previousState.time : 0;

            if (previousState != null) {
                previousState.duration = globalTimeProvider.globalTime - previousStateTime;
            }

            towStats.states.push(new State(args.state.toString(), globalTimeProvider.globalTime));
        } else if (args.entity instanceof ProcessingLine) {
            const processingLineStats = this.getOrCreateProcessingLineStatistics(args.entity.id);
            const previousState = _(processingLineStats.states).last();
            const previousStateTime = previousState ? previousState.time : 0;

            if (previousState != null) {
                previousState.duration = globalTimeProvider.globalTime - previousStateTime;
            }

            processingLineStats.states.push(new State(args.state.toString(), globalTimeProvider.globalTime));
        }
    }

    private getOrCreateTowStatistics(towId: number): TowStatistics {
        return ServingEntityStatistics.createFrom(this.getOrCreateEntityStatistics(towId, this.towStatistics));
    }

    private getOrCreateProcessingLineStatistics(processingLineId: number): ProcessingLineStatistics {
        return ServingEntityStatistics.createFrom(this.getOrCreateEntityStatistics(processingLineId, this.processingLineStatistics));
    }

    private getOrCreateEntityStatistics(entityId: number, source: ServingEntityStatistics[]): ServingEntityStatistics {
        let entity = _(source)
            .filter(s => s.id == entityId)
            .value()[0];

        if (entity != null) {
            return entity;
        }

        entity = new ServingEntityStatistics(entityId);
        source.push(entity);

        return entity;
    }
}

export class EntityStatistics {
    public get id(): number {
        return this._id;
    }

    constructor(private _id: number) {}
}

export class ServingEntityStatistics extends EntityStatistics {
    public states: State[];
    constructor(id: number) {
        super(id);

        this.states = [];
    }

    public static createFrom(source: EntityStatistics): ServingEntityStatistics {
        return new ServingEntityStatistics(source.id);
    }
}

export class TowStatistics extends ServingEntityStatistics {}
export class ProcessingLineStatistics extends ServingEntityStatistics {}

export class TankerStatistics extends EntityStatistics {
    public workingTime: number;
    public idleTime: number;
}

export class State {
    public name: string;
    public duration: number;
    public time: number;

    constructor(name: string, time: number) {
        this.name = name;
        this.time = time;
    }
}

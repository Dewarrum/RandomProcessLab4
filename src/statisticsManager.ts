import { EventArgs, Queue, QueueEventState } from "./queue";
import { Entity } from "./entity";
import { TankerEventArgs } from "./tanker";
import { globalTimeProvider } from "./gloabalTime";
import { Tow } from "./tow";
import * as _ from "lodash";
import { ProcessingLine } from "./processingLine";
import * as helpers from "./helpers";

export class StatisticsManager {
    public tankerCount: number = 0;
    public processedTankerCount: number = 0;
    public unprocessedTankerCount: number = 0;
    public tankerStatistics: TankerStatistics[] = [];
    public towStatistics: TowStatistics[] = [];
    public processingLineStatistics: ProcessingLineStatistics[] = [];
    public tankerLifecycles: TankerLifecycle[] = [];

    public handleQueueEvent(args: EventArgs<Entity>) {
        if (args instanceof TankerEventArgs) {
            const tanker = args.entity;
            const lifecycle = this.getOrCreateTankerLifecycle(tanker.id, this.tankerLifecycles);
            switch (args.state) {
                case QueueEventState.LeftSystem: {
                    this.processedTankerCount++;
                    helpers.logFireEvent(`Tanker #${tanker.id} left system at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.leftSystemAt = args.time;
                    lifecycle.towProcessTime += lifecycle.leftSystemAt - lifecycle.dispatchedByTowAt;

                    break;
                }
                case QueueEventState.InQueue: {
                    this.tankerCount++;
                    helpers.logFireEvent(`Tanker #${tanker.id} entered queue at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.enteredSystemAt = args.time;

                    break;
                }
                case QueueEventState.ProcessedByTow: {
                    helpers.logFireEvent(`Tanker #${tanker.id} left queue at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.processedByTowAt = args.time;
                    lifecycle.timeInQueue += lifecycle.processedByTowAt - lifecycle.enteredSystemAt;

                    break;
                }
                case QueueEventState.ProcessedByLine: {
                    helpers.logFireEvent(`Tanker #${tanker.id} entered processing line at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.processedByLineAt = args.time;
                    lifecycle.towProcessTime += lifecycle.processedByLineAt - lifecycle.processedByTowAt;

                    break;
                }
                case QueueEventState.DispatchedByTow: {
                    helpers.logFireEvent(`Tanker #${tanker.id} has been dispatched at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.dispatchedByTowAt = args.time;
                    lifecycle.timeOnProcessLine += lifecycle.dispatchedByTowAt - lifecycle.processedByLineAt;

                    break;
                }
            }
        } else if (args.entity instanceof Tow) {
            const towStats = this.getOrCreateTowStatistics(args.entity.id);
            const previousState = _(towStats.states).last();
            const previousStateTime = previousState ? previousState.time : 0;

            if (previousState != null) {
                previousState.duration = globalTimeProvider.globalTime - previousStateTime;
            }

            towStats.states.push(new State(args.state.toString(), globalTimeProvider.globalTime));

            if (args.state == QueueEventState.Idle) {
                helpers.logFireEvent(`Tow #${args.entity.id} got free at ${helpers.convertSecondsToHours(args.time)} h.`);
            } else {
                helpers.logFireEvent(`Tow #${args.entity.id} went to work at ${helpers.convertSecondsToHours(args.time)} h.`);
            }
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

    public processCollectedData(): void {
        _(this.processingLineStatistics).each(statistics => {
            const lastState = _(statistics.states).last();
            lastState.duration = globalTimeProvider.globalTime - lastState.time;

            statistics.idleTime = _(statistics.states)
                .filter(s => s.name == QueueEventState.Idle.toString())
                .map(s => s.duration)
                .sum();

            statistics.workingTime = _(statistics.states)
                .filter(s => s.name == QueueEventState.Working.toString())
                .map(s => s.duration)
                .sum();
        });

        _(this.towStatistics).each(statistics => {
            const lastState = _(statistics.states).last();
            lastState.duration = globalTimeProvider.globalTime - lastState.time;

            statistics.idleTime = _(statistics.states)
                .filter(s => s.name == QueueEventState.Idle.toString())
                .map(s => s.duration)
                .sum();

            statistics.workingTime = _(statistics.states)
                .filter(s => s.name == QueueEventState.Working.toString())
                .map(s => s.duration)
                .sum();
        });

        this.unprocessedTankerCount = this.tankerCount - this.processedTankerCount;
        _(this.tankerStatistics).each(statistics => {});
    }

    private getOrCreateTowStatistics(towId: number): TowStatistics {
        return this.getOrCreateEntityStatistics(towId, this.towStatistics);
    }

    private getOrCreateProcessingLineStatistics(processingLineId: number): ProcessingLineStatistics {
        return this.getOrCreateEntityStatistics(processingLineId, this.processingLineStatistics);
    }

    private getOrCreateEntityStatistics(entityId: number, source: ServingEntityStatistics[]): ServingEntityStatistics {
        let entity = source.filter(s => s.id == entityId)[0];

        if (entity != null) {
            return entity;
        }

        entity = new ServingEntityStatistics(entityId);
        source.push(entity);

        return entity;
    }

    private getOrCreateTankerLifecycle(tankerId: number, source: TankerLifecycle[]): TankerLifecycle {
        let lifecycle = source.filter(s => s.tankerId == tankerId)[0];

        if (lifecycle != null) {
            return lifecycle;
        }

        lifecycle = new TankerLifecycle(tankerId);
        source.push(lifecycle);

        return lifecycle;
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
    public idleTime: number;
    public workingTime: number;

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

export class TankerLifecycle {
    public enteredSystemAt: number;
    public processedByTowAt: number;
    public processedByLineAt: number;
    public dispatchedByTowAt: number;
    public leftSystemAt: number;
    public timeInQueue: number = 0;
    public towProcessTime: number = 0;
    public timeOnProcessLine: number = 0;
    public get tankerId(): number {
        return this._tankerId;
    }

    constructor(private _tankerId: number) {}
}

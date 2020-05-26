import { EventArgs, Queue, QueueEventState } from "./queue";
import { Entity } from "./entity";
import { TankerEventArgs } from "./tanker";
import { globalTimeProvider } from "./gloabalTime";
import { Tow } from "./tow";
import * as _ from "lodash";
import { ProcessingLine } from "./processingLine";
import * as helpers from "./helpers";
import { BusynessManager, BusynessState } from "./busynessManager";

export class StatisticsManager {
    private _queueLength: number = 0;

    public tankerCount: number = 0;
    public processedTankerCount: number = 0;
    public unprocessedTankerCount: number = 0;

    public tankerStatistics: TankerStatistics[] = [];
    public towStatistics: TowStatistics[] = [];
    public processingLineStatistics: ProcessingLineStatistics[] = [];
    public tankerLifecycles: TankerLifecycle[] = [];

    public queueStates: QueueState[] = [];

    public timeInQueueHistogramData: HistogramData;
    public processingTimeHistogramData: HistogramData;
    public timeWhileStuckInLineHistogramData: HistogramData;

    public processingLinesLoadData: BusynessState[];
    public towLoadData: BusynessState[];
    public queueLengthData: BusynessState[];

    public tankerAverages: TankerAverages = new TankerAverages();

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
                    lifecycle.hasBeenProcessed = true;
                    lifecycle.timeInSystem += lifecycle.leftSystemAt - lifecycle.enteredSystemAt;

                    break;
                }
                case QueueEventState.InQueue: {
                    this.tankerCount++;
                    helpers.logFireEvent(`Tanker #${tanker.id} entered queue at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.enteredSystemAt = args.time;

                    const queueState = new QueueState();
                    queueState.time = globalTimeProvider.globalTime;
                    this._queueLength++;
                    queueState.queueLength = this._queueLength;

                    this.queueStates.push(queueState);

                    break;
                }
                case QueueEventState.ProcessedByTow: {
                    helpers.logFireEvent(`Tanker #${tanker.id} left queue at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.processedByTowAt = args.time;
                    lifecycle.timeInQueue += lifecycle.processedByTowAt - lifecycle.enteredSystemAt;

                    const queueState = new QueueState();
                    queueState.time = globalTimeProvider.globalTime;
                    this._queueLength--;
                    queueState.queueLength = this._queueLength;

                    this.queueStates.push(queueState);

                    break;
                }
                case QueueEventState.ProcessedByLine: {
                    helpers.logFireEvent(`Tanker #${tanker.id} entered processing line at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.processedByLineAt = args.time;
                    lifecycle.towProcessTime += lifecycle.processedByLineAt - lifecycle.processedByTowAt;

                    break;
                }
                case QueueEventState.StuckInProcessingLine: {
                    helpers.logFireEvent(`Tanker #${tanker.id} stuck in processing line at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.stuckInProcessingLineAt = globalTimeProvider.globalTime;
                    lifecycle.towProcessTime += lifecycle.processedByLineAt - lifecycle.processedByTowAt;

                    break;
                }
                case QueueEventState.DispatchedByTow: {
                    helpers.logFireEvent(`Tanker #${tanker.id} has been dispatched at ${helpers.convertSecondsToHours(args.time)} h.`);

                    lifecycle.dispatchedByTowAt = args.time;

                    if (lifecycle.stuckInProcessingLineAt) {
                        lifecycle.timeOnProcessLine += lifecycle.stuckInProcessingLineAt - lifecycle.processedByLineAt;
                        lifecycle.timeWhileStuckInProcessingLine += lifecycle.dispatchedByTowAt - lifecycle.stuckInProcessingLineAt;
                    } else {
                        lifecycle.timeOnProcessLine += lifecycle.dispatchedByTowAt - lifecycle.processedByLineAt;
                    }

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

            if (args.state == QueueEventState.Idle) {
                helpers.logFireEvent(`Processing Line #${args.entity.id} got free at ${helpers.convertSecondsToHours(args.time)} h.`);
            } else {
                helpers.logFireEvent(`Processing Line #${args.entity.id} went to work at ${helpers.convertSecondsToHours(args.time)} h.`);
            }
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

        {
            const statesIds = _(this.processingLineStatistics)
                .flatMap(s => {
                    return s.states.map(st => {
                        return { state: st, id: s.id };
                    });
                })
                .sortBy(s => s.state.time)
                .value();

            this.processingLinesLoadData = BusynessManager.convertToBusynessStates(statesIds);
        }

        {
            const stateIds = _(this.towStatistics)
                .flatMap(s => {
                    return s.states.map(st => {
                        return { state: st, id: s.id };
                    });
                })
                .sortBy(s => s.state.time)
                .value();

            globalThis.isTow = true;

            this.towLoadData = BusynessManager.convertTowToBusynessStates(stateIds);
        }

        {
            this.queueLengthData = [];

            const initialState = new QueueState();
            initialState.queueLength = 0;
            initialState.time = 0;

            this.queueStates.unshift(initialState);

            groupSameTimeStates(this.queueStates).forEach(sg => {
                const state = new BusynessState();

                state.startTime = _(sg).first().time;
                state.loadPercent = _(sg)
                    .sortBy(s => s.queueLength)
                    .first().queueLength;

                this.queueLengthData.push(state);
            });
        }

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

        _(this.tankerLifecycles)
            .chain()
            .filter(l => !l.hasBeenProcessed)
            .each(lifecycle => {
                lifecycle.timeInSystem = globalTimeProvider.globalTime - lifecycle.enteredSystemAt;

                if (lifecycle.processedByLineAt) {
                    lifecycle.timeInQueue = lifecycle.processedByLineAt - lifecycle.enteredSystemAt;
                } else {
                    lifecycle.timeInQueue = globalTimeProvider.globalTime - lifecycle.enteredSystemAt;
                }
            })
            .value();

        this.unprocessedTankerCount = this.tankerCount - this.processedTankerCount;

        this.tankerAverages.timeInQueue =
            _(this.tankerLifecycles).filter(l => l.hasBeenProcessed).reduce((memo, t) => memo + t.timeInQueue, 0) / this.tankerLifecycles.filter(l => l.hasBeenProcessed).length;

        this.tankerAverages.timeWhileStuckInLine =
            _(this.tankerLifecycles).filter(l => l.hasBeenProcessed).reduce((memo, t) => memo + t.timeWhileStuckInProcessingLine, 0) / this.tankerLifecycles.filter(l => l.hasBeenProcessed).length;

        this.tankerAverages.processingTime =
            _(this.tankerLifecycles).filter(l => l.hasBeenProcessed).reduce((memo, t) => memo + t.timeOnProcessLine, 0) / this.tankerLifecycles.filter(l => l.hasBeenProcessed).length;

        const maxTimeInQueue = _(this.tankerLifecycles)
            .chain()
            .sortBy(l => l.timeInQueue)
            .last()
            .value().timeInQueue;

        this.timeInQueueHistogramData = this.calculateHistogramData(
            this.tankerLifecycles.map(l => l.timeInQueue),
            0,
            maxTimeInQueue,
            10
        );

        const maxProcessingTime = _(this.tankerLifecycles)
            .chain()
            .sortBy(l => l.timeOnProcessLine)
            .last()
            .value().timeOnProcessLine;

        this.processingTimeHistogramData = this.calculateHistogramData(
            this.tankerLifecycles.map(l => l.timeOnProcessLine),
            0,
            maxProcessingTime,
            10
        );

        const maxTimeWhileStuckInLine = _(this.tankerLifecycles)
            .chain()
            .sortBy(l => l.timeWhileStuckInProcessingLine)
            .last()
            .value().timeWhileStuckInProcessingLine;

        this.timeWhileStuckInLineHistogramData = this.calculateHistogramData(
            this.tankerLifecycles.map(l => l.timeWhileStuckInProcessingLine),
            0,
            maxTimeWhileStuckInLine,
            10
        );
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

    private calculateHistogramData(data: number[], minX: number, maxX: number, intervalCount: number): HistogramData {
        const histogramData = new HistogramData();
        histogramData.start = minX;
        histogramData.end = maxX;

        const step = (maxX - minX) / intervalCount;

        let currentOffset = minX;
        for (let i = 0; i < intervalCount; i++, currentOffset += step) {
            const item = new HistogramItem();
            item.start = currentOffset;
            item.end = currentOffset + step;

            histogramData.items.push(item);
        }

        _(data).each(d => {
            const histogramItem = histogramData.getItemAt(d);
            histogramItem.height++;
        });

        return histogramData;
    }
}

function groupSameTimeStates(source: QueueState[]): QueueState[][] {
    const result: QueueState[][] = [];

    let currentTime = source[0].time;
    let batch: QueueState[] = [];

    source.forEach(s => {
        if (s.time === currentTime) {
            batch.push(s);
        } else {
            result.push(batch);

            currentTime = s.time;
            batch = [s];
        }
    });

    return result;
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
    public stuckInProcessingLineAt: number;
    public dispatchedByTowAt: number;
    public leftSystemAt: number;

    public timeInQueue: number = 0;
    public towProcessTime: number = 0;
    public timeOnProcessLine: number = 0;
    public timeWhileStuckInProcessingLine: number = 0;
    public timeInSystem: number = 0;
    public hasBeenProcessed: boolean = false;
    public get tankerId(): number {
        return this._tankerId;
    }

    constructor(private _tankerId: number) {}
}

export class TankerAverages {
    public timeInQueue: number;
    public timeWhileStuckInLine: number;
    public processingTime: number;
}

export class HistogramData {
    public items: HistogramItem[] = [];
    public start: number;
    public end: number;

    public getItemAt(x: number): HistogramItem {
        const result = this.items.filter(i => i.start - 1e-4 <= x && x < i.end + 1e-4)[0];

        if (result == null) {
            throw new Error(`Argument out of range: x = ${x}, range = [${this.start}:${this.end}]`);
        }

        return result;
    }
}

export class HistogramItem {
    public start: number;
    public end: number;
    public height: number = 0;
}

class QueueState {
    public time: number;
    public queueLength: number;
}

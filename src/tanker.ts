import { Entity } from "./entity";
import { PortEvent } from "./portEvent";
import { EntityGenerator } from "./entityGenerator";
import { EventQueue, EventService, Queue, EventArgs, QueueEventState } from "./queue";
import { EvenRandomValueGenerator, EvenRandomValueGeneratorArgs } from "./randomValueGenerator";
import { globalTimeProvider } from "./gloabalTime";
import * as _ from "lodash";
import { ProcessingLine } from "./processingLine";
import { Tow } from "./tow";
import { Intensity } from "./appConfig";

export class Tanker extends Entity {
    public processingLine: ProcessingLine;
    public tow: Tow;
}

export class TankerEvent extends PortEvent {
    public processingLine: ProcessingLine;
    public get type(): EventType {
        return this._type;
    }

    public get tanker(): Tanker {
        return this._tanker;
    }

    constructor(estimatedTime: number, private _type: EventType, private _tanker: Tanker) {
        super(estimatedTime);
    }
}

export class TankerEventArgs extends EventArgs<Tanker> {}

export enum EventType {
    ArrivedNew = "Arraved New",
    HasBeenProcessed = "Has Been Attached to Tow",
    StartedRefill = "Started Refill",
    FinishedRefill = "Finished Refill",
    LeftSystem = "Left System"
}

export class TankerGenerator extends EntityGenerator<Tanker> {
    constructor() {
        super(Tanker);
    }
}

export class TankerEventQueue extends EventQueue<TankerEvent> {
    public randomValueGeneratorArgs: EvenRandomValueGeneratorArgs;

    constructor() {
        const randomNumberGenerator = new EvenRandomValueGenerator();
        super(() => randomNumberGenerator.next(this.randomValueGeneratorArgs));
    }
}

export class TankerQueue extends Queue<Tanker> {
    private _queuedTankers: Tanker[] = [];
    private _processedByTowTankers: Tanker[] = [];
    private _processedByLineTankers: Tanker[] = [];
    private _stuckInProcessingLineTankers: Tanker[] = [];
    private _dispatchedByTowTankers: Tanker[] = [];

    public push(tanker: Tanker): void {
        throw new Error("Do not use this method.");
    }

    public pop(): Tanker {
        throw new Error("Do not use this method.");
    }

    public any(): boolean {
        return this._queuedTankers.length > 0;
    }

    public anyStuckInProcessingLine(): boolean {
        return this._stuckInProcessingLineTankers.length > 0;
    }

    public first(): Tanker {
        return this._queuedTankers[0];
    }

    public firstStuckInProcessingLine(): Tanker {
        return this._stuckInProcessingLineTankers[0];
    }

    public enqueue(tanker: Tanker): void {
        this._queuedTankers.push(tanker);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.InQueue));
    }

    public processByTow(tankerId: number): void {
        const tanker = this.getTankerFrom(tankerId, this._queuedTankers);
        this._processedByTowTankers.push(tanker);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.ProcessedByTow));
    }

    public processByLine(tankerId: number): void {
        const tanker = this.getTankerFrom(tankerId, this._processedByTowTankers);
        this._processedByLineTankers.push(tanker);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.ProcessedByLine));
    }

    public stuckInProcessingLine(tankerId: number): void {
        const tanker = this.getTankerFrom(tankerId, this._processedByLineTankers);
        this._stuckInProcessingLineTankers.push(tanker);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.StuckInProcessingLine));
    }

    public dispatchByTow(tankerId: number): void {
        const tanker = this.getTankerFrom(tankerId, this._processedByLineTankers);
        this._dispatchedByTowTankers.push(tanker);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.DispatchedByTow));
    }

    public dispatchStuckInLineByTow(tankerId: number): void {
        const tanker = this.getTankerFrom(tankerId, this._stuckInProcessingLineTankers);
        this._dispatchedByTowTankers.push(tanker);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.DispatchedByTow));
    }

    public removeFromSystem(tankerId: number): void {
        const tanker = this.getTankerFrom(tankerId, this._dispatchedByTowTankers);

        this.onPushEvent.invoke(new TankerEventArgs(tanker, globalTimeProvider.globalTime, QueueEventState.LeftSystem));
    }

    private getTankerFrom(tankerId: number, source: Tanker[]): Tanker {
        const tanker = _(source.filter(t => t.id == tankerId)).first();

        if (tanker == null) throw new Error(`Tanker with ${tankerId} id could not be found.`);

        const indexToDelete = _(source).findIndex(t => t.id == tankerId);
        source.splice(indexToDelete, 1);

        return tanker;
    }
}

export class TankerEventService extends EventService {
    private rngArgs: EvenRandomValueGeneratorArgs;
    private rng: EvenRandomValueGenerator;

    public intensity: Intensity;

    constructor() {
        super(() => this.rng.next(this.rngArgs));
    }

    public setSettings(intensity: Intensity): void {
        this.intensity = intensity;

        const start = this.intensity.start; // In seconds
        const end = this.intensity.end;

        this.rngArgs = new EvenRandomValueGeneratorArgs(start, end);
        this.rng = new EvenRandomValueGenerator();
    }
}

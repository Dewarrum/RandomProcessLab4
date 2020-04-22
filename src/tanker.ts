import { Entity } from "./entity";
import { PortEvent } from "./portEvent";
import { EntityGenerator } from "./entityGenerator";
import { EventQueue, EventService, Queue, EventArgs } from "./queue";
import { EvenRandomValueGenerator, EvenRandomValueGeneratorArgs } from "./randomValueGenerator";

export class Tanker extends Entity {}

export class TankerEvent extends PortEvent {
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
    Add,
    Get
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

export class TankerQueue extends Queue<Tanker> {}

export class TankerEventService extends EventService {
    private rngArgs: EvenRandomValueGeneratorArgs;
    private rng: EvenRandomValueGenerator;

    constructor() {
        super(() => this.rng.next(this.rngArgs));

        const start = 60 * 60 * 4; // In seconds
        const end = 60 * 60 * 18;

        this.rngArgs = new EvenRandomValueGeneratorArgs(start, end);
        this.rng = new EvenRandomValueGenerator();
    }
}

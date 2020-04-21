import { Entity } from "./entity";
import { EntityGenerator } from "./entityGenerator";
import { PortEvent, EventType } from "./portEvent";
import { EventQueue, EventService, Queue } from "./queue";
import { EvenRandomValueGenerator, EvenRandomValueGeneratorArgs } from "./randomValueGenerator";

export class Tow extends Entity {}

export class TowEvent extends PortEvent {
    public get tow(): Tow {
        return this._tow;
    }

    constructor(estimatedTime: number, type: EventType, private _tow: Tow) {
        super(estimatedTime, type);
    }
}

export class TowGenerator extends EntityGenerator<Tow> {
    constructor() {
        super(Tow);
    }
}

export class TowEventQueue extends EventQueue<TowEvent> {
    public randomValueGeneratorArgs: EvenRandomValueGeneratorArgs;

    constructor() {
        const randomNumberGenerator = new EvenRandomValueGenerator();
        super(() => randomNumberGenerator.next(this.randomValueGeneratorArgs));
    }
}

export class TowQueue extends Queue<Tow> {}

export class TowEventService extends EventService {
    private rngArgs: EvenRandomValueGeneratorArgs;
    private rng: EvenRandomValueGenerator;

    constructor() {
        super(() => this.rng.next(this.rngArgs));

        const start = 60 * 60 * 1; // In seconds

        this.rngArgs = new EvenRandomValueGeneratorArgs(start, start);
        this.rng = new EvenRandomValueGenerator();
    }
}

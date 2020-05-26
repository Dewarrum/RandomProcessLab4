import { Entity } from "./entity";
import { EntityGenerator } from "./entityGenerator";
import { PortEvent } from "./portEvent";
import { EventQueue, EventService, Queue } from "./queue";
import { EvenRandomValueGenerator, EvenRandomValueGeneratorArgs } from "./randomValueGenerator";
import { Intensity } from "./appConfig";

export class Tow extends Entity {}

export class TowEvent extends PortEvent {
    public get tow(): Tow {
        return this._tow;
    }

    constructor(estimatedTime: number, private _tow: Tow) {
        super(estimatedTime);
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

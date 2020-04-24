import { Entity } from "./entity";
import { PortEvent } from "./portEvent";
import { EntityGenerator } from "./entityGenerator";
import { EventQueue, EventService, Queue } from "./queue";
import { EvenRandomValueGenerator, EvenRandomValueGeneratorArgs } from "./randomValueGenerator";

export class ProcessingLine extends Entity {}

export class ProcessingLineEvent extends PortEvent {
    public get processingLine(): ProcessingLine {
        return this._processingLine;
    }

    constructor(estimatedTime: number, private _processingLine: ProcessingLine) {
        super(estimatedTime);
    }
}

export class ProcessingLineGenerator extends EntityGenerator<ProcessingLine> {
    constructor() {
        super(ProcessingLine);
    }
}

export class ProcessingLineEventQueue extends EventQueue<ProcessingLineEvent> {
    public randomValueGeneratorArgs: EvenRandomValueGeneratorArgs;

    constructor() {
        const randomNumberGenerator = new EvenRandomValueGenerator();
        super(() => randomNumberGenerator.next(this.randomValueGeneratorArgs));
    }
}

export class ProcessingLineQueue extends Queue<ProcessingLine> {}

export class ProcessingLineEventService extends EventService {
    private rngArgs: EvenRandomValueGeneratorArgs;
    private rng: EvenRandomValueGenerator;

    constructor() {
        super(() => this.rng.next(this.rngArgs));

        const start = 60 * 60 * 3;
        const end = 60 * 60 * 3;

        this.rngArgs = new EvenRandomValueGeneratorArgs(start, end);
        this.rng = new EvenRandomValueGenerator();
    }
}

export class EvenRandomValueGeneratorArgs {
    public start: number;
    public end: number;

    constructor(start: number, end: number) {
        this.start = start;
        this.end = end;
    }
}

export class EvenRandomValueGenerator {
    next(args: EvenRandomValueGeneratorArgs): number {
        return Math.random() * (args.end - args.start) + args.start;
    }
}

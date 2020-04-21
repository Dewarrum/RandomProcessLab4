import { EventArgs } from "./queue";
import { Entity } from "./entity";
import { Tanker } from "./tanker";
import { globalTimeProvider } from "./gloabalTime";

export class StatisticsManager {
    public tankerCount: number = 0;
    public tankerStatistics: TankerStatistics[] = [];

    public handleQueueEvent(args: EventArgs<Entity>) {
        if (args.entity instanceof Tanker) {
            this.tankerCount++;
        }

        const tankerStats = this.getOrCreateTankerStatistics(args.entity.id);
        tankerStats.states.push();
    }

    private getOrCreateTankerStatistics(tankerId: number) {
        let tankerStats = this.tankerStatistics.filter(s => s.id == tankerId)[0];
        if (tankerStats) {
            return tankerStats;
        }

        tankerStats = new TankerStatistics(tankerId);
        this.tankerStatistics.push(tankerStats);

        return tankerStats;
    }
}

export class TankerStatistics {
    public workingTime: number;
    public idleTime: number;
    public states: State[];
    public get id(): number {
        return this._id;
    }

    constructor(private _id: number) {
        this.states = [];
    }

    public handleQueueEvent(args: EventArgs<Tanker>) {}
}

export class State {
    public name: string;
    public duration: number;

    constructor(name: string, duration: number) {
        this.name = name;
        this.duration = duration;
    }
}

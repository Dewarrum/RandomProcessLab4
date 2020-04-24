import { globalTimeProvider } from "./gloabalTime";
import { PortEvent } from "./portEvent";
import { Entity } from "./entity";
import { Event } from "./event";
import * as _ from "lodash";

export class EventArgs<T> {
    public get entity(): T {
        return this._entity;
    }
    public get time(): number {
        return this._time;
    }
    public get state(): QueueEventState {
        return this._state;
    }

    constructor(private _entity: T, private _time: number, private _state: QueueEventState) {}
}

export enum QueueEventState {
    Idle = "Idle",
    Working = "Working",
    InQueue = "In Queue",
    ProcessedByTow = "Processed by Tow",
    ProcessedByLine = "Processed by Line",
    DispatchedByTow = "Dispatched by Tow",
    LeftSystem = "Left System"
}

export class Queue<T> {
    protected _elements: T[] = [];

    public onPopEvent: Event<{ (args: EventArgs<T>): void }, EventArgs<T>> = new Event<{ (args: EventArgs<T>): void }, EventArgs<T>>();
    public onPushEvent: Event<{ (args: EventArgs<T>): void }, EventArgs<T>> = new Event<{ (args: EventArgs<T>): void }, EventArgs<T>>();

    public pop(): T {
        const element = this._elements.shift();
        this.onPopEvent.invoke(new EventArgs(element, globalTimeProvider.globalTime, QueueEventState.Working));

        return element;
    }

    public first(): T {
        return this._elements[this._elements.length - 1];
    }

    public push(element: T): void {
        if (element instanceof Entity && this._elements.filter(e => ((e as unknown) as Entity).id == element.id).length > 0) {
            throw new Error(`Entity with ${element.id} is already present in queue, cannot have same entity twice or more times at the same moment`);
        }

        this.onPushEvent.invoke(new EventArgs(element, globalTimeProvider.globalTime, QueueEventState.Idle));
        this._elements.push(element);
    }

    public any(): boolean {
        return this._elements.length != 0;
    }

    public count(): number {
        return this._elements.length;
    }
}

export class EventQueue<T extends PortEvent> extends Queue<T> {
    private _randomNumberProvider: () => number;

    constructor(randomNumberProvider: () => number) {
        super();

        this._randomNumberProvider = randomNumberProvider;
    }

    public calculateNextEventTime(): number {
        const eventEmitsIn = this._randomNumberProvider();
        const eventEmitsAt = globalTimeProvider.globalTime + eventEmitsIn;

        return eventEmitsAt;
    }
}

export class EventService {
    constructor(private _randomNumberProvider: () => number) {}

    public calculateNextEventTime(): number {
        const eventEmitsIn = this._randomNumberProvider();
        const eventEmitsAt = globalTimeProvider.globalTime + eventEmitsIn;

        return eventEmitsAt;
    }
}

export class StatisticsEvent<T extends Entity> {
    public get entity(): T {
        return this._entity;
    }
    public get globalTime(): number {
        return this._globalTime;
    }

    constructor(private _entity: T, private _globalTime: number) {}
}

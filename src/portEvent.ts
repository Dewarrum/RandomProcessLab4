export class PortEvent {
    public get estimatedTime(): number {
        return this._estimatedTime;
    }
    public get type(): EventType {
        return this._type;
    }

    constructor(private _estimatedTime: number, private _type: EventType) {}
}

export enum EventType {
    Add,
    Get
}

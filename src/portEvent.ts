export class PortEvent {
    public get estimatedTime(): number {
        return this._estimatedTime;
    }

    constructor(private _estimatedTime: number) {}
}

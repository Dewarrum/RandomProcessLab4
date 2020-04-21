import { Entity } from "./entity";

export class EntityGenerator<T extends Entity> {
    private _lastEntityId = 0;

    constructor(private TType: new (id: number) => T) {}

    public newInstance(): T {
        this._lastEntityId++;
        return new this.TType(this._lastEntityId);
    }
}

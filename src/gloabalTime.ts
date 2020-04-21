export class GlobalTimeProvider {
    public globalTime: number;

    constructor() {
        this.globalTime = 0;
    }
}

const globalTimeProvider = new GlobalTimeProvider();

export { globalTimeProvider };

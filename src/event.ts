export interface ISubscription {
    unsubscribe: { (): void };
}

export interface ITypedSubscription<Callback, Event> extends ISubscription {
    callback: Callback;
    event: Event;
}

export class Event<Callback extends Function, Options> {
    private callbacks: Callback[] = [];

    public add(callback: Callback) {
        this.callbacks.push(callback);
    }

    public invoke(option: Options) {
        this.callbacks.forEach(c => c(option));
    }
}

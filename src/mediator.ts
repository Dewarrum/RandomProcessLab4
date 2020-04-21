import { globalTimeProvider } from "./gloabalTime";
import { EntityGenerator } from "./entityGenerator";
import { Tanker, TankerEvent, TankerEventQueue, TankerEventService, TankerQueue } from "./tanker";
import { ProcessingLine, ProcessingLineEvent, ProcessingLineEventQueue, ProcessingLineEventService, ProcessingLineQueue } from "./processingLine";
import { Tow, TowEvent, TowEventQueue, TowEventService, TowQueue } from "./tow";
import { EventType, PortEvent } from "./portEvent";
import { Event } from "./event";
import { EventArgs } from "./queue";
import { Entity } from "./entity";

export class Mediator {
    public processingLineCount: number = 3;
    public towCount: number = 1;
    public simulationTime: number = 60 * 60 * 24 * 7; // In seconds

    public onEntityQueueEvent: Event<{ (args: EventArgs<Entity>): void }, EventArgs<Entity>> = new Event<
        { (args: EventArgs<Entity>): void },
        EventArgs<Entity>
    >();

    private tankerGenerator: EntityGenerator<Tanker>;

    constructor(
        private _tankerQueue: TankerQueue,
        private _tankerEventQueue: TankerEventQueue,
        private _tankerEventService: TankerEventService,

        private _towQueue: TowQueue,
        private _towEventQueue: TowEventQueue,
        private _towEventService: TowEventService,

        private _processingLineQueue: ProcessingLineQueue,
        private _processingLineEventQueue: ProcessingLineEventQueue,
        private _processingLineEventService: ProcessingLineEventService
    ) {
        this.tankerGenerator = new EntityGenerator<Tanker>(Tanker);

        this._tankerQueue.onPopEvent.add(e => this.onEntityQueueEvent.invoke(e));
        this._tankerQueue.onPushEvent.add(e => this.onEntityQueueEvent.invoke(e));

        this._towQueue.onPopEvent.add(e => this.onEntityQueueEvent.invoke(e));
        this._towQueue.onPushEvent.add(e => this.onEntityQueueEvent.invoke(e));

        this._processingLineQueue.onPopEvent.add(e => this.onEntityQueueEvent.invoke(e));
        this._processingLineQueue.onPushEvent.add(e => this.onEntityQueueEvent.invoke(e));
    }

    public startSimulation() {
        this.setupInitialState();

        while (globalTimeProvider.globalTime < this.simulationTime) {
            const events = [this._tankerEventQueue.first(), this._towEventQueue.first(), this._processingLineEventQueue.first()];

            this.checkIfAnyEventIsOutdated(events);

            globalTimeProvider.globalTime = this.getClosestEvent(events).estimatedTime;

            const triggeredEvents = this.getEventsWithEstimatedTime(globalTimeProvider.globalTime);
            triggeredEvents.forEach(e => {
                if (e instanceof TankerEvent) {
                    if (e.type == EventType.Add) {
                        const tanker = this.tankerGenerator.newInstance();
                        this._tankerQueue.push(tanker);

                        if (this._processingLineQueue.any() && this._towQueue.any()) {
                            const processingLine = this._processingLineQueue.pop();
                            const tow = this._towQueue.pop();
                            this._tankerQueue.pop();

                            this.handleTankerRefill(tow, processingLine);
                        }

                        const estimatedNewTankerEventTime = this._tankerEventService.calculateNextEventTime();
                        this.scheduleNewTankerEvent(estimatedNewTankerEventTime);
                    }
                } else if (e instanceof TowEvent) {
                    if (e.type == EventType.Add) {
                        let tow = e.tow;
                        this._towQueue.push(tow);

                        if (this._tankerQueue.any() && this._processingLineQueue.any()) {
                            const processingLine = this._processingLineQueue.pop();
                            tow = this._towQueue.pop();
                            this._tankerQueue.pop();

                            this.handleTankerRefill(tow, processingLine);
                        }
                    }
                } else if (e instanceof ProcessingLineEvent) {
                    if (e.type == EventType.Add) {
                        let processingLine = e.processingLine;
                        this._processingLineQueue.push(processingLine);

                        if (this._tankerQueue.any() && this._processingLineQueue.any()) {
                            processingLine = this._processingLineQueue.pop();
                            const tow = this._towQueue.pop();
                            this._tankerQueue.pop();

                            this.handleTankerRefill(tow, processingLine);
                        }
                    }
                }
            });
        }
    }

    private setupInitialState(): void {
        const estimatedTime = this._tankerEventService.calculateNextEventTime();
        const event = new TankerEvent(estimatedTime, EventType.Add);

        this._tankerEventQueue.push(event);

        const processingLineGenerator = new EntityGenerator<ProcessingLine>(ProcessingLine);

        for (let i = 0; i < this.processingLineCount; i++) {
            const processingLine = processingLineGenerator.newInstance();
            this._processingLineQueue.push(processingLine);
        }

        const towGenerator = new EntityGenerator<Tow>(Tow);
        for (let i = 0; i < this.towCount; i++) {
            const tow = towGenerator.newInstance();
            this._towQueue.push(tow);
        }
    }

    private scheduleTowFreeEvent(estimatedTime: number, tow: Tow): void {
        const event = new TowEvent(estimatedTime, EventType.Add, tow);
        this._towEventQueue.push(event);
    }

    private scheduleProcessingLineFreeEvent(estimatedTime: number, processingLine: ProcessingLine): void {
        const event = new ProcessingLineEvent(estimatedTime, EventType.Add, processingLine);

        this._processingLineEventQueue.push(event);
    }

    private handleTankerRefill(tow: Tow, processingLine: ProcessingLine) {
        const estimatedTowFreeTime = this._towEventService.calculateNextEventTime();

        // Tow work time + Processing Line work time + Tow work time
        const estimatedProcessingLineFreeTime =
            this._processingLineEventService.calculateNextEventTime() + 2 * (estimatedTowFreeTime - globalTimeProvider.globalTime);

        this.scheduleProcessingLineFreeEvent(estimatedProcessingLineFreeTime, processingLine);
        this.scheduleTowFreeEvent(estimatedTowFreeTime, tow);
    }

    private scheduleNewTankerEvent(estimatedTime: number): void {
        const event = new TankerEvent(estimatedTime, EventType.Add);
        this._tankerEventQueue.push(event);
    }

    private getClosestEvent(events: PortEvent[]): PortEvent {
        return events.filter(e => e != null).sort((l, r) => (l.estimatedTime < r.estimatedTime ? -1 : 1))[0];
    }

    private getEventsWithEstimatedTime(time: number): PortEvent[] {
        const result: PortEvent[] = [];

        if (this._towEventQueue.first() && this._towEventQueue.first().estimatedTime == time) result.push(this._towEventQueue.pop());

        if (this._processingLineEventQueue.first() && this._processingLineEventQueue.first().estimatedTime == time)
            result.push(this._processingLineEventQueue.pop());

        if (this._tankerEventQueue.first() && this._tankerEventQueue.first().estimatedTime == time) result.push(this._tankerEventQueue.pop());

        return result;
    }

    private checkIfAnyEventIsOutdated(events: PortEvent[]): void {
        if (events.filter(e => e != null && e.estimatedTime < globalTimeProvider.globalTime).length > 0)
            throw new Error(`Events of following types are outdated: ${events.map(e => typeof e)}!`);
    }
}

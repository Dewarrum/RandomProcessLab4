import { globalTimeProvider } from "./gloabalTime";
import { EntityGenerator } from "./entityGenerator";
import { Tanker, TankerEvent, TankerEventQueue, TankerEventService, TankerQueue, EventType, TankerEventArgs } from "./tanker";
import { ProcessingLine, ProcessingLineEvent, ProcessingLineEventQueue, ProcessingLineEventService, ProcessingLineQueue } from "./processingLine";
import { Tow, TowEvent, TowEventQueue, TowEventService, TowQueue, TowGenerator } from "./tow";
import { PortEvent } from "./portEvent";
import { Event } from "./event";
import { EventArgs } from "./queue";
import { Entity } from "./entity";
import { convertSecondsToHours, logScheduleEvent } from "./helpers";

export class Mediator {
    public processingLineCount: number = 3;
    public towCount: number = 1;
    public simulationTime: number = 60 * 60 * 24 * 1; // In seconds

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
            console.log(`%c Current time: ${convertSecondsToHours(globalTimeProvider.globalTime)} h.`, "background: green; color: white");

            const triggeredEvents = this.getEventsWithEstimatedTime(globalTimeProvider.globalTime);
            triggeredEvents.forEach(e => {
                if (e instanceof TankerEvent) {
                    if (e.type == EventType.ArrivedNew) {
                        this._tankerQueue.enqueue(e.tanker);

                        if (this._processingLineQueue.any() && this._towQueue.any()) {
                            const processingLine = this._processingLineQueue.pop();
                            const tow = this._towQueue.pop();

                            this._tankerQueue.processByTow(e.tanker.id);
                            this.handleTankerRefill(tow, e.tanker, processingLine);
                        }

                        const estimatedNewTankerEventTime = this._tankerEventService.calculateNextEventTime();
                        this.scheduleNewTankerEvent(estimatedNewTankerEventTime);
                    } else if (e.type == EventType.HasBeenProcessed) {
                        // this.scheduleTankerStartedProcessByLineEvent(globalTimeProvider.globalTime, e.tanker, e.processingLine);
                    } else if (e.type == EventType.StartedRefill) {
                        const processingEstimatedTime = this._processingLineEventService.calculateNextEventTime();
                        this.scheduleTankerFinishedProcessByLineEvent(processingEstimatedTime, e.tanker, e.processingLine);
                        this._tankerQueue.processByLine(e.tanker.id);
                    } else if (e.type == EventType.FinishedRefill) {
                        if (this._towQueue.any()) {
                            const tow = this._towQueue.pop();
                            this._tankerQueue.dispatchByTow(e.tanker.id);
                            this.handleTankerRefillFinished(tow, e.tanker, e.processingLine);
                        }
                    } else if (e.type == EventType.LeftSystem) {
                        this._tankerQueue.removeFromSystem(e.tanker.id);
                    }
                } else if (e instanceof TowEvent) {
                    let tow = e.tow;
                    this._towQueue.push(tow);

                    if (this._tankerQueue.any() && this._processingLineQueue.any()) {
                        const processingLine = this._processingLineQueue.pop();
                        tow = this._towQueue.pop();
                        const tanker = this._tankerQueue.first();

                        this.handleTankerRefill(tow, tanker, processingLine);
                    }
                } else if (e instanceof ProcessingLineEvent) {
                    let processingLine = e.processingLine;
                    this._processingLineQueue.push(processingLine);

                    if (this._tankerQueue.any() && this._processingLineQueue.any()) {
                        processingLine = this._processingLineQueue.pop();
                        const tow = this._towQueue.pop();
                        const tanker = this._tankerQueue.pop();
                        this._tankerQueue.processByLine(tanker.id);

                        this.handleTankerRefill(tow, tanker, processingLine);
                    }
                }
            });
        }
    }

    private setupInitialState(): void {
        const estimatedTime = this._tankerEventService.calculateNextEventTime();
        this.scheduleNewTankerEvent(estimatedTime);

        const processingLineGenerator = new EntityGenerator<ProcessingLine>(ProcessingLine);

        for (let i = 0; i < this.processingLineCount; i++) {
            const processingLine = processingLineGenerator.newInstance();
            this._processingLineQueue.push(processingLine);
        }

        const towGenerator = new TowGenerator();
        for (let i = 0; i < this.towCount; i++) {
            const tow = towGenerator.newInstance();
            this._towQueue.push(tow);
        }
    }

    private scheduleTowFreeEvent(estimatedTime: number, tow: Tow): void {
        const event = new TowEvent(estimatedTime, tow);
        this._towEventQueue.push(event);

        logScheduleEvent(`Tow #${tow.id} free event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);
    }

    private scheduleProcessingLineFreeEvent(estimatedTime: number, processingLine: ProcessingLine): void {
        const event = new ProcessingLineEvent(estimatedTime, processingLine);
        logScheduleEvent(`Processing line #${processingLine.id} free event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);

        this._processingLineEventQueue.push(event);
    }

    private scheduleTankerFreeEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        const event = new TankerEvent(estimatedTime, EventType.LeftSystem, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(`Tanker #${tanker.id} free event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);

        this._tankerEventQueue.push(event);
    }

    private scheduleTankerStartedProcessByLineEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        const event = new TankerEvent(estimatedTime, EventType.StartedRefill, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(
            `Tanker #${tanker.id} start process by line #${processingLine.id} event scheduled at ${convertSecondsToHours(estimatedTime)} h.`
        );

        this._tankerEventQueue.push(event);
    }

    private scheduleTankerFinishedProcessByLineEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        const event = new TankerEvent(estimatedTime, EventType.FinishedRefill, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(
            `Tanker #${tanker.id} finished process by line #${processingLine.id} event scheduled at ${convertSecondsToHours(estimatedTime)} h.`
        );

        this._tankerEventQueue.push(event);
    }

    private scheduleTankerStartedProcessByTowEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        const event = new TankerEvent(estimatedTime, EventType.HasBeenProcessed, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(`Tanker #${tanker.id} start process by tow event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);

        this._tankerEventQueue.push(event);
    }

    private handleTankerRefill(tow: Tow, tanker: Tanker, processingLine: ProcessingLine) {
        const estimatedTowFreeTime = this._towEventService.calculateNextEventTime();

        this.scheduleTowFreeEvent(estimatedTowFreeTime, tow);
        // this.scheduleProcessingLineStartedProcess(estimatedTowFreeTime, tanker, processingLine);
        this.scheduleTankerStartedProcessByLineEvent(globalTimeProvider.globalTime, tanker, processingLine);
    }

    private handleTankerRefillFinished(tow: Tow, tanker: Tanker, processingLine: ProcessingLine) {
        const estimatedTowFreeTime = this._towEventService.calculateNextEventTime();

        this.scheduleTankerFreeEvent(estimatedTowFreeTime, tanker, processingLine);
        this.scheduleTowFreeEvent(estimatedTowFreeTime, tow);
        this.scheduleProcessingLineFreeEvent(estimatedTowFreeTime, processingLine);
    }

    private scheduleNewTankerEvent(estimatedTime: number): void {
        const event = new TankerEvent(estimatedTime, EventType.ArrivedNew, this.tankerGenerator.newInstance());
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

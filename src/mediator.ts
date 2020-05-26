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
import * as _ from "lodash";
import { getConfig } from "./appConfig";

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
        this.populateSettings();
        this.setupInitialState();

        while (globalTimeProvider.globalTime < this.simulationTime) {
            const events = [this._tankerEventQueue.first(), this._towEventQueue.first(), this._processingLineEventQueue.first()];

            this.checkIfNextEventTimeIsInThePast(this.getClosestEvent(events).estimatedTime);

            globalTimeProvider.globalTime = this.getClosestEvent(events).estimatedTime;
            // console.log(`%c Current time: ${convertSecondsToHours(globalTimeProvider.globalTime)} h.`, "background: green; color: white");
            this.checkIfAnyEventIsOutdated(events);

            const triggeredEvents = this.getEventsWithEstimatedTime(globalTimeProvider.globalTime);

            triggeredEvents.forEach(e => {
                if (this._tankerQueue.any() && this._towQueue.any() && this._processingLineQueue.any()) {
                    const anyTanker = this._tankerQueue.any();
                    const anyTow = this._towQueue.any();
                    const anyProcessingLine = this._processingLineQueue.any();

                    const text = [anyTanker ? "tanker" : "", anyTow ? "tow" : "", anyProcessingLine ? "processing line" : ""];

                    throw new Error(`Error: ${text.join(",")}  are not working when they can.`);
                }
                if (e instanceof TankerEvent) {
                    if (e.type == EventType.ArrivedNew) {
                        this._tankerQueue.enqueue(e.tanker);

                        if (this._tankerQueue.anyStuckInProcessingLine() && this._towQueue.any()) {
                            const tanker = this._tankerQueue.firstStuckInProcessingLine();
                            const tow = this._towQueue.pop();
                            this._tankerQueue.dispatchStuckInLineByTow(tanker.id);

                            this.handleTankerRefillFinished(tow, tanker, tanker.processingLine);
                        }

                        if (this._processingLineQueue.any() && this._towQueue.any()) {
                            const processingLine = this._processingLineQueue.pop();
                            const tow = this._towQueue.pop();

                            this._tankerQueue.processByTow(e.tanker.id);
                            this.handleTankerRefill(tow, e.tanker, processingLine);
                        }

                        const estimatedNewTankerEventTime = this._tankerEventService.calculateNextEventTime();
                        this.scheduleNewTankerEvent(estimatedNewTankerEventTime);
                    } else if (e.type == EventType.StartedRefill) {
                        const processingEstimatedTime = this._processingLineEventService.calculateNextEventTime();
                        this.scheduleTankerFinishedProcessByLineEvent(processingEstimatedTime, e.tanker, e.processingLine);
                        this._tankerQueue.processByLine(e.tanker.id);
                    } else if (e.type == EventType.FinishedRefill) {
                        if (this._towQueue.any()) {
                            const tow = this._towQueue.pop();
                            this._tankerQueue.dispatchByTow(e.tanker.id);
                            this.handleTankerRefillFinished(tow, e.tanker, e.processingLine);
                        } else {
                            this._tankerQueue.stuckInProcessingLine(e.tanker.id);
                        }
                    } else if (e.type == EventType.LeftSystem) {
                        this._tankerQueue.removeFromSystem(e.tanker.id);
                    }
                } else if (e instanceof TowEvent) {
                    let tow = e.tow;
                    this._towQueue.push(tow);

                    if (this._tankerQueue.anyStuckInProcessingLine() && this._towQueue.any()) {
                        const tanker = this._tankerQueue.firstStuckInProcessingLine();
                        const tow = this._towQueue.pop();
                        this._tankerQueue.dispatchStuckInLineByTow(tanker.id);

                        this.handleTankerRefillFinished(tow, tanker, tanker.processingLine);
                    }

                    if (this._tankerQueue.any() && this._processingLineQueue.any() && this._towQueue.any()) {
                        const processingLine = this._processingLineQueue.pop();
                        tow = this._towQueue.pop();
                        const tanker = this._tankerQueue.first();
                        this._tankerQueue.processByTow(tanker.id);

                        this.handleTankerRefill(tow, tanker, processingLine);
                    }
                } else if (e instanceof ProcessingLineEvent) {
                    let processingLine = e.processingLine;
                    this._processingLineQueue.push(processingLine);

                    if (this._tankerQueue.anyStuckInProcessingLine() && this._towQueue.any()) {
                        const tanker = this._tankerQueue.firstStuckInProcessingLine();
                        const tow = this._towQueue.pop();
                        this._tankerQueue.dispatchStuckInLineByTow(tanker.id);

                        this.handleTankerRefillFinished(tow, tanker, tanker.processingLine);
                    } else if (this._tankerQueue.any() && this._towQueue.any()) {
                        const processingLine = this._processingLineQueue.pop();
                        const tow = this._towQueue.pop();
                        const tanker = this._tankerQueue.first();
                        this._tankerQueue.processByTow(tanker.id);

                        this.handleTankerRefill(tow, tanker, processingLine);
                    }
                }
            });
        }
    }

    private populateSettings(): void {
        const appConfig = getConfig();

        this.simulationTime = appConfig.simulationTime;

        this.processingLineCount = appConfig.processingLineCount;
        this.towCount = appConfig.towCount;

        this._tankerEventService.setSettings(appConfig.tankerIntensity);
        this._processingLineEventService.setSettings(appConfig.processingLineIntensity);
        this._towEventService.setSettings(appConfig.towIntensity);
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
        this.checkIfEventIsScheduledForPast(estimatedTime);
        const event = new TowEvent(estimatedTime, tow);
        this._towEventQueue.push(event);

        logScheduleEvent(`Tow #${tow.id} free event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);
    }

    private scheduleProcessingLineFreeEvent(estimatedTime: number, processingLine: ProcessingLine): void {
        this.checkIfEventIsScheduledForPast(estimatedTime);
        const event = new ProcessingLineEvent(estimatedTime, processingLine);
        logScheduleEvent(`Processing line #${processingLine.id} free event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);

        this._processingLineEventQueue.push(event);
    }

    private scheduleTankerFreeEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        this.checkIfEventIsScheduledForPast(estimatedTime);
        const event = new TankerEvent(estimatedTime, EventType.LeftSystem, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(`Tanker #${tanker.id} free event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);

        this._tankerEventQueue.push(event);
    }

    private scheduleTankerStartedProcessByLineEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        this.checkIfEventIsScheduledForPast(estimatedTime);
        const time = globalTimeProvider.globalTime;
        const event = new TankerEvent(estimatedTime, EventType.StartedRefill, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(
            `Tanker #${tanker.id} start process by line #${processingLine.id} event scheduled at ${convertSecondsToHours(estimatedTime)} h.`
        );

        this._tankerEventQueue.push(event);
    }

    private scheduleTankerFinishedProcessByLineEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        this.checkIfEventIsScheduledForPast(estimatedTime);
        const event = new TankerEvent(estimatedTime, EventType.FinishedRefill, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(
            `Tanker #${tanker.id} finished process by line #${processingLine.id} event scheduled at ${convertSecondsToHours(estimatedTime)} h.`
        );

        this._tankerEventQueue.push(event);
    }

    private scheduleTankerStartedProcessByTowEvent(estimatedTime: number, tanker: Tanker, processingLine: ProcessingLine): void {
        this.checkIfEventIsScheduledForPast(estimatedTime);
        const event = new TankerEvent(estimatedTime, EventType.HasBeenProcessed, tanker);
        event.processingLine = processingLine;
        logScheduleEvent(`Tanker #${tanker.id} start process by tow event scheduled at ${convertSecondsToHours(estimatedTime)} h.`);

        this._tankerEventQueue.push(event);
    }

    private handleTankerRefill(tow: Tow, tanker: Tanker, processingLine: ProcessingLine) {
        tanker.processingLine = processingLine;
        tanker.tow = tow;
        const estimatedTowFreeTime = this._towEventService.calculateNextEventTime();

        this.scheduleTowFreeEvent(estimatedTowFreeTime, tow);
        // this.scheduleProcessingLineStartedProcess(estimatedTowFreeTime, tanker, processingLine);
        this.scheduleTankerStartedProcessByLineEvent(estimatedTowFreeTime, tanker, processingLine);
    }

    private handleTankerRefillFinished(tow: Tow, tanker: Tanker, processingLine: ProcessingLine) {
        const estimatedTowFreeTime = this._towEventService.calculateNextEventTime();

        this.scheduleTankerFreeEvent(estimatedTowFreeTime, tanker, processingLine);
        this.scheduleTowFreeEvent(estimatedTowFreeTime, tow);
        this.scheduleProcessingLineFreeEvent(estimatedTowFreeTime, processingLine);
    }

    private scheduleNewTankerEvent(estimatedTime: number): void {
        this.checkIfEventIsScheduledForPast(estimatedTime);

        const event = new TankerEvent(estimatedTime, EventType.ArrivedNew, this.tankerGenerator.newInstance());
        this._tankerEventQueue.push(event);
    }

    private getClosestEvent(events: PortEvent[]): PortEvent {
        const closestEvent = events.filter(e => e != null).sort((l, r) => (l.estimatedTime < r.estimatedTime ? -1 : 1))[0];
        return closestEvent;
    }

    private getEventsWithEstimatedTime(time: number): PortEvent[] {
        const result: PortEvent[] = [];

        if (this._towEventQueue.first() && Math.abs(this._towEventQueue.first().estimatedTime - time) < 5) result.push(this._towEventQueue.pop());

        if (this._processingLineEventQueue.first() && this._processingLineEventQueue.first().estimatedTime - time < 5)
            result.push(this._processingLineEventQueue.pop());

        if (this._tankerEventQueue.first() && Math.abs(this._tankerEventQueue.first().estimatedTime - time) < 5)
            result.push(this._tankerEventQueue.pop());

        return result;
    }

    private checkIfAnyEventIsOutdated(events: PortEvent[]): void {
        if (events.filter(e => e != null && e.estimatedTime < globalTimeProvider.globalTime).length > 0) {
            const outdatedEvents = _(events)
                .filter(e => e != null && e.estimatedTime < globalTimeProvider.globalTime)
                .value();

            throw new Error(`Events of following types are outdated: ${events.map(e => e.estimatedTime)}! Time: ${globalTimeProvider.globalTime} s.`);
        }
    }

    private checkIfEventIsScheduledForPast(estimatedTime: number) {
        if (estimatedTime < globalTimeProvider.globalTime) {
            throw new Error(`Can't schedule event for the past. Estimated time: ${estimatedTime}, current time: ${globalTimeProvider.globalTime}`);
        }
    }

    private checkIfNextEventTimeIsInThePast(nextEventTime: number): void {
        if (nextEventTime < globalTimeProvider.globalTime) {
            throw new Error(`Can't change global time to past. New event time: ${nextEventTime}, current time: ${globalTimeProvider.globalTime}.`);
        }
    }
}

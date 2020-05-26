import { Mediator } from "./mediator";
import { TankerQueue, TankerEventQueue, TankerEventService } from "./tanker";
import { TowQueue, TowEventQueue, TowEventService } from "./tow";
import { ProcessingLineQueue, ProcessingLineEventQueue, ProcessingLineEventService } from "./processingLine";
import { StatisticsManager } from "./statisticsManager";
import { globalTimeProvider } from "./gloabalTime";
import {convertSecondsToHours, renderMultipleRunResults} from "./helpers";

export function multipleRun(times: number): void {
    let totalNumberOfTankers = 0;
    let totalAverageTimeInQueue = 0;
    let totalAverageProcessingTime = 0;
    let totalUnprocessedTankerCount = 0;

    for (let i = 0; i < times; i++) {
        const mediator = new Mediator(
            new TankerQueue(),
            new TankerEventQueue(),
            new TankerEventService(),
            new TowQueue(),
            new TowEventQueue(),
            new TowEventService(),
            new ProcessingLineQueue(),
            new ProcessingLineEventQueue(),
            new ProcessingLineEventService()
        );

        const statisticsManager = new StatisticsManager();
        mediator.onEntityQueueEvent.add(args => statisticsManager.handleQueueEvent(args));

        mediator.startSimulation();
        statisticsManager.processCollectedData();

        totalNumberOfTankers += statisticsManager.tankerCount;

        totalAverageTimeInQueue += statisticsManager.tankerAverages.timeInQueue;
        totalAverageProcessingTime += statisticsManager.tankerAverages.processingTime;
        totalUnprocessedTankerCount += statisticsManager.tankerLifecycles.filter(l => !l.hasBeenProcessed).length;

        globalTimeProvider.globalTime = 0;
    }

    const averageNumberOfTankers = totalNumberOfTankers / times;
    const averageTimeInQueue = totalAverageTimeInQueue / times;
    const averageProcessingTime = totalAverageProcessingTime / times;
    const averageUnprocessedTankerCount = totalUnprocessedTankerCount / times;

    /* console.log("averageNumberOfTankers", averageNumberOfTankers);
    console.log("averageTimeInQueue", convertSecondsToHours(averageTimeInQueue));
    console.log("averageProcessingTime", convertSecondsToHours(averageProcessingTime));
    console.log("averageUnprocessedTankerCount", averageUnprocessedTankerCount); */

    renderMultipleRunResults({
        loading: false,
        averageNumberOfTankers: averageNumberOfTankers,
        averageTimeInQueue: convertSecondsToHours(averageTimeInQueue),
        averageProcessingTime: convertSecondsToHours(averageProcessingTime),
        averageUnprocessedTankerCount: averageUnprocessedTankerCount,
        processedTankerPercent: ((averageNumberOfTankers - averageUnprocessedTankerCount) / averageNumberOfTankers * 100).toFixed(2) + "%"
    });
}

import { Mediator } from "./mediator";
import { TankerEventQueue, TankerEventService, TankerQueue } from "./tanker";
import { TowEventQueue, TowEventService, TowQueue } from "./tow";
import { ProcessingLineEventQueue, ProcessingLineEventService, ProcessingLineQueue } from "./processingLine";
import { StatisticsManager } from "./statisticsManager";
import { renderTextForEntityStats, renderTextForTankerStats, renderTextForTotalTankerStats } from "./helpers";
import * as _ from "lodash";
import * as $ from "jquery";

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
mediator.onEntityQueueEvent.add(a => statisticsManager.handleQueueEvent(a));

$(function () {
    mediator.startSimulation();
    statisticsManager.processCollectedData();
    console.log("Tanker stats:", statisticsManager.tankerStatistics);
    console.log("Tanker count:", statisticsManager.tankerCount);
    console.log("Processed tanker count:", statisticsManager.processedTankerCount);
    console.log("Unprocessed tanker count:", statisticsManager.unprocessedTankerCount);
    _(statisticsManager.processingLineStatistics).each(s => renderTextForEntityStats(s, "Линия обслуживания", "processingLine"));
    _(statisticsManager.towStatistics).each(s => renderTextForEntityStats(s, "Буксир", "tow"));
    console.log(statisticsManager.tankerLifecycles[0]);
    renderTextForTotalTankerStats(statisticsManager);
});

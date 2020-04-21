import { Mediator } from "./mediator";
import { TankerEventQueue, TankerEventService, TankerQueue } from "./tanker";
import { TowEventQueue, TowEventService, TowQueue } from "./tow";
import { ProcessingLineEventQueue, ProcessingLineEventService, ProcessingLineQueue } from "./processingLine";
import { StatisticsManager } from "./statisticsManager";

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
mediator.onEntityQueueEvent.add(statisticsManager.handleQueueEvent.bind(statisticsManager));

mediator.startSimulation();
console.log(statisticsManager);

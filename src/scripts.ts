import { Mediator } from "./mediator";
import { TankerEventQueue, TankerEventService, TankerQueue } from "./tanker";
import { TowEventQueue, TowEventService, TowQueue } from "./tow";
import { ProcessingLineEventQueue, ProcessingLineEventService, ProcessingLineQueue } from "./processingLine";
import { StatisticsManager } from "./statisticsManager";
import {
    renderTextForEntityStats,
    renderTextForTankerStats,
    renderTextForTotalTankerStats,
    renderTextForTankerLifecycles,
    renderMultipleRunResults
} from "./helpers";
import * as _ from "lodash";
import * as $ from "jquery";
import { plotHistogram, plotStepFunction } from "./plot";
import { multipleRun } from "./multipleRun";
import { globalTimeProvider } from "./gloabalTime";
import { getConfig } from "./appConfig";

globalThis.timeProvider = globalTimeProvider;

$(function () {
    $("#singleRun").click(function () {
        $(this).attr("disabled", "disabled");

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
        mediator.startSimulation();
        statisticsManager.processCollectedData();

        _(statisticsManager.processingLineStatistics).each(s => renderTextForEntityStats(s, "Линия обслуживания", "processingLine"));
        _(statisticsManager.towStatistics).each(s => renderTextForEntityStats(s, "Буксир", "tow"));
        _(statisticsManager.tankerLifecycles).each(l => renderTextForTankerLifecycles(l));

        renderTextForTotalTankerStats(statisticsManager);

        plotHistogram(statisticsManager.timeInQueueHistogramData, "timeInQueueHistogram", "Время в очереди");
        plotHistogram(statisticsManager.processingTimeHistogramData, "processingTimeHistogram", "Время обслуживания");
        plotHistogram(
            statisticsManager.timeWhileStuckInLineHistogramData,
            "timeWhileStuckInLineHistogram",
            "Время ожидания обработки буксиром после линии обслуживания"
        );

        console.log(statisticsManager.processingLinesLoadData);

        plotStepFunction(
            statisticsManager.processingLinesLoadData,
            "processingLineLoadTimeChart",
            "График загрузки линий обслуживания",
            "Загрузка, %"
        );

        plotStepFunction(statisticsManager.towLoadData, "towLoadTimeChart", "График загрузки буксиров", "Загрузка, %");
        plotStepFunction(statisticsManager.queueLengthData, "queueLengthChart", "График длины очереди", "Длина, шт.");

        globalTimeProvider.globalTime = 0;
    });

    $("#multipleRun").click(function () {
        renderMultipleRunResults({
            loading: true
        });

        setTimeout(() => multipleRun(1000), 0);
    });
});

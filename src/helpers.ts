import { ServingEntityStatistics, TankerStatistics, StatisticsManager, TankerLifecycle } from "./statisticsManager";
import { globalTimeProvider } from "./gloabalTime";
import * as $ from "jquery";
import * as Mustache from "mustache";

export function renderTextForEntityStats(stats: ServingEntityStatistics, entityName: string, entityAlias: string) {
    const globalTime = globalTimeProvider.globalTime;
    const text = `${entityName} #${stats.id}. Время работы: ${convertSecondsToHours(stats.workingTime)} (${convertToPercent(
        stats.workingTime,
        globalTime
    )}%). Время простоя: ${convertSecondsToHours(stats.idleTime)} (${convertToPercent(
        stats.idleTime,
        globalTime
    )}%). Общее время ${convertSecondsToHours(globalTime)}`;

    const component = $(`<p id="${entityAlias}${stats.id}Stats"></p>`);
    $(`#${entityAlias}Stats`).append(component);
    $(`#${entityAlias}${stats.id}Stats`).text(text);
}

export function renderTextForTotalTankerStats(statisticsManager: StatisticsManager) {
    const totalTankerCountComponent = $(`<p>Количество прибывших танкеров: ${statisticsManager.tankerCount} шт</p>`);
    const processedTankerCountComponent = $(`<p>Количество обслуженных танкеров: ${statisticsManager.processedTankerCount} шт</p>`);
    const unprocessedTankerCountComponent = $(`<p>Количество необслуженных танкеров: ${statisticsManager.unprocessedTankerCount} шт</p>`);
    const averageTimeInQueueComponent = $(`<p>Среднее время в очереди: ${convertSecondsToHours(statisticsManager.tankerAverages.timeInQueue)}</p>`);
    const averageTimeWhileStuckInLineComponent = $(
        `<p>Среднее время простоя на линии обслуживания: ${convertSecondsToHours(statisticsManager.tankerAverages.timeWhileStuckInLine)}</p>`
    );

    const averageProcessingTimeComponent = $(
        `<p>Среднее время обслуживания: ${convertSecondsToHours(statisticsManager.tankerAverages.processingTime)}</p>`
    );

    const content = $("#totalTankerStats");
    content.append(totalTankerCountComponent);
    content.append(processedTankerCountComponent);
    content.append(unprocessedTankerCountComponent);
    content.append(averageTimeInQueueComponent);
    content.append(averageTimeWhileStuckInLineComponent);
    content.append(averageProcessingTimeComponent);
}

export function renderTextForTankerStats(stats: TankerStatistics) {
    const text = `Танкер #${stats.id}. Время в очереди: ${stats.idleTime != undefined ? convertSecondsToHours(stats.idleTime) : "не был обслужен"}.`;
    const component = $(`<p id="tanker${stats.id}Stats"></p>`);

    $(`#tankerStats`).append(component);
    $(`#tanker${stats.id}Stats`).text(text);
}

export function renderTextForTankerLifecycles(lifecycle: TankerLifecycle) {
    let text = `Танкер #${lifecycle.tankerId}`;
    let component = $(`<div id="tanker${lifecycle.tankerId}Lifecycle"><p class="tankerLifecycleInner">${text}</p></div>`);

    $("#tankerLifecycles").append(component);
    const tankerLifecycleContainer = $(`#tanker${lifecycle.tankerId}Lifecycle`);

    text = `Время в очереди: ${convertSecondsToHours(lifecycle.timeInQueue)}`;
    component = $(`<p>${text}</p>`);
    tankerLifecycleContainer.append(component);

    if (lifecycle.hasBeenProcessed) {
        text = `Время обслуживания ${convertSecondsToHours(lifecycle.timeOnProcessLine)}`;
        component = $(`<p>${text}</p>`);
        tankerLifecycleContainer.append(component);

        text = `Время простаивания на линии обслуживания ${convertSecondsToHours(lifecycle.timeWhileStuckInProcessingLine)}`;
        component = $(`<p>${text}</p>`);
        tankerLifecycleContainer.append(component);
    }

    text = `Время обслуживания буксиром ${convertSecondsToHours(lifecycle.towProcessTime)}`;
    component = $(`<p>${text}</p>`);
    tankerLifecycleContainer.append(component);

    text = `Время в системе ${convertSecondsToHours(lifecycle.timeInSystem)}`;
    component = $(`<p>${text}</p>`);
    tankerLifecycleContainer.append(component);

    text = `Был обслужен: ${lifecycle.hasBeenProcessed ? "да" : "нет"}`;
    component = $(`<p>${text}</p>`);
    tankerLifecycleContainer.append(component);
}

export function convertSecondsToHours(seconds: number): string {
    const hours = Math.floor(seconds / 60 / 60);
    return `${hours} ч ${Math.floor((seconds - hours * 60 * 60) / 60)} мин`;
}

export function convertToPercent(part: number, total: number): string {
    return ((part / total) * 100).toFixed(2);
}

export function renderMultipleRunResults(data: any): void {
    const html = Mustache.render($("#multipleRunResultTmpl").html(), data);

    $("#multipleRunTab div.result").html(html);
}

export function logScheduleEvent(message: string): void {
    // console.log(`%c ${message}`, "background: blue; color: white");
}

export function logFireEvent(message: string): void {
    // console.log(`%c ${message}`, "background: red; color: white");
}

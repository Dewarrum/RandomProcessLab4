import * as Plotly from "plotly.js";
import { HistogramData } from "./statisticsManager";
import * as _ from "lodash";
import { convertSecondsToHours } from "./helpers";
import { BusynessState } from "./busynessManager";

export function plotHistogram(data: HistogramData, elementId: string, plotTitle: string) {
    const arr: Array<Partial<Plotly.PlotData>> = [
        {
            x: data.items.map(i => `${convertSecondsToHours(i.start)} - ${convertSecondsToHours(i.end)}`),
            y: data.items.map(i => i.height),
            type: "bar",
            name: plotTitle,
            autobinx: false
        }
    ];

    const layout: Partial<Plotly.Layout> = {
        title: {
            text: plotTitle,
            font: {
                family: "Courier New, monospace",
                size: 24
            },
            xref: "paper",
            x: 0.05
        },
        xaxis: {
            title: {
                text: "Время, с",
                font: {
                    family: "Courier New, monospace",
                    size: 18,
                    color: "#7f7f7f"
                }
            }
        },
        yaxis: {
            title: {
                text: "Количество танкеров",
                font: {
                    family: "Courier New, monospace",
                    size: 18,
                    color: "#7f7f7f"
                }
            }
        }
    };

    Plotly.newPlot(elementId, arr, layout);
}

export function plotStepFunction(states: BusynessState[], elementId: string, plotTitle: string, xAxisLabel: string): void {
    const arr: Array<Partial<Plotly.PlotData>> = [
        {
            x: states.map(s => s.startTime),
            y: states.map(s => s.loadPercent),
            mode: "lines+markers",
            name: "vh",
            line: { shape: "vh" },
            type: "scatter"
        }
    ];

    const layout: Partial<Plotly.Layout> = {
        title: {
            text: plotTitle,
            font: {
                family: "Courier New, monospace",
                size: 24
            },
            xref: "paper",
            x: 0.05
        },
        xaxis: {
            title: {
                text: "Время, с",
                font: {
                    family: "Courier New, monospace",
                    size: 18,
                    color: "#7f7f7f"
                }
            }
        },
        yaxis: {
            title: {
                text: xAxisLabel,
                font: {
                    family: "Courier New, monospace",
                    size: 18,
                    color: "#7f7f7f"
                }
            }
        }
    };

    Plotly.newPlot(elementId, arr, layout);
}

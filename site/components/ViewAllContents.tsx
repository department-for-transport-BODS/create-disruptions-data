import { ConsequenceOperators, Service } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { validitySchema } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { Datasource, Progress, SortOrder } from "@create-disruptions-data/shared-ts/enums";
import { getFormattedDate } from "@create-disruptions-data/shared-ts/utils/dates";
import { makeFilteredArraySchema } from "@create-disruptions-data/shared-ts/utils/zod";
import { LoadingBox } from "@govuk-react/loading-box";
import saveAs from "file-saver";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import Papa from "papaparse";
import { Dispatch, type JSX, ReactElement, SetStateAction, memo, useEffect, useState } from "react";
import writeXlsxFile, { Schema } from "write-excel-file";
import { z } from "zod";
import {
    DISRUPTION_DETAIL_PAGE_PATH,
    DISRUPTION_SEVERITIES,
    DISRUPTION_STATUSES,
    REVIEW_DISRUPTION_PAGE_PATH,
    TYPE_OF_CONSEQUENCE_PAGE_PATH,
    VIEW_ALL_DISRUPTIONS_PAGE_PATH,
    VIEW_ALL_TEMPLATES_PAGE_PATH,
} from "../constants";
import { fetchOperators, fetchServices } from "../data/refDataApi";
import { Operator } from "../schemas/consequence.schema";
import {
    ExportDisruptionData,
    TableDisruption,
    disruptionsTableSchema,
    exportDisruptionsSchema,
} from "../schemas/disruption.schema";
import {
    filterVehicleModes,
    getServiceLabel,
    notEmpty,
    removeDuplicates,
    sortServices,
    splitCamelCaseToString,
} from "../utils";
import { convertDateTimeToFormat, dateIsSameOrBeforeSecondDate } from "../utils/dates";
import { getExportSchema } from "../utils/exportUtils";
import { filterServices } from "../utils/formUtils";
import { createNewPdfDoc, disruptionPdfHeaders, formatDisruptionsForPdf } from "../utils/pdf";
import DateSelector from "./form/DateSelector";
import Select from "./form/Select";
import SortableTable, { TableColumn } from "./form/SortableTable";
import Table from "./form/Table";
import ExportPopUp from "./popup/ExportPopup";
import OperatorSearch from "./search/OperatorSearch";
import ServiceSearch from "./search/ServiceSearch";

export interface ViewAllContentProps {
    adminAreaCodes: string[];
    newContentId: string;
    orgId: string;
    csrfToken?: string;
    filterStatus?: Progress | null;
    enableLoadingSpinnerOnPageLoad?: boolean;
    isTemplate?: boolean;
    showUnderground?: boolean;
    showCoach?: boolean;
}

export interface Filter {
    services: Service[];
    period?: {
        startTime: string;
        endTime: string;
    };
    severity?: string;
    status?: Progress | "any";
    operators: FilterOperator[];
    mode?: string;
    searchText?: string;
    upcoming?: "true" | "false";
}

export interface FilterOperator {
    operatorName: string;
    operatorRef: string;
}

export interface ContentTable {
    id: JSX.Element;
    summary: string;
    modes: string;
    start: string;
    end: string;
    severity: string;
    status: string;
}

const retrieveAllDataForExport = async (orgId: string, filters: Filter) => {
    let getData = true;
    let pageNumber = 1;
    const disruptions: TableDisruption[] = [];

    do {
        const newDisruptions = await getDisruptionData(orgId, filters, pageNumber, false, 1000);

        if (newDisruptions.disruptions.length) {
            disruptions.push(...newDisruptions.disruptions);
            pageNumber++;
        } else {
            getData = false;
        }
    } while (getData);

    return disruptions;
};

export const getApiUrlFromFilters = (
    orgId: string,
    filters: Filter,
    pageNumber: number,
    pageSize: number,
    isTemplate?: boolean,
    sortedField: keyof ContentTable | null = null,
    sortOrder = SortOrder.desc,
) => {
    const queryParams = [
        filters.searchText ? `textSearch=${filters.searchText}` : null,
        filters.operators.length ? `operators=${filters.operators.map((o) => o.operatorRef).join(",")}` : null,
        filters.services.length
            ? `services=${filters.services.map((s) => (s.dataSource === Datasource.bods ? `bods:${s.lineId}` : `tnds:${s.serviceCode}`))}`
            : null,
        filters.period?.startTime && filters.period.endTime ? `startDate=${filters.period?.startTime}` : null,
        filters.period?.startTime && filters.period.endTime ? `endDate=${filters.period?.endTime}` : null,
        filters.severity && filters.severity !== "any" ? `severity=${filters.severity}` : null,
        filters.status && filters.status !== "any" ? `status=${filters.status}` : null,
        filters.mode && filters.mode !== "any" ? `mode=${filters.mode}` : null,
        filters.upcoming ? `upcoming=${filters.upcoming}` : null,
        sortedField === "start" || sortedField === "end" ? `sortBy=${sortedField}` : null,
        sortedField === "start" || sortedField === "end" ? `sortOrder=${sortOrder}` : null,
        `offset=${(pageNumber - 1) * pageSize}`,
        `pageSize=${pageSize}`,
        `template=${isTemplate ? "true" : "false"}`,
    ].filter(notEmpty);

    const url = `/api/get-all-disruptions/${orgId}${queryParams.length > 0 ? `?${queryParams.join("&")}` : ""}`;

    return url;
};

export const getDisruptionData = async (
    orgId: string,
    filters: Filter,
    pageNumber: number,
    isTemplate?: boolean,
    pageSize = 10,
    sortedField: keyof ContentTable | null = null,
    sortOrder = SortOrder.desc,
): Promise<{ disruptions: TableDisruption[]; pageCount: number }> => {
    const options: RequestInit = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    };

    const res = await fetch(
        getApiUrlFromFilters(orgId, filters, pageNumber, pageSize, isTemplate, sortedField, sortOrder),
        options,
    );

    const { disruptions, count } = await res.json();

    const parsedDisruptions = makeFilteredArraySchema(disruptionsTableSchema).safeParse(disruptions);

    if (!parsedDisruptions.success) {
        return {
            disruptions: [],
            pageCount: 0,
        };
    }

    return {
        disruptions: parsedDisruptions.data,
        pageCount: Math.ceil(count / pageSize),
    };
};

export const filterIsEmpty = (filter: Filter): boolean =>
    Object.keys(filter).length === 2 && filter.services.length === 0 && filter.operators.length === 0;

const formatServicesIntoRows = (filter: Filter, setFilter: Dispatch<SetStateAction<Filter>>) => {
    const cells: { cells: (string | JSX.Element)[] }[] = [];

    filter.services.forEach((service) => {
        cells.push({
            cells: [
                getServiceLabel(service),
                <button
                    key={service.id}
                    className="govuk-link"
                    onClick={() => {
                        const { services: filterServices } = filter;
                        const indexToRemove = filterServices.findIndex(
                            (filterService) => filterService.id === service.id,
                        );
                        filterServices.splice(indexToRemove, 1);
                        setFilter({ ...filter, services: filterServices });
                    }}
                >
                    Remove
                </button>,
            ],
        });
    });

    return cells;
};

export const handleFilterUpdate = (
    filter: Filter,
    setFilter: Dispatch<SetStateAction<Filter>>,
    key: keyof Filter,
    value: string,
) => {
    setFilter({ ...filter, [key]: value });
};
export type HandleDateFilterProps = {
    filter: Filter;
    setFilter: Dispatch<SetStateAction<Filter>>;
    typeOfDate: "start" | "end";
    value: string;
    setStartDateFilter: Dispatch<SetStateAction<string>>;
    setEndDateFilter: Dispatch<SetStateAction<string>>;
    schema: z.ZodTypeAny;
    endDateFilter: string;
    startDateFilter: string;
    setIncompatibleDatesError: Dispatch<SetStateAction<boolean>>;
};

export const handleDateFilterUpdate = (dateFilterProps: HandleDateFilterProps) => {
    if (dateFilterProps.typeOfDate === "start") {
        const { success } = dateFilterProps.schema.safeParse(dateFilterProps.value);
        if (success) {
            dateFilterProps.setStartDateFilter(dateFilterProps.value);
        } else {
            dateFilterProps.setStartDateFilter("");
        }

        if (!!dateFilterProps.endDateFilter && success) {
            if (
                dateIsSameOrBeforeSecondDate(
                    getFormattedDate(dateFilterProps.value),
                    getFormattedDate(dateFilterProps.endDateFilter),
                )
            ) {
                dateFilterProps.setIncompatibleDatesError(false);
                dateFilterProps.setFilter({
                    ...dateFilterProps.filter,
                    period: { startTime: dateFilterProps.value, endTime: dateFilterProps.endDateFilter },
                });
            } else {
                dateFilterProps.setIncompatibleDatesError(true);
                dateFilterProps.setFilter({ ...dateFilterProps.filter, period: undefined });
            }
        } else {
            dateFilterProps.setFilter({ ...dateFilterProps.filter, period: undefined });
        }
    } else {
        const { success } = dateFilterProps.schema.safeParse(dateFilterProps.value);
        if (success) {
            dateFilterProps.setEndDateFilter(dateFilterProps.value);
        } else {
            dateFilterProps.setEndDateFilter("");
        }

        if (!!dateFilterProps.startDateFilter && success) {
            if (
                dateIsSameOrBeforeSecondDate(
                    getFormattedDate(dateFilterProps.startDateFilter),
                    getFormattedDate(dateFilterProps.value),
                )
            ) {
                dateFilterProps.setIncompatibleDatesError(false);
                dateFilterProps.setFilter({
                    ...dateFilterProps.filter,
                    period: { startTime: dateFilterProps.startDateFilter, endTime: dateFilterProps.value },
                });
            } else {
                dateFilterProps.setIncompatibleDatesError(true);
                dateFilterProps.setFilter({ ...dateFilterProps.filter, period: undefined });
            }
        } else {
            dateFilterProps.setFilter({ ...dateFilterProps.filter, period: undefined });
        }
    }
};

const formatContentsIntoRows = (contents: TableDisruption[], isTemplate: boolean): ContentTable[] => {
    return contents.map((content) => {
        return {
            id: (
                <Link
                    className="govuk-link"
                    href={
                        content.status === Progress.draft && !isTemplate
                            ? content.consequenceLength && content.consequenceLength > 0
                                ? {
                                      pathname: `${REVIEW_DISRUPTION_PAGE_PATH}/${content.id}`,
                                      query: {
                                          return: VIEW_ALL_DISRUPTIONS_PAGE_PATH,
                                      },
                                  }
                                : {
                                      pathname: `${TYPE_OF_CONSEQUENCE_PAGE_PATH}/${content.id}/0`,
                                      query: {
                                          return: VIEW_ALL_DISRUPTIONS_PAGE_PATH,
                                      },
                                  }
                            : {
                                  pathname: `${DISRUPTION_DETAIL_PAGE_PATH}/${content.id}`,
                                  query: isTemplate
                                      ? {
                                            return: VIEW_ALL_TEMPLATES_PAGE_PATH,
                                            template: "true",
                                        }
                                      : {
                                            return: VIEW_ALL_DISRUPTIONS_PAGE_PATH,
                                        },
                              }
                    }
                    key={content.id}
                >
                    {content.displayId}
                </Link>
            ),
            summary: content.summary,
            modes: content.modes.map((mode) => splitCamelCaseToString(mode)).join(", ") || "N/A",
            start: convertDateTimeToFormat(content.validityStartTimestamp),
            end: content.validityEndTimestamp ? convertDateTimeToFormat(content.validityEndTimestamp) : "No end time",
            severity: splitCamelCaseToString(content.severity),
            status: splitCamelCaseToString(content.status),
        };
    });
};

const columns: TableColumn<ContentTable>[] = [
    {
        displayName: "ID",
        key: "id",
        widthClass: "w-[10%]",
    },
    {
        displayName: "Summary",
        key: "summary",
        widthClass: "w-[30%]",
    },
    {
        displayName: "Modes",
        key: "modes",
        widthClass: "w-[10%]",
    },
    {
        displayName: "Start",
        key: "start",
        sortable: true,
        widthClass: "w-[13%]",
    },
    {
        displayName: "End",
        key: "end",
        sortable: true,
        widthClass: "w-[13%]",
    },
    {
        displayName: "Severity",
        key: "severity",
        widthClass: "w-[12%]",
    },
    {
        displayName: "Status",
        key: "status",
        widthClass: "w-[12%]",
    },
];

const ViewAllContents = ({
    newContentId,
    adminAreaCodes,
    filterStatus,
    enableLoadingSpinnerOnPageLoad = true,
    isTemplate = false,
    orgId,
    showUnderground = false,
    showCoach = false,
}: ViewAllContentProps): ReactElement => {
    const [selectedServices, setSelectedServices] = useState<Service[]>([]);
    const [selectedOperators, setSelectedOperators] = useState<ConsequenceOperators[]>([]);
    const [servicesDataSource, setServicesDataSource] = useState<Datasource | "all">("all");

    const stateUpdater = (change: ConsequenceOperators[], _field: string): void => {
        setSelectedOperators([...change]);
    };
    const [filter, setFilter] = useState<Filter>({
        services: [],
        operators: [],
        status: filterStatus ?? undefined,
    });

    const [showFilters, setShowFilters] = useState(false);
    const [filtersLoading, setFiltersLoading] = useState(false);
    const [clearButtonClicked, setClearButtonClicked] = useState(false);
    const [contentsToDisplay, setContentsToDisplay] = useState<TableDisruption[]>([]);
    const [startDateFilter, setStartDateFilter] = useState("");
    const [endDateFilter, setEndDateFilter] = useState("");
    const [startDateFilterError, setStartDateFilterError] = useState(false);
    const [endDateFilterError, setEndDateFilterError] = useState(false);
    const [incompatibleDatesError, setIncompatibleDatesError] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [servicesList, setServicesList] = useState<Service[]>([]);
    const [operatorsList, setOperatorsList] = useState<Operator[]>([]);
    const [popUpState, setPopUpState] = useState(false);
    const [combinedServicesList, setCombinedServicesList] = useState<Service[]>([]);
    const [downloadPdf, setDownloadPdf] = useState(false);
    const [downloadExcel, setDownloadExcel] = useState(false);
    const [downloadCsv, setDownloadCsv] = useState(false);
    const [loadPage, setLoadPage] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    const [sortOrder, setSortOrder] = useState(SortOrder.desc);
    const [sortedField, setSortedField] = useState<keyof ContentTable | null>(null);
    const [toggleFetchData, setToggleFetchData] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoadPage(true);

            const data = await getDisruptionData(orgId, filter, pageNumber, isTemplate, 10, sortedField, sortOrder);

            setContentsToDisplay(data.disruptions);
            setTotalPages(data.pageCount);
            setLoadPage(false);
        };

        if (toggleFetchData) {
            fetchData()
                .then(() => {
                    setToggleFetchData(false);
                })
                .catch(() => {
                    setToggleFetchData(false);
                    setLoadPage(false);
                });
        }
    }, [toggleFetchData]);

    useEffect(() => {
        setToggleFetchData(true);
    }, [pageNumber]);

    useEffect(() => {
        if (pageNumber !== 1) {
            setPageNumber(1);
        } else {
            setToggleFetchData(true);
        }
    }, [filter, sortedField, sortOrder]);

    useEffect(() => {
        if (clearButtonClicked) {
            setStartDateFilter("");
            setStartDateFilterError(false);
            setEndDateFilter("");
            setEndDateFilterError(false);
            setSelectedOperators([]);
            setSelectedServices([]);
            setClearButtonClicked(false);
            setSearchText("");
        }
    }, [clearButtonClicked]);

    useEffect(() => {
        if (startDateFilter && !endDateFilter) {
            setEndDateFilterError(true);
        }

        if (endDateFilter && !startDateFilter) {
            setStartDateFilterError(true);
        }

        if (startDateFilter && endDateFilter) {
            setEndDateFilterError(false);
            setStartDateFilterError(false);
        }

        if (!startDateFilter && !endDateFilter) {
            setEndDateFilterError(false);
            setStartDateFilterError(false);
            setIncompatibleDatesError(false);
        }
    }, [startDateFilter, endDateFilter]);

    useEffect(() => {
        setFilter({ ...filter, services: selectedServices });
    }, [selectedServices]);

    useEffect(() => {
        setFilter({ ...filter, searchText });
    }, [searchText]);

    useEffect(() => {
        const filterOperatorsToSet: FilterOperator[] = [];
        selectedOperators.forEach((selOpNoc) => {
            const operator = operatorsList.find((op) => op.nocCode === selOpNoc.operatorNoc);
            if (operator) {
                filterOperatorsToSet.push({
                    operatorName: operator.operatorPublicName,
                    operatorRef: operator.nocCode,
                });
            }
        });

        setFilter({
            ...filter,
            operators: filterOperatorsToSet,
        });
    }, [selectedOperators]);

    useEffect(() => {
        const generatePdf = async () => {
            if (downloadPdf) {
                setIsExporting(true);
                const data = await retrieveAllDataForExport(orgId, filter);
                const parseDisruptions = exportDisruptionsSchema.safeParse(data);

                const pdf = createNewPdfDoc({ orientation: "landscape", format: "a1" });
                autoTable(pdf, {
                    head: [disruptionPdfHeaders],
                    body: parseDisruptions.success ? formatDisruptionsForPdf(parseDisruptions.data) : [],
                });
                pdf.save("Disruptions_list.pdf");
                setDownloadPdf(false);
                setIsExporting(false);
                setPopUpState(false);
            }
        };
        generatePdf().catch(() => {
            const pdf = createNewPdfDoc({ orientation: "landscape", format: "a1" });
            autoTable(pdf, {
                head: [disruptionPdfHeaders],
                body: [],
            });
            pdf.save("Disruptions_list.pdf");
            setIsExporting(false);
            setPopUpState(false);
        });
    }, [downloadPdf]);

    useEffect(() => {
        if (downloadExcel) {
            generateExcel().catch(async () => {
                await writeXlsxFile(["There was an error. Contact your admin team"], {
                    schema: [{ column: "error", type: String, value: (objectData: string) => objectData }],
                    fileName: "Disruptions_list.xlsx",
                });
                setIsExporting(false);
                setPopUpState(false);
            });
            setDownloadExcel(false);
        }
    }, [downloadExcel]);

    useEffect(() => {
        if (downloadCsv) {
            generateCsv().catch(() => {
                setIsExporting(false);
                setPopUpState(false);
            });
            setDownloadCsv(false);
        }
    }, [downloadCsv]);

    const exportHandler = (fileType: string) => {
        if (fileType === "pdf") {
            setDownloadPdf(true);
        } else if (fileType === "excel") {
            setDownloadExcel(true);
        } else if (fileType === "csv") {
            setDownloadCsv(true);
        }
    };

    const generateCsv = async () => {
        setIsExporting(true);
        const disruptions = await retrieveAllDataForExport(orgId, filter);
        const parseDisruptions = exportDisruptionsSchema.safeParse(disruptions);

        const csvData = Papa.unparse({
            fields: [
                "id",
                "title",
                "serviceModes",
                "operatorWide",
                "networkWide",
                "servicesAffectedCount",
                "stopsAffectedCount",
                "startDate",
                "endDate",
                "publishStartDate",
                "publishEndDate",
                "severity",
                "isLive",
                "status",
                "description",
                "disruptionType",
                "creationTime",
                "disruptionReason",
                "servicesAffected",
            ],
            data: parseDisruptions.success ? parseDisruptions.data : [],
        });

        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });

        saveAs(blob, "Disruptions_list.csv");

        setIsExporting(false);
        setPopUpState(false);
    };

    const generateExcel = async () => {
        setIsExporting(true);
        const disruptions = await retrieveAllDataForExport(orgId, filter);
        const parseDisruptions = exportDisruptionsSchema.safeParse(disruptions);

        const data = parseDisruptions.success ? parseDisruptions.data : [];

        const exportSchema: Schema<ExportDisruptionData> = getExportSchema();

        await writeXlsxFile(data, {
            schema: exportSchema,
            fileName: "Disruptions_list.xlsx",
        });

        setIsExporting(false);
        setPopUpState(false);
    };

    const setServicesAndOperators = async (adminAreaCodes: string[]) => {
        const [operators, servicesBodsData, servicesTndsData] = await Promise.all([
            fetchOperators({ adminAreaCodes: adminAreaCodes }),
            fetchServices({ adminAreaCodes: adminAreaCodes }),
            fetchServices({ adminAreaCodes: adminAreaCodes, dataSource: Datasource.tnds }),
        ]);

        const combinedServices = sortServices([
            ...filterServices(servicesBodsData),
            ...filterServices(servicesTndsData),
        ]);

        setCombinedServicesList(combinedServices);

        const uniqueOperatorArray = removeDuplicates(operators, "id");

        setOperatorsList(uniqueOperatorArray);
        setServicesList(combinedServices);
    };

    useEffect(() => {
        setServicesList(
            servicesDataSource === "all"
                ? combinedServicesList
                : combinedServicesList.filter((service) => service.dataSource === servicesDataSource),
        );
    }, [servicesDataSource, combinedServicesList]);

    const cancelActionHandler = (): void => {
        setPopUpState(false);
    };

    return (
        <>
            {popUpState ? (
                <ExportPopUp
                    confirmHandler={exportHandler}
                    closePopUp={cancelActionHandler}
                    isOpen={popUpState}
                    isExporting={isExporting}
                />
            ) : null}
            {isTemplate ? (
                <h1 className="govuk-heading-xl">Templates</h1>
            ) : (
                <h1 className="govuk-heading-xl">View all disruptions</h1>
            )}
            <div>
                <Link
                    href={`/create-disruption/${newContentId}${isTemplate ? "?template=true" : ""}`}
                    role="button"
                    draggable="false"
                    className="govuk-button govuk-button--start"
                    data-module="govuk-button"
                    id="create-new-button"
                >
                    {isTemplate ? "Create new template" : "Create new disruption"}
                    <svg
                        className="govuk-button__start-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="17.5"
                        height="19"
                        viewBox="0 0 33 40"
                        role="presentation"
                        focusable="false"
                    >
                        <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z" />
                    </svg>
                </Link>
                <div className="flex">
                    <button
                        className="govuk-button govuk-button--secondary block"
                        data-module="govuk-button"
                        onClick={async () => {
                            if (showFilters) {
                                setFilter({ services: [], operators: [] });
                                setClearButtonClicked(true);
                                setShowFilters(false);
                            } else {
                                setShowFilters(true);

                                if (servicesList.length === 0 && operatorsList.length === 0) {
                                    setFiltersLoading(true);
                                    await setServicesAndOperators(adminAreaCodes);
                                    setFiltersLoading(false);
                                }
                            }
                        }}
                    >
                        {showFilters ? "Hide and clear " : "Show "}filters
                    </button>
                    {showFilters && (
                        <button
                            className="govuk-button govuk-button--secondary ml-2"
                            data-module="govuk-button"
                            onClick={() => {
                                setFilter({ services: [], operators: [] });
                                setClearButtonClicked(true);
                            }}
                        >
                            Clear filters
                        </button>
                    )}
                    <button
                        className="govuk-button govuk-button--secondary ml-2"
                        data-module="govuk-button"
                        onClick={() => {
                            setPopUpState(true);
                        }}
                    >
                        Export
                    </button>
                </div>
            </div>

            {showFilters ? (
                <LoadingBox loading={filtersLoading}>
                    <div className="flex">
                        <div>
                            <label className="govuk-label govuk-label--s" htmlFor="summary-search">
                                ID/Summary
                            </label>
                            <div id="summary-search-hint" className="govuk-hint">
                                3 characters minimum
                            </div>
                            <input
                                className="govuk-input govuk-input--width-20 mb-4"
                                id="summary-search"
                                name="summarySearch"
                                type="text"
                                maxLength={20}
                                onChange={(e) => {
                                    setSearchText(e.target.value);
                                }}
                                value={searchText}
                                aria-describedby="summary-search-hint"
                            />
                        </div>
                    </div>
                    <OperatorSearch<FilterOperator>
                        display="Operators"
                        displaySize="s"
                        operators={operatorsList}
                        selectedOperators={selectedOperators}
                        stateUpdater={stateUpdater}
                        initialErrors={[]}
                        inputName="operatorName"
                        reset={clearButtonClicked}
                    />
                    {selectedOperators.length > 0 ? (
                        <Table
                            rows={selectedOperators
                                .sort((a, b) => {
                                    return a.operatorPublicName.localeCompare(b.operatorPublicName);
                                })
                                .map((selOpNoc) => {
                                    return {
                                        cells: [
                                            operatorsList.find((op) => op.nocCode === selOpNoc.operatorNoc)
                                                ?.operatorPublicName,
                                            selOpNoc.operatorNoc,
                                            <button
                                                key={selOpNoc.operatorNoc}
                                                className="govuk-link"
                                                onClick={() => {
                                                    const selectedOperatorsWithRemoved =
                                                        selectedOperators.filter((opNoc) => opNoc !== selOpNoc) || [];
                                                    stateUpdater(selectedOperatorsWithRemoved, "");
                                                }}
                                            >
                                                Remove
                                            </button>,
                                        ],
                                    };
                                })}
                        />
                    ) : null}
                    <ServiceSearch
                        services={servicesList}
                        setSelectedServices={setSelectedServices}
                        selectedServices={selectedServices}
                        reset={clearButtonClicked}
                        handleDataSourceUpdate={(dataSource) => setServicesDataSource(dataSource as Datasource)}
                        dataSource={servicesDataSource}
                    />

                    {filter.services.length > 0 ? <Table rows={formatServicesIntoRows(filter, setFilter)} /> : null}

                    {(startDateFilterError || endDateFilterError) && (
                        <div>
                            <span className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error: </span>
                                Both start date and end date must be provided to filter by date.
                            </span>
                        </div>
                    )}

                    {incompatibleDatesError && (
                        <div>
                            <span className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error: </span>
                                The end date must be the same day or after the start date.
                            </span>
                        </div>
                    )}

                    <div className="flex">
                        <DateSelector
                            display="Start date"
                            hint={{ hidden: true, text: "Enter in format DD/MM/YYYY" }}
                            value=""
                            disablePast={false}
                            inputName="disruptionStartDate"
                            stateUpdater={(value: string) => {
                                handleDateFilterUpdate({
                                    filter,
                                    setFilter,
                                    typeOfDate: "start",
                                    value,
                                    setStartDateFilter,
                                    setEndDateFilter,
                                    schema: validitySchema.shape.disruptionStartDate,
                                    endDateFilter,
                                    startDateFilter,
                                    setIncompatibleDatesError,
                                });
                                setClearButtonClicked(false);
                            }}
                            reset={clearButtonClicked}
                        />
                        <div className="ml-5">
                            <DateSelector
                                display="End date"
                                hint={{ hidden: true, text: "Enter in format DD/MM/YYYY" }}
                                value=""
                                disablePast={false}
                                inputName="disruptionEndDate"
                                stateUpdater={(value: string) => {
                                    handleDateFilterUpdate({
                                        filter,
                                        setFilter,
                                        typeOfDate: "end",
                                        value,
                                        setStartDateFilter,
                                        setEndDateFilter,
                                        schema: validitySchema.shape.disruptionEndDate,
                                        endDateFilter,
                                        startDateFilter,
                                        setIncompatibleDatesError,
                                    });
                                    setClearButtonClicked(false);
                                }}
                                reset={clearButtonClicked}
                            />
                        </div>
                    </div>

                    <div className="flex">
                        <Select
                            inputName="severityFilter"
                            display="Severity"
                            value={filter.severity}
                            defaultDisplay="Select a severity"
                            selectValues={[
                                { display: "Any", value: "any" },
                                ...DISRUPTION_SEVERITIES.sort((a, b) => a.display.localeCompare(b.display)),
                            ]}
                            stateUpdater={(value: string) => handleFilterUpdate(filter, setFilter, "severity", value)}
                            width="1/4"
                            useDefaultValue={false}
                        />
                        <div className="ml-10">
                            <Select
                                inputName="statusFilter"
                                display="Status"
                                value={filter.status}
                                defaultDisplay="Select a status"
                                selectValues={[
                                    { display: "Any", value: "any" },
                                    ...DISRUPTION_STATUSES.sort((a, b) => a.display.localeCompare(b.display)),
                                ]}
                                stateUpdater={(value: string) => handleFilterUpdate(filter, setFilter, "status", value)}
                                width="1/4"
                                useDefaultValue={false}
                            />
                        </div>
                        <div className="ml-10">
                            <Select
                                inputName="modeFilter"
                                display="Mode"
                                value={filter.mode}
                                defaultDisplay="Select a mode"
                                selectValues={[
                                    { display: "Any", value: "any" },
                                    ...filterVehicleModes(showUnderground, showCoach).sort((a, b) =>
                                        a.display.localeCompare(b.display),
                                    ),
                                ]}
                                stateUpdater={(value: string) => handleFilterUpdate(filter, setFilter, "mode", value)}
                                width="1/4"
                                useDefaultValue={false}
                            />
                        </div>
                    </div>
                </LoadingBox>
            ) : null}

            {enableLoadingSpinnerOnPageLoad ? (
                <LoadingBox loading={loadPage}>
                    <SortableTable<ContentTable>
                        columns={columns}
                        rows={formatContentsIntoRows(contentsToDisplay, isTemplate)}
                        currentPage={pageNumber}
                        setCurrentPage={setPageNumber}
                        pageCount={totalPages}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        sortedField={sortedField}
                        setSortedField={setSortedField}
                    />
                </LoadingBox>
            ) : (
                <SortableTable<ContentTable>
                    columns={columns}
                    rows={formatContentsIntoRows(contentsToDisplay, isTemplate)}
                    currentPage={pageNumber}
                    setCurrentPage={setPageNumber}
                    pageCount={totalPages}
                    sortOrder={sortOrder}
                    setSortOrder={setSortOrder}
                    sortedField={sortedField}
                    setSortedField={setSortedField}
                />
            )}
        </>
    );
};

export default memo(ViewAllContents);

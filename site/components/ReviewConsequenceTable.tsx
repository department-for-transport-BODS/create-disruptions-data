import { Consequence, Disruption } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { MAX_CONSEQUENCES } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import Link from "next/link";
import { ReactElement } from "react";
import {
    CONSEQUENCE_TYPES,
    CREATE_CONSEQUENCE_JOURNEYS_PATH,
    CREATE_CONSEQUENCE_NETWORK_PATH,
    CREATE_CONSEQUENCE_OPERATOR_PATH,
    CREATE_CONSEQUENCE_SERVICES_PATH,
    CREATE_CONSEQUENCE_STOPS_PATH,
    DISRUPTION_DETAIL_PAGE_PATH,
    REVIEW_DISRUPTION_PAGE_PATH,
    TYPE_OF_CONSEQUENCE_PAGE_PATH,
    VEHICLE_MODES,
} from "../constants";
import { getDisplayByValue, splitCamelCaseToString } from "../utils";
import SummaryList from "./form/SummaryList";

const getConsequenceUrl = (type: Consequence["consequenceType"]) => {
    switch (type) {
        case "networkWide":
            return CREATE_CONSEQUENCE_NETWORK_PATH;
        case "operatorWide":
            return CREATE_CONSEQUENCE_OPERATOR_PATH;
        case "stops":
            return CREATE_CONSEQUENCE_STOPS_PATH;
        case "services":
            return CREATE_CONSEQUENCE_SERVICES_PATH;
        case "journeys":
            return CREATE_CONSEQUENCE_JOURNEYS_PATH;
    }
};

export const createChangeLink = (
    key: string,
    href: string,
    disruptionId: string,
    index?: number,
    includePreviousPage?: boolean,
    isDisruptionDetail?: boolean,
    isTemplate?: boolean,
) => {
    return (
        <Link
            key={key}
            className="govuk-link"
            href={{
                pathname: `${href}/${disruptionId}${index !== undefined ? `/${index}` : ""}`,
                query: includePreviousPage
                    ? {
                          return: isDisruptionDetail ? DISRUPTION_DETAIL_PAGE_PATH : REVIEW_DISRUPTION_PAGE_PATH,
                          ...(isTemplate ? { template: isTemplate.toString() } : {}),
                      }
                    : isTemplate
                      ? { template: isTemplate.toString() }
                      : null,
            }}
        >
            Change
        </Link>
    );
};

export const createChangeLinkSummaryList = (
    href: string,
    disruptionId: string,
    index?: number,
    includePreviousPage?: boolean,
    isDisruptionDetail?: boolean,
    isTemplate?: boolean,
): {
    link:
        | string
        | {
              pathname: string;
              query: { template?: string | undefined; return: string } | { template: string } | null;
          };
    actionName: string;
} => {
    const linkProps = {
        pathname: `${href}/${disruptionId}${index !== undefined ? `/${index}` : ""}`,
        query: includePreviousPage
            ? {
                  return: isDisruptionDetail ? DISRUPTION_DETAIL_PAGE_PATH : REVIEW_DISRUPTION_PAGE_PATH,
                  ...(isTemplate ? { template: isTemplate.toString() } : {}),
              }
            : isTemplate
              ? { template: isTemplate.toString() }
              : null,
    };

    return {
        link: linkProps,
        actionName: "Change",
    };
};

const getRows = (
    consequence: Consequence,
    disruption: Disruption,
    isEditingAllowed: boolean,
    isDisruptionDetail?: boolean,
    isTemplate?: boolean,
    enableCancellationsFeatureFlag = false,
) => {
    const rows: {
        header?: string;
        value: string;
        actions?: {
            link:
                | string
                | {
                      pathname: string;
                      query: { template?: string | undefined; return: string } | { template: string } | null;
                  };
            actionName: string;
        }[];
    }[] = [
        {
            header: "Consequence type",
            value: getDisplayByValue(CONSEQUENCE_TYPES(enableCancellationsFeatureFlag), consequence.consequenceType),
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              TYPE_OF_CONSEQUENCE_PAGE_PATH,
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        },
        {
            header: "Mode of transport",
            value: getDisplayByValue(VEHICLE_MODES, consequence.vehicleMode),
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        },
    ];

    if (
        consequence.consequenceType === "services" ||
        (consequence.consequenceType === "journeys" && enableCancellationsFeatureFlag)
    ) {
        rows.push({
            header: "Service(s)",
            value: consequence.services
                .map(
                    (service) =>
                        `${service.lineName} - ${service.origin} - ${service.destination} (${service.operatorShortName})`,
                )
                .join(", "),
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        });
    }

    if (consequence.consequenceType === "services" || consequence.consequenceType === "stops") {
        rows.push({
            header: "Stops affected",
            value: consequence.stops
                ? consequence.stops
                      .map((stop) =>
                          stop.commonName && stop.indicator && stop.atcoCode
                              ? `${stop.commonName} ${stop.indicator} ${stop.atcoCode}`
                              : `${stop.commonName} ${stop.atcoCode}`,
                      )
                      .join(", ")
                : "N/A",
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        });
    }

    if (consequence.consequenceType === "journeys" && enableCancellationsFeatureFlag) {
        rows.push({
            header: "Journeys",
            value: consequence.journeys
                ? consequence.journeys.map((journey) => `${journey.departureTime} ${journey.direction}`).join(", ")
                : "N/A",
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        });
    }

    if (consequence.consequenceType === "operatorWide") {
        rows.push({
            header: "Operators affected",
            value: consequence.consequenceOperators
                ? consequence.consequenceOperators.map((op) => op.operatorNoc).join(", ")
                : "N/A",
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        });
    }
    if (consequence.consequenceType === "networkWide") {
        rows.push({
            header: "Disruption Area",
            value: consequence.disruptionArea ? [...consequence.disruptionArea].join(", ") : "N/A",
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        });
    }

    rows.push(
        {
            header: "Advice to display",
            value: consequence.description,
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        },
        {
            header:
                consequence.consequenceType === "journeys" && enableCancellationsFeatureFlag
                    ? "Cancel Journeys"
                    : "Remove from journey planner",
            value: splitCamelCaseToString(consequence.removeFromJourneyPlanners),
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        },
        {
            header: "Disruption delay",
            value: consequence.disruptionDelay ? `${consequence.disruptionDelay} minutes` : "N/A",
            ...(isEditingAllowed
                ? {
                      actions: [
                          createChangeLinkSummaryList(
                              getConsequenceUrl(consequence.consequenceType),
                              disruption.id,
                              consequence.consequenceIndex,
                              true,
                              isDisruptionDetail,
                              isTemplate,
                          ),
                      ],
                  }
                : {}),
        },
    );
    return rows;
};

interface ReviewConsequenceTableProps {
    consequence: Consequence;
    disruption: Disruption;
    deleteActionHandler: (
        name: string,
        hiddenInputs: {
            name: string;
            value: string;
        }[],
    ) => void;
    isDisruptionDetail?: boolean;
    isTemplate?: boolean;
    isEditingAllowed: boolean;
    enableCancellationsFeatureFlag: boolean;
}

const ReviewConsequenceTable = ({
    consequence,
    disruption,
    deleteActionHandler,
    isDisruptionDetail,
    isTemplate,
    isEditingAllowed,
    enableCancellationsFeatureFlag = false,
}: ReviewConsequenceTableProps): ReactElement => {
    const hiddenInputs = [
        {
            name: "id",
            value: consequence.consequenceIndex.toString(),
        },
        {
            name: "disruptionId",
            value: disruption.id,
        },
    ];

    if (isDisruptionDetail) {
        hiddenInputs.push({
            name: "inEdit",
            value: "true",
        });
    }
    return (
        <>
            <SummaryList
                rows={getRows(
                    consequence,
                    disruption,
                    isEditingAllowed,
                    isDisruptionDetail,
                    isTemplate,
                    enableCancellationsFeatureFlag,
                )}
            />
            {isEditingAllowed && (
                <>
                    <button
                        key={consequence.consequenceIndex}
                        className="govuk-button govuk-button--warning mt-4"
                        data-module="govuk-button"
                        onClick={(e) => {
                            e.preventDefault();
                            deleteActionHandler("consequence", hiddenInputs);
                        }}
                    >
                        Delete consequence
                    </button>
                    <button
                        key={`duplicate-${consequence.consequenceIndex}`}
                        className={`govuk-button govuk-button--secondary mt-4 ml-4${
                            disruption.consequences && disruption.consequences.length >= MAX_CONSEQUENCES
                                ? " pointer-events-none govuk-button--disabled"
                                : ""
                        }`}
                        data-module="govuk-button"
                        formAction={`/api/duplicate-consequence?consequenceId=${consequence.consequenceIndex}&return=${
                            isDisruptionDetail ? DISRUPTION_DETAIL_PAGE_PATH : REVIEW_DISRUPTION_PAGE_PATH
                        }${isTemplate ? "&template=true" : ""}`}
                    >
                        Duplicate consequence
                    </button>
                </>
            )}
        </>
    );
};

export default ReviewConsequenceTable;

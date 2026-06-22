import { DisruptionInfo, Validity } from "@create-disruptions-data/shared-ts/disruptionTypes";
import {
    disruptionInfoSchema,
    validitySchema,
    validitySchemaRefined,
} from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { MiscellaneousReason } from "@create-disruptions-data/shared-ts/enums";
import { NextPageContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseCookies } from "nookies";
import { Fragment, ReactElement, SyntheticEvent, useEffect, useRef, useState } from "react";
import DeleteDisruptionButton from "../../components/buttons/DeleteDisruptionButton";
import Checkbox from "../../components/form/Checkbox";
import CsrfForm from "../../components/form/CsrfForm";
import DateSelector from "../../components/form/DateSelector";
import ErrorSummary from "../../components/form/ErrorSummary";
import FormElementWrapper, { FormGroupWrapper } from "../../components/form/FormElementWrapper";
import Radios from "../../components/form/Radios";
import Select from "../../components/form/Select";
import Table from "../../components/form/Table";
import TextInput from "../../components/form/TextInput";
import TimeSelector from "../../components/form/TimeSelector";
import { BaseLayout } from "../../components/layout/Layout";
import {
    COOKIES_DISRUPTION_ERRORS,
    DASHBOARD_PAGE_PATH,
    DISRUPTION_REASONS,
    VIEW_ALL_TEMPLATES_PAGE_PATH,
} from "../../constants";
import { getDisruptionById } from "../../data/db";
import { PageState } from "../../interfaces";
import { flattenZodErrors } from "../../utils";
import { destroyCookieOnResponseObject, getPageState } from "../../utils/apiUtils";
import { getSession } from "../../utils/apiUtils/auth";
import { convertDateTimeToFormat, getEndingOnDateText } from "../../utils/dates";
import { getStateUpdater, returnTemplateOverview, showCancelButton } from "../../utils/formUtils";

const title = "Create Disruptions";
const description = "Create Disruptions page for the Create Transport Disruptions Service";

export interface DisruptionPageProps extends PageState<Partial<DisruptionInfo>> {
    disruptionExists?: boolean;
    consequenceIndex?: number;
}

const arrayDateFields = ["disruptionStartDate", "disruptionEndDate", "publishStartDate", "publishEndDate"];
const arrayTimeFields = ["disruptionStartTime", "publishStartTime"];
const arrayEndTimeFields = ["disruptionEndTime", "publishEndTime"];

const CreateDisruption = (props: DisruptionPageProps): ReactElement<any> => {
    const initialValidity: Validity = {
        disruptionStartDate: props.inputs.disruptionStartDate || "",
        disruptionEndDate: props.inputs.disruptionEndDate || "",
        disruptionStartTime: props.inputs.disruptionStartTime || "",
        disruptionEndTime: props.inputs.disruptionEndTime || "",
        disruptionNoEndDateTime: props.inputs.disruptionNoEndDateTime || "",
        disruptionRepeats: props.inputs.disruptionRepeats || "doesntRepeat",
        disruptionRepeatsEndDate: props.inputs.disruptionRepeatsEndDate || "",
    };

    const [pageState, setDisruptionPageState] = useState(props);
    const [validity, setValidity] = useState<Validity>(initialValidity);
    const [addValidityClicked, setAddValidityClicked] = useState(false);

    const queryParams = useRouter().query;
    const displayCancelChangesButton = showCancelButton(queryParams);
    const isTemplate = queryParams.template?.toString() ?? "";
    const returnPath = queryParams.return?.toString() ?? "";

    const returnToTemplateOverview = returnTemplateOverview(queryParams);

    const doesntRepeatRef = useRef<HTMLInputElement>(null);
    const dailyRef = useRef<HTMLInputElement>(null);
    const weeklyRef = useRef<HTMLInputElement>(null);

    const [dateColumnError, setDateColumnError] = useState(false);
    const [timeColumnError, setTimeColumnError] = useState(false);
    const [endTimeColumnError, setEndTimeColumnError] = useState(false);

    const hasInitialised = useRef(false);
    useEffect(() => {
        if (window.GOVUKFrontend && !hasInitialised.current) {
            window.GOVUKFrontend.initAll();
        }
        hasInitialised.current = true;
    });

    useEffect(() => {
        const errorInDateColumn = pageState.errors.some((errors) => arrayDateFields.includes(errors.id));
        const errorInTimeColumn = pageState.errors.some((errors) => arrayTimeFields.includes(errors.id));
        const errorInEndTimeColumn = pageState.errors.some((errors) => arrayEndTimeFields.includes(errors.id));

        setDateColumnError(errorInDateColumn);
        setTimeColumnError(errorInTimeColumn);
        setEndTimeColumnError(errorInEndTimeColumn);
    }, [pageState.errors]);

    const addValidity = (e: SyntheticEvent) => {
        e.preventDefault();

        setAddValidityClicked(false);

        const filteredValidity =
            validity.disruptionNoEndDateTime === "true"
                ? {
                      ...validity,
                      disruptionEndDate: "",
                      disruptionEndTime: "",
                  }
                : validity;

        const parsed = validitySchemaRefined.safeParse(filteredValidity);

        if (!parsed.success) {
            setDisruptionPageState({
                ...pageState,
                errors: [
                    ...pageState.errors.filter((err) => !Object.keys(validitySchema.shape).includes(err.id)),
                    ...flattenZodErrors(parsed.error),
                ],
            });
        } else {
            setDisruptionPageState({
                ...pageState,
                inputs: {
                    ...pageState.inputs,
                    validity: [...(pageState.inputs.validity ?? []), filteredValidity],
                },
                errors: [...pageState.errors.filter((err) => !Object.keys(validitySchema.shape).includes(err.id))],
            });

            setValidity({
                disruptionStartDate: "",
                disruptionEndDate: "",
                disruptionStartTime: "",
                disruptionEndTime: "",
                disruptionNoEndDateTime: "",
                disruptionRepeats: "doesntRepeat",
                disruptionRepeatsEndDate: "",
            });

            setAddValidityClicked(true);
        }
    };

    const removeValidity = (e: SyntheticEvent, index: number) => {
        e.preventDefault();
        if (pageState.inputs.validity) {
            const validity = [...pageState.inputs.validity];
            validity.splice(index, 1);

            setDisruptionPageState({
                ...pageState,
                inputs: {
                    ...pageState.inputs,
                    validity,
                },
                errors: pageState.errors,
            });
        }
    };

    const getValidityRows = () => {
        if (pageState.inputs.validity) {
            return pageState.inputs.validity.map((validity, i) => {
                const endingOnDate =
                    validity.disruptionRepeats === "daily" || validity.disruptionRepeats === "weekly"
                        ? validity.disruptionRepeatsEndDate
                        : null;

                return {
                    header: `Validity period ${i + 1}`,
                    cells: [
                        validity.disruptionEndDate &&
                        validity.disruptionEndTime &&
                        !validity.disruptionNoEndDateTime ? (
                            validity.disruptionRepeats &&
                            validity.disruptionRepeats !== "doesntRepeat" &&
                            endingOnDate ? (
                                <span key={i}>
                                    {validity.disruptionStartDate} {validity.disruptionStartTime} -{" "}
                                    {validity.disruptionEndDate} {validity.disruptionEndTime} <br /> Repeats{" "}
                                    {validity.disruptionRepeats} until {endingOnDate}{" "}
                                </span>
                            ) : (
                                `${validity.disruptionStartDate} ${validity.disruptionStartTime} - ${validity.disruptionEndDate} ${validity.disruptionEndTime}`
                            )
                        ) : (
                            `${validity.disruptionStartDate} ${validity.disruptionStartTime} - No end date/time`
                        ),
                        <button
                            id={`remove-validity-period-${i + 1}`}
                            key={`remove-validity-period-${i + 1}`}
                            className="govuk-link"
                            onClick={(e) => removeValidity(e, i)}
                        >
                            Remove
                        </button>,
                    ],
                };
            });
        }
        return [];
    };

    const stateUpdater = getStateUpdater(setDisruptionPageState, pageState);

    const validityStateUpdater = (change: string, field: string) => {
        setValidity({ ...validity, [field]: change });
    };

    const updateDisruptionRepeats = (change: string, field: string) => {
        setValidity({
            ...validity,
            [field]: change,
            disruptionNoEndDateTime: change === "daily" || change === "weekly" ? "" : validity.disruptionNoEndDateTime,
            disruptionRepeatsEndDate: "",
        });
    };

    const handleNow = (e: SyntheticEvent) => {
        e.preventDefault();
        const dateTime = new Date();

        setDisruptionPageState({
            ...pageState,
            inputs: {
                ...pageState.inputs,
                publishStartDate: convertDateTimeToFormat(dateTime, "DD/MM/YYYY"),
                publishStartTime: convertDateTimeToFormat(dateTime, "HHmm"),
            },
        });
    };

    const handleStartDateNow = (e: SyntheticEvent) => {
        e.preventDefault();
        const dateTime = new Date();

        setValidity({
            ...validity,
            disruptionStartDate: convertDateTimeToFormat(dateTime, "DD/MM/YYYY"),
            disruptionStartTime: convertDateTimeToFormat(dateTime, "HHmm"),
        });
    };

    const getEndingDateDisplay = () => {
        return validity.disruptionRepeats !== "doesntRepeat" && validity.disruptionRepeatsEndDate
            ? `The validity period ends on ${getEndingOnDateText(
                  validity.disruptionRepeats ?? undefined,
                  validity.disruptionRepeatsEndDate,
                  validity.disruptionStartDate,
                  validity.disruptionEndDate ?? undefined,
              )}${validity.disruptionEndTime ? ` at ${validity.disruptionEndTime}` : ""}`
            : null;
    };

    return (
        <BaseLayout title={title} description={description} errors={props.errors}>
            <CsrfForm
                action={`/api/create-disruption${isTemplate === "true" ? "?template=true" : ""}`}
                method="post"
                csrfToken={props.csrfToken}
            >
                <>
                    <ErrorSummary errors={props.errors} />
                    <div className="govuk-form-group">
                        <h1 className="govuk-heading-xl">
                            {isTemplate === "true"
                                ? "Create a new template"
                                : `Create a new disruption${returnToTemplateOverview ? " from template" : ""}`}
                        </h1>

                        <Radios<DisruptionInfo>
                            display="Type of disruption"
                            radioDetail={[
                                {
                                    value: "planned",
                                    display: "Planned",
                                    conditionalElement: <div />,
                                },
                                {
                                    value: "unplanned",
                                    display: "Unplanned",
                                    conditionalElement: <div />,
                                },
                            ]}
                            inputName="disruptionType"
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.disruptionType}
                            initialErrors={pageState.errors}
                        />

                        <TextInput<DisruptionInfo>
                            display="Summary"
                            inputName="summary"
                            widthClass="w-3/4"
                            maxLength={100}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.summary}
                            initialErrors={pageState.errors}
                        />

                        <TextInput<DisruptionInfo>
                            display="Description"
                            inputName="description"
                            widthClass="w-3/4"
                            textArea
                            rows={3}
                            maxLength={1000}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.description}
                            initialErrors={pageState.errors}
                        />

                        <TextInput<DisruptionInfo>
                            inputName="associatedLink"
                            display="Associated Link (optional)"
                            widthClass="w-3/4"
                            maxLength={250}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.associatedLink}
                        />

                        <Select<DisruptionInfo>
                            inputName="disruptionReason"
                            display="Reason for disruption"
                            defaultDisplay="Select a reason"
                            selectValues={DISRUPTION_REASONS.sort((a, b) => a.display.localeCompare(b.display))}
                            stateUpdater={stateUpdater}
                            value={pageState.inputs.disruptionReason}
                            initialErrors={pageState.errors}
                        />
                    </div>
                    <div className="govuk-form-group govuk-!-padding-top-3">
                        <h2 className="govuk-heading-l">When is the disruption?</h2>
                        <FormGroupWrapper errors={pageState.errors} errorIds={["validity"]}>
                            <FormElementWrapper
                                errors={pageState.errors}
                                errorId={"validity"}
                                errorClass={"govuk-input--error"}
                            >
                                <Table rows={pageState.inputs.validity ? getValidityRows() : []} />
                            </FormElementWrapper>
                        </FormGroupWrapper>
                        {(pageState.inputs.validity || []).map((item, index) => (
                            <Fragment key={`validity-${item.disruptionStartDate}`}>
                                <input type="hidden" name={`validity${index + 1}`} value={item.disruptionStartDate} />
                                <input type="hidden" name={`validity${index + 1}`} value={item.disruptionStartTime} />
                                <input
                                    type="hidden"
                                    name={`validity${index + 1}`}
                                    value={item.disruptionEndDate ?? undefined}
                                />
                                <input
                                    type="hidden"
                                    name={`validity${index + 1}`}
                                    value={item.disruptionEndTime ?? undefined}
                                />
                                <input
                                    type="hidden"
                                    name={`validity${index + 1}`}
                                    value={item.disruptionNoEndDateTime ?? undefined}
                                />
                                <input
                                    type="hidden"
                                    name={`validity${index + 1}`}
                                    value={item.disruptionRepeats ?? undefined}
                                />
                                <input
                                    type="hidden"
                                    name={`validity${index + 1}`}
                                    value={item.disruptionRepeatsEndDate ?? undefined}
                                />
                            </Fragment>
                        ))}
                        <div
                            className={`flex pb-8 ${
                                dateColumnError || timeColumnError || endTimeColumnError ? "order-first" : "items-end"
                            }`}
                        >
                            <div
                                className={`${
                                    dateColumnError ? "w-[410px] pr-1 sm:w-[50%] @screen xs:w-[50%]" : "pr-1"
                                }`}
                            >
                                <DateSelector<Validity>
                                    display="Start date"
                                    hint={{ hidden: false, text: "Enter in format DD/MM/YYYY" }}
                                    value={validity.disruptionStartDate}
                                    disablePast={false}
                                    inputName={"disruptionStartDate"}
                                    stateUpdater={validityStateUpdater}
                                    initialErrors={pageState.errors}
                                    reset={addValidityClicked}
                                    minWidth={`w-[203px] ${
                                        dateColumnError ? "lg:w-[50%] sm:w-[80%] @screen xs:w-[80%]" : ""
                                    }`}
                                    inputDivWidth={
                                        dateColumnError ? "w-[400px] lg:w-[80%] sm:w-[100%] @screen xs:w-[100%]" : ""
                                    }
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                            <div className="pl-4.5 flex flex-col justify-end lg:w-[70%] sm:w-[50%] @screen xs:w-[50%]">
                                <TimeSelector<Validity>
                                    display="Start time"
                                    hint="Enter the time in 24hr format. For example 0900 is 9am, 1730 is 5:30pm"
                                    value={validity.disruptionStartTime}
                                    inputName="disruptionStartTime"
                                    stateUpdater={validityStateUpdater}
                                    initialErrors={pageState.errors}
                                    reset={addValidityClicked}
                                    showNowButton={handleStartDateNow}
                                    inputDivWidth={
                                        timeColumnError
                                            ? pageState.errors.some((error) => error.id === "disruptionStartTime")
                                                ? "w-[280px]"
                                                : "w-[300px]"
                                            : ""
                                    }
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                        </div>
                        <div
                            className={`flex pb-8 ${
                                dateColumnError || timeColumnError || endTimeColumnError ? "order-first" : "items-end"
                            }`}
                        >
                            <div
                                className={`${
                                    dateColumnError ? "w-[410px] pr-1 sm:w-[50%] @screen xs:w-[50%]" : "pr-2"
                                }`}
                            >
                                <DateSelector<Validity>
                                    display="End date"
                                    hint={{ hidden: true, text: "Enter in format DD/MM/YYYY" }}
                                    value={validity.disruptionEndDate ?? undefined}
                                    disabled={validity.disruptionNoEndDateTime === "true"}
                                    disablePast={false}
                                    inputName="disruptionEndDate"
                                    stateUpdater={validityStateUpdater}
                                    initialErrors={pageState.errors}
                                    reset={addValidityClicked}
                                    minWidth={`w-[203px] ${
                                        dateColumnError ? "lg:w-[50%] sm:w-[80%] @screen xs:w-[80%]" : ""
                                    }`}
                                    inputDivWidth={
                                        dateColumnError ? "w-[400px] lg:w-[80%] sm:w-[100%] @screen xs:w-[100%]" : ""
                                    }
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                            <div className="pl-4.5 flex flex-col justify-end lg:w-[70%] sm:w-[50%] @screen xs:w-[50%]">
                                <TimeSelector<Validity>
                                    display="End time"
                                    value={validity.disruptionEndTime ?? undefined}
                                    disabled={validity.disruptionNoEndDateTime === "true"}
                                    inputName="disruptionEndTime"
                                    stateUpdater={validityStateUpdater}
                                    initialErrors={pageState.errors}
                                    reset={addValidityClicked}
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                        </div>

                        <Checkbox<Validity>
                            inputName="disruptionNoEndDateTime"
                            display="Does the disruption have an end datetime?"
                            hideLegend
                            checkboxDetail={[
                                {
                                    display: "No end date/time",
                                    value: "true",
                                    checked: validity.disruptionNoEndDateTime === "true",
                                },
                            ]}
                            stateUpdater={validityStateUpdater}
                            initialErrors={pageState.errors}
                            reset={addValidityClicked}
                        />

                        <div
                            className={`flex pb-8 ${
                                dateColumnError || timeColumnError || endTimeColumnError ? "order-first" : "items-end"
                            }`}
                        >
                            <div
                                className={`${
                                    dateColumnError ? "w-[410px] pr-1 sm:w-[50%] @screen xs:w-[50%]" : "pr-1"
                                }`}
                            >
                                <DateSelector<DisruptionInfo>
                                    display="Publication start date"
                                    hint={{ hidden: false, text: "Enter in format DD/MM/YYYY" }}
                                    value={
                                        pageState.inputs.publishStartDate ||
                                        validity.disruptionRepeats !== "doesntRepeat" ||
                                        !!pageState.errors.find((error) => error.id === "publishStartDate")
                                            ? pageState.inputs.publishStartDate
                                            : validity.disruptionStartDate
                                    }
                                    disablePast={false}
                                    inputName="publishStartDate"
                                    stateUpdater={stateUpdater}
                                    initialErrors={pageState.errors}
                                    minWidth={`w-[203px] ${
                                        dateColumnError ? "lg:w-[50%] sm:w-[80%] @screen xs:w-[80%]" : ""
                                    }`}
                                    inputDivWidth={
                                        dateColumnError ? "w-[400px] lg:w-[80%] sm:w-[100%] @screen xs:w-[100%]" : ""
                                    }
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                            <div className="pl-4 flex flex-col justify-end lg:w-[70%] sm:w-[50%] @screen xs:w-[50%]">
                                <TimeSelector<DisruptionInfo>
                                    display="Publication start time"
                                    hint="Enter the time in 24hr format. For example 0900 is 9am, 1730 is 5:30pm"
                                    value={
                                        pageState.inputs.publishStartTime ||
                                        validity.disruptionRepeats !== "doesntRepeat" ||
                                        !!pageState.errors.find((error) => error.id === "publishStartTime")
                                            ? pageState.inputs.publishStartTime
                                            : validity.disruptionStartTime
                                    }
                                    inputName="publishStartTime"
                                    stateUpdater={stateUpdater}
                                    initialErrors={pageState.errors}
                                    showNowButton={handleNow}
                                    inputDivWidth={
                                        timeColumnError
                                            ? pageState.errors.some((error) => error.id === "publishStartTime")
                                                ? "w-[280px]"
                                                : "w-[300px]"
                                            : ""
                                    }
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                        </div>

                        <div
                            className={`flex pb-8 ${
                                dateColumnError || timeColumnError || endTimeColumnError ? "order-first" : "items-end"
                            }`}
                        >
                            <div
                                className={`${
                                    dateColumnError ? "w-[410px] pr-1 sm:w-[50%] @screen xs:w-[50%]" : "pr-2"
                                }`}
                            >
                                <DateSelector<DisruptionInfo>
                                    display="Publication end date"
                                    hint={{ hidden: true, text: "Enter in format DD/MM/YYYY" }}
                                    value={
                                        pageState.inputs.publishEndDate ||
                                        validity.disruptionRepeats !== "doesntRepeat" ||
                                        !!pageState.errors.find((error) => error.id === "publishEndDate")
                                            ? pageState.inputs.publishEndDate
                                            : validity.disruptionEndDate ?? undefined
                                    }
                                    disabled={validity.disruptionNoEndDateTime === "true"}
                                    disablePast={false}
                                    inputName="publishEndDate"
                                    stateUpdater={stateUpdater}
                                    initialErrors={pageState.errors}
                                    minWidth={`w-[203px] ${
                                        dateColumnError ? "lg:w-[50%] sm:w-[80%] @screen xs:w-[80%]" : ""
                                    }`}
                                    inputDivWidth={
                                        dateColumnError ? "w-[400px] lg:w-[80%] sm:w-[100%] @screen xs:w-[100%]" : ""
                                    }
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                            <div className="pl-4 flex flex-col justify-end lg:w-[70%] sm:w-[50%] @screen xs:w-[50%]">
                                <TimeSelector<DisruptionInfo>
                                    display="Publication end time"
                                    value={
                                        pageState.inputs.publishEndTime ||
                                        validity.disruptionRepeats !== "doesntRepeat" ||
                                        !!pageState.errors.find((error) => error.id === "publishEndTime")
                                            ? pageState.inputs.publishEndTime
                                            : validity.disruptionEndTime ?? undefined
                                    }
                                    disabled={validity.disruptionNoEndDateTime === "true"}
                                    inputName="publishEndTime"
                                    stateUpdater={stateUpdater}
                                    initialErrors={pageState.errors}
                                    errorAlign={dateColumnError || timeColumnError || endTimeColumnError}
                                />
                            </div>
                        </div>

                        <Radios<DisruptionInfo>
                            display="Does this disruption repeat?"
                            radioDetail={[
                                {
                                    value: "doesntRepeat",
                                    display: "Doesn't repeat",
                                    ref: doesntRepeatRef,
                                    conditionalElement: <div />,
                                },
                                {
                                    value: "daily",
                                    display: "Daily",
                                    ref: dailyRef,
                                    disabled: validity.disruptionNoEndDateTime === "true",
                                    conditionalElement: (
                                        <DateSelector<Validity>
                                            display="Ending on"
                                            hint={{ hidden: false, text: "Enter in format DD/MM/YYYY" }}
                                            value={validity.disruptionRepeatsEndDate ?? undefined}
                                            disablePast={false}
                                            inputName="disruptionRepeatsEndDate"
                                            stateUpdater={validityStateUpdater}
                                            initialErrors={pageState.errors}
                                            reset={addValidityClicked || validity.disruptionRepeats !== "daily"}
                                            suffixId="daily"
                                        />
                                    ),
                                },
                                {
                                    value: "weekly",
                                    display: "Weekly",
                                    ref: weeklyRef,
                                    disabled: validity.disruptionNoEndDateTime === "true",
                                    conditionalElement: (
                                        <DateSelector<Validity>
                                            display="Ending on"
                                            hint={{ hidden: false, text: "Enter in format DD/MM/YYYY" }}
                                            value={validity.disruptionRepeatsEndDate ?? undefined}
                                            disablePast={false}
                                            inputName="disruptionRepeatsEndDate"
                                            stateUpdater={validityStateUpdater}
                                            initialErrors={pageState.errors}
                                            reset={addValidityClicked || validity.disruptionRepeats !== "weekly"}
                                        />
                                    ),
                                },
                            ]}
                            inputName="disruptionRepeats"
                            stateUpdater={updateDisruptionRepeats}
                            value={
                                validity.disruptionNoEndDateTime === "true"
                                    ? "doesntRepeat"
                                    : validity.disruptionRepeats ?? undefined
                            }
                            initialErrors={pageState.errors}
                        />
                        <legend>{getEndingDateDisplay()}</legend>

                        <button
                            className="govuk-button govuk-button--secondary mt-8"
                            data-module="govuk-button"
                            onClick={addValidity}
                            disabled={validity.disruptionNoEndDateTime === "true"}
                        >
                            Add another validity period
                        </button>
                    </div>

                    <input type="hidden" name="id" value={props.disruptionId} />
                    <input type="hidden" name="displayId" value={pageState.inputs.displayId} />
                    <input type="hidden" name="consequenceIndex" value={props.consequenceIndex} />

                    {pageState.inputs.permitReferenceNumber && (
                        <input
                            type="hidden"
                            name="permitReferenceNumber"
                            value={pageState.inputs.permitReferenceNumber}
                        />
                    )}

                    <button className="govuk-button" data-module="govuk-button">
                        Save and continue
                    </button>

                    {displayCancelChangesButton && pageState.disruptionId ? (
                        <Link
                            role="button"
                            href={
                                returnToTemplateOverview || isTemplate === "true"
                                    ? `${returnPath}/${pageState.disruptionId || ""}?template=true`
                                    : `${returnPath}/${pageState.disruptionId || ""}`
                            }
                            className="govuk-button ml-5 govuk-button--secondary"
                        >
                            Cancel Changes
                        </Link>
                    ) : null}

                    {!props.disruptionExists ? (
                        <Link
                            role="button"
                            href={isTemplate === "true" ? VIEW_ALL_TEMPLATES_PAGE_PATH : DASHBOARD_PAGE_PATH}
                            className="govuk-button ml-5 govuk-button--secondary"
                        >
                            Cancel
                        </Link>
                    ) : null}

                    {props.disruptionExists && (
                        <DeleteDisruptionButton
                            disruptionId={props.disruptionId}
                            csrfToken={props.csrfToken}
                            isTemplate={isTemplate}
                            returnPath={returnPath}
                        />
                    )}
                </>
            </CsrfForm>
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: DisruptionPageProps }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_DISRUPTION_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    const session = getSession(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    const disruptionId = ctx.query.disruptionId?.toString() ?? "";
    const disruption = await getDisruptionById(disruptionId, session.orgId);

    const pageState = getPageState(errorCookie, disruptionInfoSchema, disruptionId, disruption ?? undefined);

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_DISRUPTION_ERRORS, ctx.res);

    if (
        ctx.query.permitReferenceNumber &&
        ctx.query.roadworkStartDateTime &&
        ctx.query.roadworkEndDateTime &&
        ctx.query.roadworkSummary
    ) {
        const permitReferenceNumber = decodeURIComponent(ctx.query.permitReferenceNumber.toString());
        const roadworkStartDateTime = decodeURIComponent(ctx.query.roadworkStartDateTime.toString());
        const roadworkEndDateTime = decodeURIComponent(ctx.query.roadworkEndDateTime.toString());

        return {
            props: {
                ...pageState,
                consequenceIndex: 0,
                inputs: {
                    ...pageState.inputs,
                    permitReferenceNumber: permitReferenceNumber,
                    summary: decodeURIComponent(ctx.query.roadworkSummary.toString()),
                    disruptionReason: MiscellaneousReason.roadworks,
                    disruptionStartDate: convertDateTimeToFormat(roadworkStartDateTime),
                    disruptionEndDate: convertDateTimeToFormat(roadworkEndDateTime),
                    disruptionStartTime: convertDateTimeToFormat(roadworkStartDateTime, "HHmm"),
                    disruptionEndTime: convertDateTimeToFormat(roadworkEndDateTime, "HHmm"),
                    disruptionRepeats: "doesntRepeat",
                    disruptionRepeatsEndDate: "",
                },
            },
        };
    }

    if (!disruption) {
        return {
            props: {
                ...pageState,
                consequenceIndex: 0,
            },
        };
    }

    return {
        props: {
            ...pageState,
            disruptionExists: true,
            consequenceIndex: disruption.consequences?.[0]?.consequenceIndex ?? 0,
        },
    };
};

export default CreateDisruption;

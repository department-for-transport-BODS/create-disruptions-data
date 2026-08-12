import { Stop, StopsConsequence } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { stopSchema, stopsConsequenceSchema } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { Modes, VehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { LoadingBox } from "@govuk-react/loading-box";
import {
    CSSProperties,
    Dispatch,
    ReactElement,
    SetStateAction,
    SyntheticEvent,
    useCallback,
    useEffect,
    useState,
} from "react";
import MapBox, { Popup, ViewState } from "react-map-gl";
import { z } from "zod";
import { fetchStops } from "../../data/refDataApi";
import { LargePolygonError, NoStopsError } from "../../errors";
import { PageState } from "../../interfaces";
import { filterStopList, flattenZodErrors, getStopTypesByVehicleMode } from "../../utils";
import { getStopType, sortAndFilterStops } from "../../utils/formUtils";
import { warningMessageText } from "../../utils/mapUtils";
import Warning from "../form/Warning";
import { PolygonFeature } from "./DrawControl";
import MapControls from "./MapControls";
import Markers from "./Markers";

interface MapProps {
    initialViewState: Partial<ViewState>;
    style: CSSProperties;
    mapStyle: string;
    selectedStops: Stop[];
    stopOptions: Stop[];
    inputId?: keyof Stop;
    showSelectAllButton?: boolean;
    stateUpdater: Dispatch<SetStateAction<PageState<Partial<StopsConsequence>>>>;
    state: PageState<Partial<StopsConsequence>>;
    showUnderground?: boolean;
}

const Map = ({
    initialViewState,
    style,
    mapStyle,
    selectedStops,
    stopOptions,
    showSelectAllButton = false,
    stateUpdater = () => "",
    state,
    showUnderground = false,
}: MapProps): ReactElement | null => {
    const mapboxAccessToken = process.env.MAP_BOX_ACCESS_TOKEN;
    const [features, setFeatures] = useState<{ [key: string]: PolygonFeature }>({});
    const [markerData, setMarkerData] = useState<Stop[]>([]);
    const [showSelectAllText, setShowSelectAllText] = useState<boolean>(true);
    const [popupInfo, setPopupInfo] = useState<Partial<Stop>>({});
    const [loading, setLoading] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");

    useEffect(() => {
        if (state.inputs.stops?.length === 0) {
            setShowSelectAllText(true);
        }
    }, [state.inputs?.stops]);

    const handleMouseEnter = useCallback(
        (id: string) => {
            const searchedAtcoCodes = stopOptions.map((searchItem) => searchItem.atcoCode);
            const selectedAtcoCodes = selectedStops.map((selectedItem) => selectedItem.atcoCode);
            const markerDataAtcoCodes = markerData.map((markerItem) => markerItem.atcoCode);
            const stopsOnMap = [
                ...selectedStops,
                ...stopOptions,
                ...markerData.filter(
                    (item) => !searchedAtcoCodes.includes(item.atcoCode) && !selectedAtcoCodes.includes(item.atcoCode),
                ),
                ...(state.inputs?.pastStops?.filter(
                    (item) =>
                        !searchedAtcoCodes.includes(item.atcoCode) &&
                        !selectedAtcoCodes.includes(item.atcoCode) &&
                        !markerDataAtcoCodes.includes(item.atcoCode),
                ) || []),
            ];
            const stopInfo = stopsOnMap.find((stop) => stop.atcoCode === id);
            if (stopInfo) setPopupInfo(stopInfo);
        },
        [stopOptions, selectedStops, markerData, state.inputs?.pastStops],
    );

    const unselectMarker = useCallback(
        (id: string) => {
            if (state) {
                const stops = sortAndFilterStops(selectedStops.filter((stop: Stop) => stop.atcoCode !== id));

                stateUpdater({
                    ...state,
                    inputs: {
                        ...state.inputs,
                        stops,
                        pastStops: sortAndFilterStops([
                            ...(state.inputs?.pastStops || []),
                            ...selectedStops.filter((stop: Stop) => stop.atcoCode === id),
                        ]),
                    },
                    errors: state.errors,
                });
            }
        },
        [selectedStops, state, stateUpdater],
    );

    const selectMarker = useCallback(
        (id: string) => {
            if (state) {
                const stop: Stop[] = [...stopOptions, ...markerData, ...(state.inputs?.pastStops || [])].filter(
                    (stop: Stop) => stop.atcoCode === id,
                );

                stateUpdater({
                    ...state,
                    inputs: {
                        ...state.inputs,
                        stops: sortAndFilterStops([...selectedStops, ...stop]),
                        pastStops: state.inputs?.pastStops?.filter((stop: Stop) => stop.atcoCode !== id),
                    },
                    errors: state.errors,
                });
            }
        },
        [stopOptions, selectedStops, state, stateUpdater, markerData],
    );

    useEffect(() => {
        if (features && Object.values(features).length > 0) {
            setWarningMessage("");
            const polygon = Object.values(features)[0].geometry.coordinates[0];
            const loadOptions = async () => {
                setLoading(true);
                const vehicleMode = state.inputs.vehicleMode as Modes | VehicleMode;

                try {
                    const stopsData = await fetchStops({
                        adminAreaCodes: state.sessionWithOrg?.adminAreaCodes ?? ["undefined"],
                        polygon,
                        stopTypes: getStopTypesByVehicleMode(vehicleMode),
                    });

                    const filteredStopList = filterStopList(stopsData, vehicleMode, showUnderground);

                    if (filteredStopList) {
                        setMarkerData(filteredStopList);
                    } else {
                        setMarkerData([]);
                    }
                } catch (e) {
                    setMarkerData([]);
                    if (e instanceof LargePolygonError) {
                        setWarningMessage(warningMessageText(selectedStops.length).drawnAreaTooBig);
                    } else if (e instanceof NoStopsError) {
                        setWarningMessage(warningMessageText(selectedStops.length).noStopsFound);
                    } else {
                        setWarningMessage(warningMessageText(selectedStops.length).problemRetrievingStops);
                    }
                }
            };

            loadOptions().catch(console.error);
            setLoading(false);
        } else {
            setWarningMessage("");
        }
    }, [features]);

    const onUpdate = useCallback((evt: { features: PolygonFeature[] }) => {
        setFeatures((currFeatures) => {
            const newFeatures = { ...currFeatures };
            for (const f of evt.features) {
                if (f.id) {
                    newFeatures[f.id] = f;
                }
            }
            return newFeatures;
        });
        setShowSelectAllText(true);
        setPopupInfo({});
    }, []);

    const onDelete = useCallback(() => {
        setFeatures({});
        setShowSelectAllText(true);
        setMarkerData([]);
        setPopupInfo({});
    }, []);

    const selectAllStops = (evt: SyntheticEvent) => {
        evt.preventDefault();
        if (!showSelectAllText) {
            stateUpdater({
                ...state,
                inputs: {
                    ...state.inputs,
                    stops: selectedStops.filter((sToFilter: Stop) =>
                        markerData && markerData.length > 0
                            ? !markerData.map((s) => s.atcoCode).includes(sToFilter.atcoCode)
                            : sToFilter,
                    ),
                },
                errors: state.errors,
            });
        } else {
            const parsed = z.array(stopSchema).safeParse(markerData);
            if (!parsed.success) {
                stateUpdater({
                    ...state,
                    errors: [
                        ...state.errors.filter((err) => !Object.keys(stopsConsequenceSchema.shape).includes(err.id)),
                        ...flattenZodErrors(parsed.error),
                    ],
                });
            } else {
                if (markerData.length > 0 && showSelectAllText) {
                    stateUpdater({
                        ...state,
                        inputs: {
                            ...state.inputs,
                            stops: sortAndFilterStops([...selectedStops, ...markerData].splice(0, 100)),
                        },
                        errors: [
                            ...state.errors.filter(
                                (err) => !Object.keys(stopsConsequenceSchema.shape).includes(err.id),
                            ),
                        ],
                    });
                }
            }
        }
        setShowSelectAllText(!showSelectAllText);
    };

    useEffect(() => {
        if (selectedStops.length === 100) {
            setWarningMessage(warningMessageText(selectedStops.length).maxStopLimitReached);
        } else {
            setWarningMessage("");
        }
    }, [selectedStops]);

    useEffect(() => {
        stateUpdater({
            ...state,
            inputs: {
                ...state.inputs,
                pastStops: [],
            },
        });
    }, [stopOptions]);

    return mapboxAccessToken ? (
        <>
            {showSelectAllButton ? (
                <button
                    className="govuk-button govuk-button--secondary mt-2"
                    data-module="govuk-button"
                    onClick={selectAllStops}
                    disabled={loading || !((features && Object.values(features).length > 0) || markerData.length > 0)}
                >
                    {showSelectAllText ? "Select all stops" : "Unselect all stops"}
                </button>
            ) : null}
            {warningMessage ? <Warning text={warningMessage} /> : null}
            <LoadingBox loading={loading}>
                <MapBox
                    initialViewState={initialViewState}
                    style={style}
                    mapStyle={mapStyle}
                    mapboxAccessToken={mapboxAccessToken}
                    onRender={(event) => event.target.resize()}
                >
                    <MapControls onUpdate={onUpdate} onDelete={onDelete} />
                    <Markers
                        selectedStops={selectedStops}
                        stopOptions={stopOptions}
                        handleMouseEnter={handleMouseEnter}
                        markerData={markerData}
                        selectMarker={selectMarker}
                        unselectMarker={unselectMarker}
                        setPopupInfo={setPopupInfo}
                        pastStops={state.inputs?.pastStops}
                    />
                    {popupInfo.atcoCode && (
                        <Popup
                            anchor="top"
                            longitude={Number(popupInfo.longitude)}
                            latitude={Number(popupInfo.latitude)}
                            onClose={() => setPopupInfo({})}
                            closeButton={false}
                            closeOnMove
                        >
                            <div>
                                <p className="govuk-body-s mb-1">{`${getStopType(popupInfo.stopType)}: ${
                                    popupInfo.commonName || "N/A"
                                } (${popupInfo.indicator || ""})`}</p>
                                <p className="govuk-body-s mb-1">Bearing: {popupInfo.bearing || "N/A"}</p>
                                <p className="govuk-body-s mb-1">ATCO code: {popupInfo.atcoCode}</p>
                            </div>
                        </Popup>
                    )}
                </MapBox>
            </LoadingBox>
        </>
    ) : null;
};

export default Map;

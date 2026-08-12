import type { Routes, Service, ServicesConsequence, Stop } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { servicesConsequenceSchema, stopSchema } from "@create-disruptions-data/shared-ts/disruptionTypes.zod";
import { type Datasource, Modes, VehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { notEmpty } from "@create-disruptions-data/shared-ts/utils";
import { LoadingBox } from "@govuk-react/loading-box";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { type LineLayout, type LinePaint, type MapLayerMouseEvent, Point } from "mapbox-gl";
import {
    type CSSProperties,
    type Dispatch,
    type ReactElement,
    type SetStateAction,
    type SyntheticEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import MapBox, { Layer, Popup, Source, type ViewState } from "react-map-gl";
import { z } from "zod";
import { fetchServicesByStops, fetchStops } from "../../data/refDataApi";
import { LargePolygonError, NoStopsError } from "../../errors";
import type { PageState } from "../../interfaces";
import type { ServiceWithStopsAndRoutesPreformatted } from "../../schemas/consequence.schema";
import {
    type RouteWithServiceInfo,
    filterStopList,
    flattenZodErrors,
    getRoutesForServices,
    getStopTypesByVehicleMode,
    getStopsForRoutes,
    removeDuplicateRoutes,
} from "../../utils";
import { filterServices, getStopType, sortAndFilterStops, sortStops } from "../../utils/formUtils";
import { groupByJourneyPattern, warningMessageText } from "../../utils/mapUtils";
import Warning from "../form/Warning";
import type { PolygonFeature } from "./DrawControl";
import MapControls from "./MapControls";
import Markers from "./Markers";

interface ServiceMapProps extends MapProps {
    dataSource: Datasource;
}
interface MapProps {
    initialViewState: Partial<ViewState>;
    style: CSSProperties;
    mapStyle: string;
    selectedStops: Stop[];
    stopOptions: Stop[];
    setStopOptions: Dispatch<SetStateAction<Stop[]>>;
    inputId?: keyof Stop;
    showSelectAllButton?: boolean;
    stateUpdater: Dispatch<SetStateAction<PageState<Partial<ServicesConsequence>>>>;
    state: PageState<Partial<ServicesConsequence>>;
    searchedRoutes?: Partial<RouteWithServiceInfo[]>;
    setSearchedRoutes: Dispatch<SetStateAction<Partial<RouteWithServiceInfo[]>>>;
    serviceOptionsForDropdown: Service[];
    setServiceOptionsForDropdown: Dispatch<SetStateAction<Service[]>>;
    showUnderground?: boolean;
    showDrawControl?: boolean;
}

const lineLayout: LineLayout = {
    "line-join": "round",
    "line-cap": "round",
};

const lineStyle: LinePaint = {
    "line-color": "rgba(3, 170, 238, 0.5)",
    "line-width": 5,
};

const lineStyleHighlight: LinePaint = {
    "line-color": "rgba(47,146,188,255)",
    "line-width": 5,
    "line-opacity": 0.75,
};

const initialHoverState = {
    longitude: 0,
    latitude: 0,
    serviceId: -1,
    journeyPattern: "",
};

export const getSelectedStopsFromMapMarkers = (markerData: Stop[], id: string) => {
    return [...markerData].filter((stop: Stop) => stop.atcoCode === id);
};
export const getAtcoCodesFromSelectedStops = (stops: Stop[]) => {
    return stops ? stops.map((stop) => stop.atcoCode).splice(0, 100) : [];
};

const ServicesMap = ({
    initialViewState,
    style,
    mapStyle,
    selectedStops,
    stopOptions = [],
    setStopOptions,
    showSelectAllButton = false,
    stateUpdater = () => "",
    state,
    searchedRoutes = [],
    setSearchedRoutes,
    serviceOptionsForDropdown = [],
    setServiceOptionsForDropdown,
    dataSource,
    showUnderground = false,
    showDrawControl = true,
}: ServiceMapProps): ReactElement | null => {
    const mapboxAccessToken = process.env.MAP_BOX_ACCESS_TOKEN;
    const [features, setFeatures] = useState<{ [key: string]: PolygonFeature }>({});
    const [markerData, setMarkerData] = useState<Stop[]>([]);
    const [showSelectAllText, setShowSelectAllText] = useState<boolean>(true);
    const [warningMessage, setWarningMessage] = useState<string>("");
    const [disableSelectAllButton, setDisableSelectAllButton] = useState<boolean>(true);
    const [popupInfo, setPopupInfo] = useState<Partial<Stop>>({});
    const [hoverInfo, setHoverInfo] = useState<{ longitude: number; latitude: number; serviceId: number }>(
        initialHoverState,
    );
    const [loading, setLoading] = useState(false);

    const [selectedServicesRoutes, setSelectedServicesRoutes] =
        useState<Partial<(Routes & { serviceId: number })[]>>(searchedRoutes);

    useEffect(() => {
        if (state.inputs.stops?.length === 0) {
            setShowSelectAllText(true);
        }
    }, [state.inputs?.stops]);

    useEffect(() => {
        setSelectedServicesRoutes(searchedRoutes);
    }, [searchedRoutes]);

    const createLineString = (coordinates: Stop[], serviceId: number): Feature<Geometry, GeoJsonProperties> => ({
        type: "Feature",
        properties: { serviceId },
        geometry: {
            type: "LineString",
            coordinates: coordinates?.map((stop) => [stop.longitude, stop.latitude]),
        },
    });

    const handleMouseEnter = useCallback(
        (id: string) => {
            const searchedAtcoCodes = stopOptions.map((searchItem) => searchItem.atcoCode);
            const selectedAtcoCodes = selectedStops.map((selectedItem) => selectedItem.atcoCode);
            const stopsOnMap = [
                ...selectedStops,
                ...stopOptions,
                ...markerData.filter(
                    (item) => !searchedAtcoCodes.includes(item.atcoCode) && !selectedAtcoCodes.includes(item.atcoCode),
                ),
            ];
            const stopInfo = stopsOnMap.find((stop) => stop.atcoCode === id);
            if (stopInfo) setPopupInfo(stopInfo);
        },
        [stopOptions, selectedStops, markerData],
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
                    },
                    errors: state.errors,
                });
            }
        },
        [selectedStops, state, stateUpdater],
    );

    const addServiceFromSingleStop = async (id: string): Promise<void> => {
        if (state) {
            {
                const stop: Stop[] = getSelectedStopsFromMapMarkers(markerData, id);
                const atcoCodes = getAtcoCodesFromSelectedStops(stop);

                const servicesForStopsInPolygon: ServiceWithStopsAndRoutesPreformatted[] = await fetchServicesByStops({
                    atcoCodes,
                    includeRoutes: true,
                    dataSource: dataSource,
                });

                if (servicesForStopsInPolygon.length === 0) {
                    setWarningMessage(warningMessageText(selectedStops.length).noServiceAssociatedWithStop);
                    return;
                }

                const servicesRoutesForGivenStop = getRoutesForServices(servicesForStopsInPolygon);

                const servicesRoutesForMap = removeDuplicateRoutes([
                    ...searchedRoutes,
                    ...groupByJourneyPattern(servicesRoutesForGivenStop),
                ]);

                const stopsForServicesRoutes = await getStopsForRoutes(
                    servicesRoutesForMap,
                    state.inputs.vehicleMode,
                    dataSource,
                );

                const stopOptionsForMap = sortAndFilterStops([...stopOptions, ...stopsForServicesRoutes]);

                setStopOptions(stopOptionsForMap);
                setSelectedServicesRoutes(servicesRoutesForMap);
                setSearchedRoutes(servicesRoutesForMap);
                setServiceOptionsForDropdown(
                    filterServices([...serviceOptionsForDropdown, ...servicesForStopsInPolygon]),
                );

                stateUpdater({
                    ...state,
                    inputs: {
                        ...state.inputs,
                        ...(state.inputs?.services
                            ? {
                                  services: filterServices([...state.inputs.services, ...servicesForStopsInPolygon]),
                              }
                            : { services: servicesForStopsInPolygon }),
                        stops: sortAndFilterStops([...selectedStops, ...stop]),
                    },
                    errors: state.errors,
                });
            }
        }
    };

    const selectStop = (id: string) => {
        if (state) {
            const stop: Stop[] = getSelectedStopsFromMapMarkers(stopOptions, id);
            stateUpdater({
                ...state,
                inputs: {
                    ...state.inputs,
                    stops: sortStops([...selectedStops, ...stop]),
                },
                errors: state.errors,
            });
        }
    };

    const selectMarker = useCallback(
        async (id: string) => {
            setLoading(true);
            if (features && Object.values(features).length > 0) {
                await addServiceFromSingleStop(id);
            } else {
                selectStop(id);
            }
            setLoading(false);
        },
        [markerData, state.inputs.stops, state.inputs.services],
    );

    useEffect(() => {
        if (selectedStops.length === 100) {
            setWarningMessage(warningMessageText(selectedStops.length).maxStopLimitReached);
        } else {
            setWarningMessage("");
            setDisableSelectAllButton(false);
        }
    }, [selectedStops]);

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
                        clearServicesAndStops();
                    } else {
                        setMarkerData([]);
                    }
                    setSelectedServicesRoutes([]);
                } catch (e) {
                    setMarkerData([]);
                    setSelectedServicesRoutes([]);
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

    useEffect(() => {
        setShowSelectAllText(true);
    }, [searchedRoutes]);

    const addSelectedStopsAndServices = async () => {
        const parsed = z.array(stopSchema).safeParse(stopOptions);
        if (!parsed.success) {
            stateUpdater({
                ...state,
                errors: [
                    ...state.errors.filter((err) => !Object.keys(servicesConsequenceSchema.shape).includes(err.id)),
                    ...flattenZodErrors(parsed.error),
                ],
            });
        } else {
            if (showSelectAllText) {
                setLoading(true);
                const atcoCodes = getAtcoCodesFromSelectedStops(markerData);
                const servicesForStopsInPolygon: ServiceWithStopsAndRoutesPreformatted[] = await fetchServicesByStops({
                    atcoCodes,
                    includeRoutes: true,
                    dataSource: dataSource,
                });

                const servicesRoutesForGivenStop = getRoutesForServices(servicesForStopsInPolygon);

                const servicesRoutesForMap = removeDuplicateRoutes([
                    ...searchedRoutes,
                    ...groupByJourneyPattern(servicesRoutesForGivenStop),
                ]);

                const stopsForServicesRoutes = await getStopsForRoutes(
                    servicesRoutesForMap,
                    state.inputs.vehicleMode,
                    dataSource,
                );

                const stopsForMap = sortAndFilterStops([...stopOptions, ...stopsForServicesRoutes]);

                setStopOptions(stopsForMap);
                setSelectedServicesRoutes(servicesRoutesForMap);
                setSearchedRoutes(servicesRoutesForMap);
                setServiceOptionsForDropdown(
                    filterServices([...serviceOptionsForDropdown, ...servicesForStopsInPolygon]),
                );

                const stops = sortAndFilterStops([
                    ...(state.inputs.stops ?? []),
                    ...markerData,
                    ...(stopOptions.length > 0 ? stopOptions : []),
                ]).splice(0, 100);

                if (!!markerData && markerData.length && stops.length === 100) {
                    setDisableSelectAllButton(true);
                }

                stateUpdater({
                    ...state,
                    inputs: {
                        ...state.inputs,
                        stops: sortAndFilterStops(stops),
                        ...(state.inputs?.services
                            ? {
                                  services: filterServices([...state.inputs.services, ...servicesForStopsInPolygon]),
                              }
                            : { services: servicesForStopsInPolygon }),
                    },
                    errors: [
                        ...state.errors.filter((err) => !Object.keys(servicesConsequenceSchema.shape).includes(err.id)),
                    ],
                });
                setLoading(false);
            }
        }
    };

    const clearServicesAndStops = () => {
        stateUpdater({
            ...state,
            inputs: {
                ...state.inputs,
                stops: [],
                ...(state.inputs?.services
                    ? {
                          services: [],
                      }
                    : {}),
            },
            errors: state.errors,
        });
    };

    const selectAllStops = async (evt: SyntheticEvent) => {
        evt.preventDefault();
        clearServicesAndStops();
        if (selectedServicesRoutes && selectedServicesRoutes.length > 0) {
            if (!showSelectAllText) {
                setSelectedServicesRoutes(searchedRoutes);
            } else {
                await addSelectedStopsAndServices();
            }
        } else {
            await addSelectedStopsAndServices();
        }
        setShowSelectAllText(!showSelectAllText);
        return;
    };

    useEffect(() => {
        setShowSelectAllText(true);
    }, [searchedRoutes]);

    const onHover = useCallback((event: MapLayerMouseEvent) => {
        setHoverInfo(initialHoverState);
        const service = event.features?.[0];
        if (service?.properties?.serviceId) {
            setHoverInfo({
                longitude: event.lngLat.lng,
                latitude: event.lngLat.lat,
                serviceId: service && (service.properties.serviceId as number),
            });
        }
    }, []);

    const selectedService = hoverInfo?.serviceId || "";

    const filter = useMemo(() => ["all", ["==", "serviceId", selectedService]], [selectedService]);

    const getSourcesInbound = useCallback(
        (searchedRoutes: Partial<(Routes & { serviceId: number })[]>) => {
            const res = searchedRoutes
                .map((route) =>
                    route?.inbound
                        ? Object.keys(route?.inbound).map((jp) => (
                              <Source
                                  key={`${route.serviceId}-${jp}`}
                                  id={`inbound-route-${route.serviceId}-${jp}`}
                                  type="geojson"
                                  data={createLineString(route.inbound[jp] as Stop[], route.serviceId)}
                              >
                                  <Layer
                                      id={`services-inbound-${route.serviceId}-${jp}`}
                                      type="line"
                                      source={`services-inbound-${route.serviceId}-${jp}`}
                                      layout={lineLayout}
                                      paint={lineStyle}
                                  />
                                  <Layer
                                      id={`services-highlighted-inbound-${route.serviceId}-${jp}`}
                                      type="line"
                                      source={`services-inbound-${route.serviceId}-${jp}`}
                                      layout={lineLayout}
                                      paint={lineStyleHighlight}
                                      filter={filter}
                                  />
                              </Source>
                          ))
                        : null,
                )
                .filter(notEmpty);
            return res;
        },
        [filter],
    );

    const getSourcesOutbound = useCallback(
        (searchedRoutes: Partial<(Routes & { serviceId: number })[]>) => {
            const res = searchedRoutes
                .map((route) =>
                    route?.outbound
                        ? Object.keys(route.outbound).map((jp) => (
                              <Source
                                  key={`${route.serviceId}-${jp}`}
                                  id={`outbound-route-${route.serviceId}-${jp}`}
                                  type="geojson"
                                  data={createLineString(route?.outbound[jp] as Stop[], route.serviceId)}
                              >
                                  <Layer
                                      id={`services-outbound-${route.serviceId}-${jp}`}
                                      type="line"
                                      source={`services-outbound-${route.serviceId}-${jp}`}
                                      layout={lineLayout}
                                      paint={lineStyle}
                                  />
                                  <Layer
                                      id={`services-highlighted-outbound-${route.serviceId}-${jp}`}
                                      type="line"
                                      source={`services-outbound-${route.serviceId}-${jp}`}
                                      layout={lineLayout}
                                      paint={lineStyleHighlight}
                                      filter={filter}
                                  />
                              </Source>
                          ))
                        : null,
                )
                .filter(notEmpty);
            return res;
        },
        [filter],
    );

    const getInteractiveLayerIds = useCallback(() => {
        if (selectedServicesRoutes && selectedServicesRoutes.length > 0) {
            return selectedServicesRoutes.flatMap((sr) =>
                Object.keys({ ...(sr?.outbound || {}), ...(sr?.inbound || {}) }).flatMap((jp) => {
                    if (sr?.inbound && sr.outbound && sr.serviceId) {
                        return [
                            `services-inbound-${sr.serviceId || ""}-${jp}`,
                            `services-outbound-${sr.serviceId || ""}-${jp}`,
                        ];
                    }
                    if (sr?.inbound && sr.serviceId) {
                        return [`services-inbound-${sr?.serviceId || ""}-${jp}`];
                    }
                    if (sr?.outbound && sr.serviceId) {
                        return [`services-outbound-${sr?.serviceId || ""}-${jp}`];
                    }
                    return [];
                }),
            );
        }
        return [];
    }, [selectedServicesRoutes]);

    const getServiceInfo = (id: number) => {
        const service = serviceOptionsForDropdown
            ? serviceOptionsForDropdown.find((service) => service.id === id)
            : null;
        return service
            ? `Line: ${service.lineName} - ${service.origin.replace("_", " ")} - ${service.destination.replace(
                  "_",
                  " ",
              )} (${service.operatorShortName})`
            : "Line: N/A";
    };

    return mapboxAccessToken ? (
        <>
            {showSelectAllButton ? (
                <button
                    className="govuk-button govuk-button--secondary mt-2"
                    data-module="govuk-button"
                    onClick={selectAllStops}
                    disabled={
                        loading ||
                        disableSelectAllButton ||
                        !(
                            (features && Object.values(features).length > 0) ||
                            markerData.length > 0 ||
                            (searchedRoutes && searchedRoutes.length > 0)
                        )
                    }
                >
                    {showSelectAllText ? "Select all" : "Unselect all"}
                </button>
            ) : null}
            {warningMessage ? <Warning text={warningMessage} /> : null}
            <LoadingBox loading={loading}>
                <MapBox
                    initialViewState={initialViewState}
                    style={style}
                    mapStyle={mapStyle}
                    mapboxAccessToken={mapboxAccessToken}
                    onMouseMove={onHover}
                    interactiveLayerIds={getInteractiveLayerIds()}
                    onRender={(event) => event.target.resize()}
                >
                    <MapControls onUpdate={onUpdate} onDelete={onDelete} showDrawControl={showDrawControl} />
                    <Markers
                        selectedStops={selectedStops}
                        stopOptions={stopOptions}
                        handleMouseEnter={handleMouseEnter}
                        markerData={markerData}
                        selectMarker={selectMarker}
                        unselectMarker={unselectMarker}
                        setPopupInfo={setPopupInfo}
                    />
                    {selectedServicesRoutes ? getSourcesInbound(selectedServicesRoutes) : null}
                    {selectedServicesRoutes ? getSourcesOutbound(selectedServicesRoutes) : null}
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
                    {selectedService && hoverInfo.latitude ? (
                        <Popup
                            longitude={hoverInfo.longitude}
                            latitude={hoverInfo.latitude}
                            offset={new Point(0, -10)}
                            onClose={() => setHoverInfo(initialHoverState)}
                            closeButton={false}
                            className="service-info"
                            closeOnMove
                        >
                            {getServiceInfo(selectedService)}
                        </Popup>
                    ) : null}
                </MapBox>
            </LoadingBox>
        </>
    ) : null;
};

export default ServicesMap;

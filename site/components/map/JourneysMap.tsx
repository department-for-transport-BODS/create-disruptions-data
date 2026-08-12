import { Routes, Service, Stop } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { Datasource } from "@create-disruptions-data/shared-ts/enums";
import { Feature, GeoJsonProperties, Geometry } from "geojson";
import { LineLayout, LinePaint, MapLayerMouseEvent, Point } from "mapbox-gl";
import {
    CSSProperties,
    Dispatch,
    ReactElement,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import MapBox, { Layer, Popup, Source, ViewState } from "react-map-gl";
import { RouteWithServiceInfo, notEmpty } from "../../utils";
import { getStopType } from "../../utils/formUtils";
import MapControls from "./MapControls";
import Markers from "./Markers";

interface JourneysMapProps extends MapProps {
    dataSource: Datasource;
}
interface MapProps {
    initialViewState: Partial<ViewState>;
    style: CSSProperties;
    mapStyle: string;
    stopOptions: Stop[];
    inputId?: keyof Stop;
    searchedRoutes?: Partial<RouteWithServiceInfo[]>;
    setSearchedRoutes: Dispatch<SetStateAction<Partial<RouteWithServiceInfo[]>>>;
    serviceOptionsForDropdown: Service[];
    setServiceOptionsForDropdown: Dispatch<SetStateAction<Service[]>>;
    showUnderground?: boolean;
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
};

const Map = ({
    initialViewState,
    style,
    mapStyle,
    stopOptions = [],
    searchedRoutes = [],
    serviceOptionsForDropdown = [],
}: JourneysMapProps): ReactElement | null => {
    const mapboxAccessToken = process.env.MAP_BOX_ACCESS_TOKEN;
    const [markerData, setMarkerData] = useState<Stop[]>([]);

    const [popupInfo, setPopupInfo] = useState<Partial<Stop>>({});
    const [hoverInfo, setHoverInfo] = useState<{ longitude: number; latitude: number; serviceId: number }>(
        initialHoverState,
    );

    const [selectedServicesRoutes, setSelectedServicesRoutes] =
        useState<Partial<(Routes & { serviceId: number })[]>>(searchedRoutes);

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

            const stopsOnMap = [
                ...stopOptions,
                ...markerData.filter((item) => !searchedAtcoCodes.includes(item.atcoCode)),
            ];
            const stopInfo = stopsOnMap.find((stop) => stop.atcoCode === id);
            if (stopInfo) setPopupInfo(stopInfo);
        },
        [stopOptions, markerData],
    );

    const unselectMarker = useCallback(() => {}, []);

    const selectMarker = useCallback(async () => {}, []);

    const onUpdate = useCallback(() => {
        setPopupInfo({});
    }, []);

    const onDelete = useCallback(() => {
        setMarkerData([]);
        setPopupInfo({});
    }, []);

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
    const filter = useMemo(() => ["==", "serviceId", selectedService], [selectedService]);

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
            <MapBox
                initialViewState={initialViewState}
                style={style}
                mapStyle={mapStyle}
                mapboxAccessToken={mapboxAccessToken}
                onMouseMove={onHover}
                interactiveLayerIds={getInteractiveLayerIds()}
                onRender={(event) => event.target.resize()}
            >
                <MapControls onUpdate={onUpdate} onDelete={onDelete} polygon={false} trash={false} />
                <Markers
                    selectedStops={[]}
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
        </>
    ) : null;
};

export default Map;

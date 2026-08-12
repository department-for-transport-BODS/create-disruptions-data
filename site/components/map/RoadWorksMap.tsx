import { RoadworkWithCoordinates } from "@create-disruptions-data/shared-ts/roadwork.zod";
import { FeatureCollection, Point } from "geojson";
import { lowerCase, startCase, uniqueId } from "lodash";
import { GeoJSONSource } from "mapbox-gl";
import Link from "next/link";
import { CSSProperties, ReactElement, useCallback, useRef, useState } from "react";
import MapBox, {
    Layer,
    LayerProps,
    MapLayerMouseEvent,
    MapRef,
    Popup,
    Source,
    SymbolLayer,
    ViewState,
    useMap,
} from "react-map-gl";
import cone from "../../public/assets/images/cone.png";
import { convertDateTimeToFormat } from "../../utils/dates";
import MapControls from "./MapControls";

interface MapProps {
    initialViewState: Partial<ViewState>;
    style: CSSProperties;
    mapStyle: string;
    roadworks: RoadworkWithCoordinates[];
}

const clusterLayer: LayerProps = {
    id: "clusters",
    type: "circle",
    source: "roadwork-icon-disruptions",
    filter: ["has", "point_count"],
    paint: {
        "circle-color": ["step", ["get", "point_count"], "#51bbd6", 100, "#f1f075", 750, "#f28cb1"],
        "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
    },
};

const clusterCountLayer: LayerProps = {
    id: "cluster-count",
    type: "symbol",
    source: "roadwork-icon-disruptions",
    filter: ["has", "point_count"],
    layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
    },
};

const roadworkLayer: SymbolLayer = {
    id: "unclustered-point",
    type: "symbol",
    source: "roadwork-icon-disruptions",
    filter: ["!", ["has", "point_count"]],
    layout: {
        "icon-image": "cone",
        "icon-size": 0.08,
    },
};

const Map = ({ initialViewState, style, mapStyle, roadworks }: MapProps): ReactElement | null => {
    const mapboxAccessToken = process.env.MAP_BOX_ACCESS_TOKEN;

    const mapRef = useRef<MapRef>(null);

    const [popupInfo, setPopupInfo] = useState<
        Partial<{
            streetName: string;
            startDateTime: string;
            endDateTime: string;
            longitude: number;
            latitude: number;
            permitReferenceNumber: string;
        }>
    >({});

    const roadworkSource: FeatureCollection = {
        type: "FeatureCollection",
        features: roadworks.map((r) => ({
            ...r.worksLocationCoordinates,
            properties: {
                streetName: startCase(lowerCase(r.streetName || "")),
                startDateTime: r.actualStartDateTime
                    ? convertDateTimeToFormat(r.actualStartDateTime, "DD/MM/YYYY HHmm")
                    : r.proposedStartDateTime
                      ? convertDateTimeToFormat(r.proposedStartDateTime, "DD/MM/YYYY HHmm")
                      : "",
                endDateTime: r.actualEndDateTime
                    ? convertDateTimeToFormat(r.actualEndDateTime, "DD/MM/YYYY HHmm")
                    : r.proposedEndDateTime
                      ? convertDateTimeToFormat(r.proposedEndDateTime, "DD/MM/YYYY HHmm")
                      : "",
                longitude: r.worksLocationCoordinates.geometry.coordinates[0],
                latitude: r.worksLocationCoordinates.geometry.coordinates[1],
                permitReferenceNumber: r.permitReferenceNumber,
            },
        })),
    };

    const MapImage = () => {
        const { current: map } = useMap();

        if (map) {
            if (!map.hasImage("cone")) {
                map.loadImage(cone.src, (error, image) => {
                    if (error) throw error;
                    if (!map.hasImage("cone") && image) map.addImage("cone", image, { sdf: false });
                });
            }
        }

        return null;
    };

    const onClick = useCallback((event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];

        if (feature?.properties && feature?.layer.id === "clusters") {
            const clusterId = feature.properties.cluster_id as number;

            if (mapRef.current) {
                const mapboxSource = mapRef.current.getSource("roadwork-icon-disruptions") as GeoJSONSource;

                mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) {
                        return;
                    }
                    if (mapRef.current) {
                        mapRef.current.easeTo({
                            center: (feature.geometry as Point).coordinates as [number, number],
                            zoom,
                            duration: 500,
                        });
                    }
                });
            }
        }
        const featureLayer = event.features?.find((f) => f.layer.id === "unclustered-point");

        if (featureLayer?.properties) {
            setPopupInfo(featureLayer.properties);
        }
    }, []);

    return mapboxAccessToken ? (
        <>
            <MapBox
                initialViewState={initialViewState}
                style={style}
                mapStyle={mapStyle}
                mapboxAccessToken={mapboxAccessToken}
                onRender={(event) => event.target.resize()}
                interactiveLayerIds={[clusterLayer.id || "", roadworkLayer.id || ""]}
                onClick={onClick}
                ref={mapRef}
            >
                <MapControls onUpdate={() => {}} onDelete={() => {}} trash={false} polygon={false} />
                <Source
                    id="roadwork-icon-disruptions"
                    type="geojson"
                    data={roadworkSource}
                    cluster={true}
                    clusterMaxZoom={14}
                    clusterRadius={50}
                >
                    <Layer {...clusterLayer} />
                    <Layer {...clusterCountLayer} />
                    <Layer {...roadworkLayer} />
                </Source>
                <MapImage />
                {popupInfo.longitude && popupInfo.latitude && (
                    <Popup
                        anchor="top"
                        longitude={popupInfo.longitude}
                        latitude={popupInfo.latitude}
                        onClose={() => setPopupInfo({})}
                        closeButton={false}
                        closeOnMove
                        closeOnClick
                        key={uniqueId(popupInfo.permitReferenceNumber)}
                    >
                        <div>
                            <p className="govuk-body-xs mb-1 font-bold">{`Roadworks - ${popupInfo.streetName}`}</p>
                            <p className="govuk-body-xxs mb-1 w-max">{`${popupInfo.startDateTime} - ${
                                popupInfo.endDateTime || "No end date"
                            }`}</p>
                            <Link
                                className="govuk-link font-bold"
                                href={`roadwork-detail/${encodeURIComponent(popupInfo.permitReferenceNumber || "")}`}
                            >
                                See more
                            </Link>
                        </div>
                    </Popup>
                )}
            </MapBox>
        </>
    ) : null;
};

export default Map;

import { Roadwork, RoadworkWithCoordinates } from "@create-disruptions-data/shared-ts/roadwork.zod";
import { getLiveRoadworks } from "@create-disruptions-data/shared-ts/utils";
import center from "@turf/center";
import { getCoords } from "@turf/invariant";
import { Point } from "geojson";
import { NextPageContext } from "next";
import Link from "next/link";
import proj4 from "proj4";
import { useState, type JSX } from "react";
import { GeoJSONFeature, GeoJSONGeometry, GeoJSONLineString, GeoJSONPolygon, parse } from "wellknown";
import Table, { CellProps } from "../components/form/Table";
import Warning from "../components/form/Warning";
import { BaseLayout } from "../components/layout/Layout";
import PageNumbers from "../components/layout/PageNumbers";
import Tabs from "../components/layout/Tabs";
import Map from "../components/map/RoadWorksMap";
import { fetchRoadworks } from "../data/refDataApi";
import { getSessionWithOrgDetail } from "../utils/apiUtils/auth";
import { convertDateTimeToFormat } from "../utils/dates";

const title = "View All Roadworks";
const description = "View All Roadworks page for the Create Transport Disruptions Service";

export interface ViewAllRoadworksProps {
    liveRoadworks: Roadwork[];
}

const isPolygon = (geometry: GeoJSONGeometry): geometry is GeoJSONPolygon => geometry && geometry.type === "Polygon";

const isLineString = (geometry: GeoJSONGeometry): geometry is GeoJSONLineString =>
    geometry && geometry.type === "LineString";

const roadWorkCoordinates = (roadworks: Roadwork[]): RoadworkWithCoordinates[] => {
    return roadworks.map((item: Roadwork) => {
        const worksLocationCoordinates: GeoJSONFeature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0],
            },
        };

        const geometry = parse(item.worksLocationCoordinates || "") || worksLocationCoordinates.geometry;
        worksLocationCoordinates.geometry = geometry;

        if (isPolygon(geometry) || isLineString(geometry)) {
            const middle = center(geometry);

            worksLocationCoordinates.geometry = {
                type: "Point",
                coordinates: getCoords(middle) as [number, number],
            };
        }

        const easting: number = (worksLocationCoordinates.geometry as Point).coordinates[0] || 0;
        const northing: number = (worksLocationCoordinates.geometry as Point).coordinates[1] || 0;

        // Define the British National Grid (BNG) coordinate reference system
        const sourceCRS: string =
            "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs"; // OSGB36

        // Define the target coordinate reference system for longitude and latitude
        const targetCRS: string = "+proj=longlat +datum=WGS84 +no_defs";

        // Perform the coordinate transformation

        const coordinates: [number, number] = proj4(sourceCRS, targetCRS, [easting, northing]) as [number, number];

        worksLocationCoordinates.geometry = {
            type: "Point",
            coordinates: coordinates as [number, number],
        };

        return {
            ...item,
            worksLocationCoordinates,
        };
    }) as RoadworkWithCoordinates[];
};

export interface RoadworksTable {
    datesAffected: string;
    description: JSX.Element;
}

const formatRows = (roadworks: Roadwork[]): { cells: CellProps[] }[] => {
    return roadworks.map((roadwork) => {
        return {
            cells: [
                {
                    value: `${convertDateTimeToFormat(roadwork.actualStartDateTime ?? "")} - ${convertDateTimeToFormat(
                        roadwork.proposedEndDateTime ?? "",
                    )}`,
                },
                {
                    value: (
                        <Link
                            className="govuk-link"
                            href={`roadwork-detail/${encodeURIComponent(roadwork.permitReferenceNumber)}`}
                            key={roadwork.permitReferenceNumber}
                        >
                            {roadwork.streetName?.toUpperCase()} - {roadwork.activityType}
                        </Link>
                    ),
                },
            ],
        };
    });
};

const ViewAllRoadworks = ({ liveRoadworks }: ViewAllRoadworksProps) => {
    const [currentPage, setCurrentPage] = useState(1);

    const rowsForCurrentPage = formatRows(liveRoadworks).slice((currentPage - 1) * 10, currentPage * 10);

    return (
        <BaseLayout title={title} description={description}>
            <h1 className="govuk-heading-xl">Roadworks in your area</h1>

            {liveRoadworks.length === 0 && <Warning text="There are no current roadworks in your area" />}

            <Map
                initialViewState={{
                    longitude: -1.7407941662903283,
                    latitude: 53.05975866591879,
                    zoom: 4.5,
                }}
                style={{ width: "100%", height: "40vh", marginBottom: 20 }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                roadworks={roadWorkCoordinates(liveRoadworks)}
            />
            <Tabs
                activeTabHeader={"live"}
                tabs={[
                    {
                        tabHeader: "Live",
                        content: (
                            <>
                                <Table
                                    rows={rowsForCurrentPage}
                                    columns={["Dates affected", "Description"]}
                                    caption={{
                                        text: "Recent live roadworks",
                                        size: "m",
                                    }}
                                />
                                <PageNumbers
                                    numberOfPages={Math.ceil(liveRoadworks.length / 10)}
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                />
                            </>
                        ),
                    },
                ]}
                tabsTitle={"Recent live roadworks"}
            />
        </BaseLayout>
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: ViewAllRoadworksProps }> => {
    const baseProps = {
        props: {
            liveRoadworks: [],
        },
    };

    if (!ctx.req) {
        return baseProps;
    }

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        return baseProps;
    }

    const roadworks = await fetchRoadworks({ adminAreaCodes: session.adminAreaCodes });

    const liveRoadworks = getLiveRoadworks(roadworks);

    return {
        props: {
            liveRoadworks,
        },
    };
};

export default ViewAllRoadworks;

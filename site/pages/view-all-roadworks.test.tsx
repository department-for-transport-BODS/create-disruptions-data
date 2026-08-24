import { Roadwork } from "@create-disruptions-data/shared-ts/roadwork.zod";
import { getDate, sortEarliestDate } from "@create-disruptions-data/shared-ts/utils/dates";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GeoJSONGeometry } from "wellknown";
import { mockViewAllRoadworksData } from "../testData/mockData";
import ViewAllRoadworks, {
    collectPositions,
    getCentreOfGeometry,
    roadWorkCoordinates,
} from "./view-all-roadworks.page";

const mockLiveRoadworks = mockViewAllRoadworksData
    .filter((roadwork) => roadwork.workStatus === "Works in progress" && !roadwork.actualEndDateTime)
    .sort((a, b) => sortEarliestDate(getDate(a.actualStartDateTime ?? ""), getDate(b.actualStartDateTime ?? "")));

const baseRoadwork: Roadwork = {
    permitReferenceNumber: "AZ1231001293426-01",
    highwayAuthoritySwaCode: 4240,
    streetName: "TENNYSON AVENUE",
    areaName: "",
    town: "DUKINFIELD",
    worksLocationCoordinates: "POINT(396413.66 397262.46)",
    activityType: "Utility repair and maintenance works",
    proposedStartDateTime: "2023-11-07T00:00:00.000Z",
    proposedEndDateTime: "2023-12-11T00:00:00.000Z",
    actualStartDateTime: "2023-11-07T10:13:00.000Z",
    actualEndDateTime: null,
    permitStatus: "granted",
    workStatus: "Works in progress",
    administrativeAreaCode: "083",
};

describe("ViewAllRoadworks", () => {
    it("should render correctly when roadworks data is present", () => {
        const { asFragment } = render(<ViewAllRoadworks liveRoadworks={mockLiveRoadworks} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render correctly when no roadworks data is present", () => {
        const { asFragment } = render(<ViewAllRoadworks liveRoadworks={[]} />);
        expect(asFragment()).toMatchSnapshot();
    });
});

describe("collectPositions", () => {
    it.each([
        ["null", null],
        ["undefined", undefined],
    ])("should return an empty array when the geometry is %s", (_name, geometry) => {
        expect(collectPositions(geometry)).toEqual([]);
    });

    it("should return the single position of a Point", () => {
        expect(collectPositions({ type: "Point", coordinates: [396413.66, 397262.46] })).toEqual([
            [396413.66, 397262.46],
        ]);
    });

    it("should return every position of a LineString", () => {
        expect(
            collectPositions({
                type: "LineString",
                coordinates: [
                    [389026.7, 402652.4],
                    [389066.7, 402735],
                    [389075, 402722.8],
                ],
            }),
        ).toEqual([
            [389026.7, 402652.4],
            [389066.7, 402735],
            [389075, 402722.8],
        ]);
    });

    it("should flatten the rings of a Polygon", () => {
        expect(
            collectPositions({
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [0, 10],
                        [10, 10],
                        [10, 0],
                        [0, 0],
                    ],
                ],
            }),
        ).toEqual([
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
        ]);
    });

    it("should flatten the deeply nested coordinates of a MultiPolygon", () => {
        expect(
            collectPositions({
                type: "MultiPolygon",
                coordinates: [
                    [
                        [
                            [0, 0],
                            [0, 2],
                            [2, 2],
                            [0, 0],
                        ],
                    ],
                    [
                        [
                            [10, 10],
                            [10, 12],
                            [12, 12],
                            [10, 10],
                        ],
                    ],
                ],
            }),
        ).toEqual([
            [0, 0],
            [0, 2],
            [2, 2],
            [0, 0],
            [10, 10],
            [10, 12],
            [12, 12],
            [10, 10],
        ]);
    });

    it("should collect positions from every geometry in a GeometryCollection", () => {
        expect(
            collectPositions({
                type: "GeometryCollection",
                geometries: [
                    { type: "Point", coordinates: [1, 2] },
                    {
                        type: "LineString",
                        coordinates: [
                            [3, 4],
                            [5, 6],
                        ],
                    },
                ],
            }),
        ).toEqual([
            [1, 2],
            [3, 4],
            [5, 6],
        ]);
    });

    it("should discard positions containing non-finite numbers", () => {
        expect(
            collectPositions({
                type: "LineString",
                coordinates: [
                    [Number.NaN, 10],
                    [20, Number.POSITIVE_INFINITY],
                    [30, 40],
                ],
            }),
        ).toEqual([[30, 40]]);
    });

    it("should return an empty array when the geometry has no coordinates", () => {
        expect(collectPositions({ type: "Point" } as unknown as GeoJSONGeometry)).toEqual([]);
    });
});

describe("getCentreOfGeometry", () => {
    it.each([
        ["null", null],
        ["undefined", undefined],
    ])("should return null when the geometry is %s", (_name, geometry) => {
        expect(getCentreOfGeometry(geometry)).toBeNull();
    });

    it("should return null when no valid positions can be collected", () => {
        expect(getCentreOfGeometry({ type: "Point", coordinates: [Number.NaN, Number.NaN] })).toBeNull();
    });

    it("should return the position itself for a Point", () => {
        expect(getCentreOfGeometry({ type: "Point", coordinates: [396413.66, 397262.46] })).toEqual([
            396413.66, 397262.46,
        ]);
    });

    it("should return the bounding box centre of a LineString", () => {
        expect(
            getCentreOfGeometry({
                type: "LineString",
                coordinates: [
                    [0, 0],
                    [10, 20],
                ],
            }),
        ).toEqual([5, 10]);
    });

    it("should return the bounding box centre of a Polygon, ignoring interior detail", () => {
        expect(
            getCentreOfGeometry({
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [0, 100],
                        [50, 100],
                        [50, 0],
                        [0, 0],
                    ],
                ],
            }),
        ).toEqual([25, 50]);
    });

    it("should handle negative coordinates", () => {
        expect(
            getCentreOfGeometry({
                type: "LineString",
                coordinates: [
                    [-10, -20],
                    [10, 20],
                ],
            }),
        ).toEqual([0, 0]);
    });
});

describe("roadWorkCoordinates", () => {
    it("should convert a POINT in British National Grid to a WGS84 GeoJSON feature", () => {
        const [result] = roadWorkCoordinates([baseRoadwork]);

        expect(result.worksLocationCoordinates.type).toBe("Feature");
        expect(result.worksLocationCoordinates.geometry.type).toBe("Point");

        const [longitude, latitude] = result.worksLocationCoordinates.geometry.coordinates;

        expect(longitude).toBeCloseTo(-2.0554968, 5);
        expect(latitude).toBeCloseTo(53.4720825, 5);
    });

    it("should preserve the rest of the roadwork properties", () => {
        const [result] = roadWorkCoordinates([baseRoadwork]);

        expect(result).toMatchObject({
            permitReferenceNumber: baseRoadwork.permitReferenceNumber,
            streetName: baseRoadwork.streetName,
            workStatus: baseRoadwork.workStatus,
            administrativeAreaCode: baseRoadwork.administrativeAreaCode,
        });
    });

    it("should use the centre of a LINESTRING", () => {
        const [asLineString] = roadWorkCoordinates([
            {
                ...baseRoadwork,
                worksLocationCoordinates: "LINESTRING(389026.7 402652.4,389066.7 402735,389075 402722.8)",
            },
        ]);

        const [asMidPoint] = roadWorkCoordinates([
            {
                ...baseRoadwork,
                worksLocationCoordinates: `POINT(${(389026.7 + 389075) / 2} ${(402652.4 + 402735) / 2})`,
            },
        ]);

        expect(asLineString.worksLocationCoordinates.geometry.coordinates).toEqual(
            asMidPoint.worksLocationCoordinates.geometry.coordinates,
        );
    });

    it("should use the centre of a POLYGON", () => {
        const [result] = roadWorkCoordinates([
            {
                ...baseRoadwork,
                worksLocationCoordinates:
                    "POLYGON((396400 397250,396400 397275,396427.32 397275,396427.32 397250,396400 397250))",
            },
        ]);

        const [longitude, latitude] = result.worksLocationCoordinates.geometry.coordinates;

        expect(longitude).toBeCloseTo(-2.0554968, 5);
        expect(latitude).toBeCloseTo(53.4720829, 5);
    });

    it.each([
        ["null", null],
        ["an empty string", ""],
        ["unparseable WKT", "NOT_VALID_WKT(1 2)"],
    ])("should drop roadworks with %s coordinates", (_name, worksLocationCoordinates) => {
        expect(roadWorkCoordinates([{ ...baseRoadwork, worksLocationCoordinates }])).toEqual([]);
    });

    it("should only drop the invalid roadworks", () => {
        const result = roadWorkCoordinates([
            { ...baseRoadwork, permitReferenceNumber: "valid-1" },
            { ...baseRoadwork, permitReferenceNumber: "invalid", worksLocationCoordinates: null },
            { ...baseRoadwork, permitReferenceNumber: "valid-2" },
        ]);

        expect(result.map((roadwork) => roadwork.permitReferenceNumber)).toEqual(["valid-1", "valid-2"]);
    });

    it("should return an empty array when given no roadworks", () => {
        expect(roadWorkCoordinates([])).toEqual([]);
    });
});

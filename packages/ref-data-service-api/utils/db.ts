import { Database } from "@create-disruptions-data/shared-ts/db/types";
import { Datasource, ReferenceDataVehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { PermitStatus } from "@create-disruptions-data/shared-ts/roadwork.zod";
import { logger } from "@create-disruptions-data/shared-ts/utils/logger";
import dayjs from "dayjs";
import { Kysely, sql } from "kysely";

// Type definition
export type StopsQueryInput = {
    atcoCodes?: string[];
    naptanCodes?: string[];
    adminAreaCodes?: string[];
    page?: number;
    polygon?: string;
    stopTypes?: string[];
    searchInput?: string;
};

export type OperatorQueryInput = {
    nocCode?: string;
    batchNocCodes?: string[];
    adminAreaCodes?: string[];
    modes?: ReferenceDataVehicleMode[];
    page?: number;
    dataSource?: Datasource;
};

export type ServicesForOperatorQueryInput = {
    nocCode: string;
    dataSource: Datasource;
    modes?: ReferenceDataVehicleMode[];
    lineNames?: string[];
};

export type ServiceByIdQueryInput = {
    nocCode: string;
    serviceRef: string;
    dataSource: Datasource;
};

export type ServiceStops = {
    serviceId: number;
    dataSource: "bods" | "tnds";
    fromId: number;
    fromAtcoCode: string;
    fromNaptanCode: string | null;
    fromCommonName: string | null;
    fromStreet: string | null;
    fromIndicator: string | null;
    fromBearing: string | null;
    fromNptgLocalityCode: string | null;
    fromLocalityName: string | null;
    fromParentLocalityName: string | null;
    fromLongitude: string | null;
    fromLatitude: string | null;
    fromStopType: string | null;
    fromBusStopType: string | null;
    fromTimingStatus: string | null;
    fromAdministrativeAreaCode: string | null;
    fromStatus: string | null;
    toId: number;
    toAtcoCode: string;
    toNaptanCode: string | null;
    toCommonName: string | null;
    toStreet: string | null;
    toIndicator: string | null;
    toBearing: string | null;
    toNptgLocalityCode: string | null;
    toLocalityName: string | null;
    toParentLocalityName: string | null;
    toLongitude: string | null;
    toLatitude: string | null;
    toStopType: string | null;
    toBusStopType: string | null;
    toTimingStatus: string | null;
    toAdministrativeAreaCode: string | null;
    toStatus: string | null;
    fromSequenceNumber: string | null;
    toSequenceNumber: string | null;
    journeyPatternId: number;
    orderInSequence: number;
    direction: string | null;
}[];

export type ServicesByStopsQueryInput = {
    dataSource: Datasource;
    page: number;
    stops: string[];
    modes?: ReferenceDataVehicleMode[];
    includeRoutes: boolean;
    adminAreaCodes?: string[];
    nocCodes?: string[];
};

export type ServicesQueryInput = {
    dataSource: Datasource;
    page: number;
    adminAreaCodes?: string[];
    modes?: ReferenceDataVehicleMode[];
    nocCodes?: string[];
};

export type ServiceStopsQueryInput = {
    serviceRef: string;
    dataSource: Datasource;
    modes?: ReferenceDataVehicleMode[];
    stopTypes?: string[];
    adminAreaCodes?: string[];
    useTracks?: boolean;
};

export type ServiceTracks = {
    serviceId: number;
    longitude: string;
    latitude: string;
}[];

export type Stops = {
    id: number;
    atcoCode: string | null;
    naptanCode: string | null;
    commonName: string | null;
    street: string | null;
    indicator: string | null;
    bearing: string | null;
    nptgLocalityCode: string | null;
    localityName: string | null;
    parentLocalityName: string | null;
    longitude: string | null;
    latitude: string | null;
    stopType: string | null;
    busStopType: string | null;
    timingStatus: string | null;
    administrativeAreaCode: string | null;
    status: string | null;
}[];

export type ServiceStop = {
    direction: string;
    sequenceNumber: string;
    journeyPatternId: number;
} & Stops[0];

export type ServiceJourneysQueryInput = {
    serviceRef: string;
    dataSource: Datasource;
    page?: number;
};

export type ServiceJourneys = {
    serviceId: number | null;
    dataSource: string | null;
    journeyCode: string | null;
    vehicleJourneyCode: string | null;
    departureTime: string | null;
    destination: string | null;
    origin: string | null;
    direction: string | null;
}[];

export type RoadworkByIdQueryInput = {
    permitReferenceNumber: string;
};

export type RoadworksQueryInput = {
    adminAreaCodes?: string[];
    page?: number;
    lastUpdatedTimeDelta?: number | null;
    createdTimeDelta?: number | null;
    permitStatus?: PermitStatus | null;
};

export type ServicesByStops = Awaited<ReturnType<typeof getServicesByStops>>;
export type AdminAreaCodes = Awaited<ReturnType<typeof getAdminAreaCodes>>;
export type AdminAreas = Awaited<ReturnType<typeof getAdminAreas>>;
export type Roadworks = Awaited<ReturnType<typeof getRoadworks>>;

// Constants
const ignoredStopTypes = ["FTD", "LSE", "RSE", "TMU"];
const ignoredBusStopTypes = ["HAR", "FLX"];

//Function definitions
export const getStops = async (dbClient: Kysely<Database>, input: StopsQueryInput) => {
    logger.info("Starting getStops...");

    const STOPS_PAGE_SIZE = process.env.IS_LOCAL === "true" ? 100 : 1000;

    const stops = await dbClient
        .selectFrom("stops")
        .innerJoin("localities", "localities.nptgLocalityCode", "stops.nptgLocalityCode")
        .select([
            "stops.id",
            "stops.atcoCode",
            "stops.naptanCode",
            "stops.commonName",
            "stops.street",
            "stops.indicator",
            "stops.bearing",
            "stops.nptgLocalityCode",
            "stops.localityName",
            "stops.parentLocalityName",
            "stops.longitude",
            "stops.latitude",
            "stops.stopType",
            "stops.busStopType",
            "stops.timingStatus",
            "localities.administrativeAreaCode",
            "stops.status",
        ])
        .where("stopType", "not in", ignoredStopTypes)
        .where("busStopType", "not in", ignoredBusStopTypes)
        .where("status", "=", "active")
        .$if(!!input.atcoCodes?.[0], (qb) => qb.where("atcoCode", "in", input.atcoCodes ?? ["---"]))
        .$if(!!input.naptanCodes?.[0], (qb) => qb.where("naptanCode", "in", input.naptanCodes ?? ["---"]))
        .$if(!!input.adminAreaCodes?.[0], (qb) =>
            qb
                .where("localities.administrativeAreaCode", "in", input.adminAreaCodes ?? ["---"])
                .$if(!!input.polygon, (qb) =>
                    qb.where(
                        sql<boolean>`ST_Contains(ST_GeomFromText(${input.polygon}), ST_MakePoint(stops.longitude::double precision, stops.latitude::double precision))`,
                    ),
                ),
        )
        .$if(!!input.stopTypes?.[0], (qb) => qb.where("stopType", "in", input.stopTypes ?? ["---"]))
        .$if(!!input.searchInput, (qb) =>
            qb.where((eb) =>
                eb.or([
                    eb("stops.commonName", "ilike", input.searchInput ? `%${input.searchInput}%` : "---"),
                    eb("stops.atcoCode", "ilike", input.searchInput ? `%${input.searchInput}%` : "---"),
                ]),
            ),
        )
        .offset((input.page || 0) * STOPS_PAGE_SIZE)
        .limit(STOPS_PAGE_SIZE)
        .execute();

    return stops;
};

export const getOperators = async (dbClient: Kysely<Database>, input: OperatorQueryInput) => {
    logger.info("Starting getOperators...");

    const OPERATORS_PAGE_SIZE = 1000;

    if (input.nocCode) {
        const services = await dbClient
            .selectFrom("services")
            .select([
                "services.id as serviceId",
                "services.lineName",
                "services.lineId",
                "services.serviceDescription",
                "services.origin",
                "services.destination",
                "services.mode",
            ])
            .where((qb) =>
                qb.or([
                    qb("services.endDate", "is", null),
                    qb(sql`CAST(${qb.ref("services.endDate")} AS DATE)`, ">=", sql`CURRENT_DATE`),
                ]),
            )
            .where("nocCode", "=", input.nocCode)
            .execute();

        const operator = await dbClient
            .selectFrom("operators")
            .leftJoin("operatorLines", "operatorLines.nocCode", "operators.nocCode")
            .leftJoin("operatorPublicData", "operatorPublicData.pubNmId", "operators.pubNmId")
            .selectAll(["operators", "operatorLines", "operatorPublicData"])
            .where("operators.nocCode", "=", input.nocCode)
            .executeTakeFirst();

        if (!operator) {
            return null;
        }

        return {
            ...operator,
            services,
        };
    }

    let query = dbClient.selectFrom("operators").innerJoin("services", "services.nocCode", "operators.nocCode");

    if (input.batchNocCodes && input.batchNocCodes.length > 0) {
        query = query.where("nocCode", "in", input.batchNocCodes ?? []);
    }

    if (!!input.adminAreaCodes && input.adminAreaCodes.length > 0) {
        query = query
            .innerJoin("serviceAdminAreaCodes", "serviceAdminAreaCodes.serviceId", "services.id")
            .where("serviceAdminAreaCodes.adminAreaCode", "in", input.adminAreaCodes ?? []);
    }

    if (!!input.modes && input.modes.length > 0) {
        query = query.where("services.mode", "in", input.modes);
    }

    if (input.dataSource) {
        query = query.where("services.dataSource", "=", input.dataSource ?? Datasource.bods);
    }

    return query
        .select([
            "operators.id",
            "operators.nocCode",
            "operatorPublicName",
            "operators.vosaPsvLicenseName",
            "operators.opId",
            "operators.pubNmId",
            "operators.nocCdQual",
            "operators.changeDate",
            "operators.changeAgent",
            "operators.changeComment",
            "operators.dateCeased",
            "operators.dataOwner",
            "services.mode",
            "services.dataSource",
        ])
        .distinct()
        .orderBy("operators.id")
        .offset((input.page || 0) * OPERATORS_PAGE_SIZE)
        .limit(OPERATORS_PAGE_SIZE)
        .execute();
};

export const getServicesForOperator = async (dbClient: Kysely<Database>, input: ServicesForOperatorQueryInput) => {
    logger.info("Starting getServicesForOperator...");

    return dbClient
        .selectFrom("services")
        .selectAll()
        .where("nocCode", "=", input.nocCode)
        .where("dataSource", "=", input.dataSource)
        .$if(!!input.modes && input.modes.length > 0, (qb) => qb.where("mode", "in", input.modes ?? []))
        .where((qb) =>
            qb.or([
                qb("services.endDate", "is", null),
                qb(sql`CAST(${qb.ref("services.endDate")} AS DATE)`, ">=", sql`CURRENT_DATE`),
            ]),
        )
        .$if(!!input.lineNames && input.lineNames.length > 0, (qb) =>
            qb.where("services.lineName", "in", input.lineNames ?? []),
        )
        .orderBy("lineName", "asc")
        .orderBy("startDate", "asc")
        .execute();
};

const getMostRelevantService = <
    T extends {
        id: number;
        startDate: string | null;
        endDate: string | null;
    },
>(
    services: T[],
) => {
    if (services.length === 1) {
        return services[0];
    }

    return (
        services.find((s) => {
            const start = s.startDate ? dayjs(s.startDate, "YYYY-MM-DD") : null;
            const end = s.endDate ? dayjs(s.endDate, "YYYY-MM-DD") : null;
            const currentDate = dayjs();

            return (
                (start && end && currentDate.isBetween(start, end, "date", "[]")) ||
                (!end && start && currentDate.isSameOrAfter(start, "date"))
            );
        }) || services[0]
    );
};

export const getServiceById = async (dbClient: Kysely<Database>, input: ServiceByIdQueryInput) => {
    logger.info("Starting getService...");

    const keyToUse = input.dataSource === Datasource.bods ? "services.lineId" : "services.serviceCode";

    const services = await dbClient
        .selectFrom("services")
        .selectAll()
        .where("services.nocCode", "=", input.nocCode)
        .where(keyToUse, "=", input.serviceRef)
        .where("dataSource", "=", input.dataSource)
        .orderBy("services.startDate", "asc")
        .execute();

    const service = getMostRelevantService(services);

    if (!service?.nocCode) {
        return null;
    }

    return service;
};

export const getServicesByStops = async (dbClient: Kysely<Database>, input: ServicesByStopsQueryInput) => {
    logger.info("Starting getServicesByStops...");

    const services = await dbClient
        .selectFrom("services")
        .innerJoin("serviceJourneyPatterns", "serviceJourneyPatterns.operatorServiceId", "services.id")
        .innerJoin(
            "serviceJourneyPatternLinks",
            "serviceJourneyPatternLinks.journeyPatternId",
            "serviceJourneyPatterns.id",
        )
        .$if(!!input.adminAreaCodes?.[0], (qb) =>
            qb.where((eb) =>
                eb.exists(
                    eb
                        .selectFrom("serviceAdminAreaCodes")
                        .where("serviceAdminAreaCodes.serviceId", "=", eb.ref("services.id"))
                        .where("serviceAdminAreaCodes.adminAreaCode", "in", input.adminAreaCodes ?? []),
                ),
            ),
        )
        .$if(!!input.nocCodes?.[0], (qb) => qb.where("services.nocCode", "in", input.nocCodes ?? ["---"]))
        .selectAll("services")
        .select(["fromAtcoCode", "toAtcoCode"])

        .distinctOn(["fromAtcoCode", "toAtcoCode"])
        .where((qb) => qb.or([qb("fromAtcoCode", "in", input.stops), qb("toAtcoCode", "in", input.stops)]))
        .where("dataSource", "=", input.dataSource)
        .orderBy([
            "fromAtcoCode",
            "toAtcoCode",
            "serviceJourneyPatternLinks.fromSequenceNumber",
            "serviceJourneyPatterns.direction",
        ])
        .execute();

    return services;
};

export const getServices = async (dbClient: Kysely<Database>, input: ServicesQueryInput) => {
    logger.info("Starting getServices...");

    const SERVICES_PAGE_SIZE = process.env.IS_LOCAL === "true" ? 200 : 2000;

    const services = await dbClient
        .selectFrom("services")
        .selectAll(["services"])
        .where("services.dataSource", "=", input.dataSource)
        .$if(!!input.modes?.[0], (qb) => qb.where("services.mode", "in", input.modes ?? ["---"]))
        .$if(!!input.nocCodes?.[0], (qb) => qb.where("services.nocCode", "in", input.nocCodes ?? ["---"]))
        .$if(!!input.adminAreaCodes?.[0], (qb) =>
            qb.where((eb) =>
                eb.exists(
                    eb
                        .selectFrom("serviceAdminAreaCodes")
                        .where("serviceAdminAreaCodes.serviceId", "=", eb.ref("services.id"))
                        .where("serviceAdminAreaCodes.adminAreaCode", "in", input.adminAreaCodes ?? []),
                ),
            ),
        )
        .where((qb) =>
            qb.or([
                qb("services.endDate", "is", null),
                qb(sql`CAST(${qb.ref("services.endDate")} AS DATE)`, ">=", sql`CURRENT_DATE`),
            ]),
        )
        .offset((input.page || 0) * SERVICES_PAGE_SIZE)
        .limit(SERVICES_PAGE_SIZE)
        .execute();

    return services;
};

export const getServiceStops = async (
    dbClient: Kysely<Database>,
    input: ServiceStopsQueryInput,
): Promise<ServiceStops | ServiceTracks> => {
    logger.info("Starting getServiceStops...");

    const keyToUse = input.dataSource === Datasource.bods ? "services.lineId" : "services.serviceCode";

    const services = await dbClient
        .selectFrom("services")
        .select(["id", "startDate", "endDate"])
        .where(keyToUse, "=", input.serviceRef)
        .where("dataSource", "=", input.dataSource)
        .execute();

    if (!services.length) {
        return [];
    }

    const service = getMostRelevantService(services);

    if (input.useTracks) {
        const tracks = await dbClient
            .selectFrom("tracks")
            .select(["operatorServiceId as serviceId", "longitude", "latitude"])
            .where("operatorServiceId", "=", service.id)
            .execute();

        if (tracks && tracks.length > 0) {
            return tracks;
        }
    }

    const stops = await dbClient
        .selectFrom("services")
        .innerJoin("serviceJourneyPatterns", "serviceJourneyPatterns.operatorServiceId", "services.id")
        .innerJoin(
            "serviceJourneyPatternLinks",
            "serviceJourneyPatternLinks.journeyPatternId",
            "serviceJourneyPatterns.id",
        )
        .innerJoin("stops as fromStop", "fromStop.atcoCode", "serviceJourneyPatternLinks.fromAtcoCode")
        .innerJoin("stops as toStop", "toStop.atcoCode", "serviceJourneyPatternLinks.toAtcoCode")
        .$if(!!input.adminAreaCodes?.[0], (qb) =>
            qb.where((eb) =>
                eb.exists(
                    eb
                        .selectFrom("serviceAdminAreaCodes")
                        .where("serviceAdminAreaCodes.serviceId", "=", eb.ref("services.id"))
                        .where("serviceAdminAreaCodes.adminAreaCode", "in", input.adminAreaCodes ?? []),
                ),
            ),
        )
        .select([
            "services.id as serviceId",
            "services.dataSource as dataSource",
            "fromStop.id as fromId",
            "fromStop.atcoCode as fromAtcoCode",
            "fromStop.naptanCode as fromNaptanCode",
            "fromStop.commonName as fromCommonName",
            "fromStop.street as fromStreet",
            "fromStop.indicator as fromIndicator",
            "fromStop.bearing as fromBearing",
            "fromStop.nptgLocalityCode as fromNptgLocalityCode",
            "fromStop.localityName as fromLocalityName",
            "fromStop.parentLocalityName as fromParentLocalityName",
            "fromStop.longitude as fromLongitude",
            "fromStop.latitude as fromLatitude",
            "fromStop.stopType as fromStopType",
            "fromStop.busStopType as fromBusStopType",
            "fromStop.timingStatus as fromTimingStatus",
            "fromStop.administrativeAreaCode as fromAdministrativeAreaCode",
            "fromStop.status as fromStatus",
            "toStop.id as toId",
            "toStop.atcoCode as toAtcoCode",
            "toStop.naptanCode as toNaptanCode",
            "toStop.commonName as toCommonName",
            "toStop.street as toStreet",
            "toStop.indicator as toIndicator",
            "toStop.bearing as toBearing",
            "toStop.nptgLocalityCode as toNptgLocalityCode",
            "toStop.localityName as toLocalityName",
            "toStop.parentLocalityName as toParentLocalityName",
            "toStop.longitude as toLongitude",
            "toStop.latitude as toLatitude",
            "toStop.stopType as toStopType",
            "toStop.busStopType as toBusStopType",
            "toStop.timingStatus as toTimingStatus",
            "toStop.administrativeAreaCode as toAdministrativeAreaCode",
            "toStop.status as toStatus",
            "serviceJourneyPatternLinks.toSequenceNumber",
            "serviceJourneyPatternLinks.orderInSequence",
            "serviceJourneyPatternLinks.fromSequenceNumber",
            "serviceJourneyPatternLinks.journeyPatternId",
            "serviceJourneyPatterns.direction",
        ])
        .distinctOn(["fromStop.id", "toStop.id"])
        .where("services.id", "=", service.id)
        .where("dataSource", "=", input.dataSource)
        .where("fromStop.stopType", "not in", ignoredStopTypes)
        .where("toStop.stopType", "not in", ignoredStopTypes)
        .where("fromStop.busStopType", "not in", ignoredBusStopTypes)
        .where("toStop.busStopType", "not in", ignoredBusStopTypes)
        .where((qb) => qb.or([qb("fromStop.status", "=", "active"), qb("toStop.status", "=", "active")]))
        .$if(!!input.modes?.[0], (qb) => qb.where("services.mode", "in", input.modes ?? ["---"]))
        .orderBy([
            "fromStop.id",
            "toStop.id",
            "serviceJourneyPatternLinks.orderInSequence",
            "serviceJourneyPatternLinks.journeyPatternId",
        ])
        .execute();

    return stops;
};

export const getServiceJourneys = async (
    dbClient: Kysely<Database>,
    input: ServiceJourneysQueryInput,
): Promise<ServiceJourneys> => {
    logger.info("Starting getServiceJourneys...");

    const keyToUse = input.dataSource === Datasource.bods ? "services.lineId" : "services.serviceCode";

    const JOURNEY_PAGE_SIZE = process.env.IS_LOCAL === "true" ? 100 : 1000;

    const services = await dbClient
        .selectFrom("services")
        .select(["id", "startDate", "endDate"])
        .where(keyToUse, "=", input.serviceRef)
        .where("dataSource", "=", input.dataSource)
        .execute();

    if (!services.length) {
        return [];
    }

    const service = getMostRelevantService(services);

    const journeys = await dbClient
        .selectFrom("services")
        .innerJoin("serviceJourneyPatterns", "serviceJourneyPatterns.operatorServiceId", "services.id")
        .innerJoin("vehicleJourneys", (join) =>
            join
                .onRef("vehicleJourneys.operatorServiceId", "=", "services.id")
                .onRef("vehicleJourneys.journeyPatternRef", "=", "serviceJourneyPatterns.journeyPatternRef"),
        )
        .select([
            "services.id as serviceId",
            "services.dataSource as dataSource",
            "vehicleJourneys.journeyCode",
            "vehicleJourneys.vehicleJourneyCode",
            "vehicleJourneys.departureTime",
            "services.destination",
            "services.origin",
            "serviceJourneyPatterns.direction",
        ])
        .distinct()
        .where("services.id", "=", service.id)
        .where("dataSource", "=", input.dataSource)
        .where("vehicleJourneys.operationalForToday", "=", true)
        .offset((input.page || 0) * JOURNEY_PAGE_SIZE)
        .limit(JOURNEY_PAGE_SIZE)
        .execute();

    return journeys;
};

export const getAdminAreaCodes = async (dbClient: Kysely<Database>) => {
    logger.info("Starting getAdminAreaCodes...");

    const areaCodes = await dbClient.selectFrom("stops").select("administrativeAreaCode").distinct().execute();

    return areaCodes;
};

export const getAdminAreas = async (dbClient: Kysely<Database>) => {
    logger.info("Starting getAdminAreas...");

    const areaCodes = await dbClient
        .selectFrom("nptgAdminAreas")
        .select(["administrativeAreaCode", "name", "shortName"])
        .distinct()
        .execute();

    return areaCodes;
};

export const getRoadworks = async (dbClient: Kysely<Database>, input: RoadworksQueryInput) => {
    logger.info("Starting getRoadworks...");

    const ROADWORKS_PAGE_SIZE = process.env.IS_LOCAL === "true" ? 50 : 2000;

    return dbClient
        .selectFrom("roadworks")
        .innerJoin(
            "highwayAuthorityAdminAreas",
            "highwayAuthorityAdminAreas.highwayAuthoritySwaCode",
            "roadworks.highwayAuthoritySwaCode",
        )
        .$if(!!input.adminAreaCodes && input.adminAreaCodes.length > 0, (qb) =>
            qb.where("highwayAuthorityAdminAreas.administrativeAreaCode", "in", input.adminAreaCodes ?? []),
        )
        .$if(!!input.permitStatus, (qb) => qb.where("roadworks.permitStatus", "=", input.permitStatus ?? null))
        .$if(!!input.lastUpdatedTimeDelta, (qb) =>
            qb.where(
                sql`CAST(roadworks.last_updated_date_time AS TIMESTAMPTZ)`,
                ">=",
                sql`NOW() - INTERVAL '${sql.lit(input.lastUpdatedTimeDelta)} MINUTES'`,
            ),
        )
        .$if(!!input.createdTimeDelta, (qb) =>
            qb.where(
                sql`CAST(roadworks.created_date_time AS TIMESTAMPTZ)`,
                ">=",
                sql`NOW() - INTERVAL '${sql.lit(input.createdTimeDelta)} MINUTES'`,
            ),
        )
        .select([
            "roadworks.permitReferenceNumber",
            "roadworks.highwayAuthoritySwaCode",
            "roadworks.streetName",
            "roadworks.areaName",
            "roadworks.town",
            "roadworks.worksLocationCoordinates",
            "roadworks.activityType",
            "roadworks.proposedStartDateTime",
            "roadworks.proposedEndDateTime",
            "roadworks.actualStartDateTime",
            "roadworks.actualEndDateTime",
            "roadworks.permitStatus",
            "roadworks.workStatus",
            "highwayAuthorityAdminAreas.administrativeAreaCode",
        ])
        .distinct()
        .orderBy("roadworks.proposedStartDateTime")
        .offset((input.page || 0) * ROADWORKS_PAGE_SIZE)
        .limit(ROADWORKS_PAGE_SIZE)
        .execute();
};

export const getRoadworkById = async (dbClient: Kysely<Database>, input: RoadworkByIdQueryInput) => {
    logger.info("Starting getRoadworkById...");

    return dbClient
        .selectFrom("roadworks")
        .innerJoin(
            "highwayAuthorityAdminAreas",
            "highwayAuthorityAdminAreas.highwayAuthoritySwaCode",
            "roadworks.highwayAuthoritySwaCode",
        )
        .where("roadworks.permitReferenceNumber", "=", input.permitReferenceNumber)
        .select([
            "roadworks.permitReferenceNumber",
            "roadworks.highwayAuthoritySwaCode",
            "roadworks.highwayAuthority",
            "roadworks.streetName",
            "roadworks.areaName",
            "roadworks.town",
            "roadworks.worksLocationCoordinates",
            "roadworks.activityType",
            "roadworks.workCategory",
            "roadworks.trafficManagementType",
            "roadworks.proposedStartDateTime",
            "roadworks.proposedEndDateTime",
            "roadworks.actualStartDateTime",
            "roadworks.actualEndDateTime",
            "roadworks.permitStatus",
            "roadworks.workStatus",
            "highwayAuthorityAdminAreas.administrativeAreaCode",
            "roadworks.createdDateTime",
            "roadworks.lastUpdatedDateTime",
        ])
        .distinct()
        .executeTakeFirst();
};

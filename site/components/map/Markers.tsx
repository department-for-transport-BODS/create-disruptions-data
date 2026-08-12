import { Stop } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { uniqueId } from "lodash";
import { Dispatch, ReactElement, SetStateAction, memo } from "react";
import { Marker } from "react-map-gl";

interface MarkersProps {
    selectedStops: Stop[];
    stopOptions: Stop[];
    markerData: Stop[];
    unselectMarker: (id: string) => void;
    selectMarker: (id: string) => void;
    handleMouseEnter: (id: string) => void;
    setPopupInfo: Dispatch<SetStateAction<Partial<Stop>>>;
    pastStops?: Stop[];
}

const Markers = ({
    selectedStops,
    stopOptions,
    markerData,
    unselectMarker,
    selectMarker,
    handleMouseEnter,
    setPopupInfo,
    pastStops,
}: MarkersProps): ReactElement | null => {
    const dataFromPolygon =
        selectedStops && selectedStops.length > 0
            ? markerData.filter((sToFilter: Stop) => !selectedStops.some((s) => s.atcoCode === sToFilter.atcoCode))
            : markerData;

    const filterSelected =
        selectedStops && selectedStops.length > 0
            ? stopOptions.filter((sToFilter: Stop) => !selectedStops.some((s) => s.atcoCode === sToFilter.atcoCode))
            : stopOptions;

    const notInTable =
        markerData && markerData.length > 0
            ? filterSelected.filter((sToFilter: Stop) => !markerData.some((s) => s.atcoCode === sToFilter.atcoCode))
            : filterSelected;

    const previouslySelectedStops =
        pastStops && pastStops.length > 0
            ? pastStops
                  .filter((sToFilter: Stop) => !markerData.some((s) => s.atcoCode === sToFilter.atcoCode))
                  .filter((sToFilter: Stop) => !selectedStops.some((s) => s.atcoCode === sToFilter.atcoCode))
                  .filter((sToFilter: Stop) => !stopOptions.some((s) => s.atcoCode === sToFilter.atcoCode))
            : pastStops;

    return (
        <>
            {selectedStops && selectedStops.length > 0
                ? selectedStops.map((s: Stop) => (
                      <Marker
                          key={uniqueId(s.atcoCode)}
                          longitude={Number(s.longitude)}
                          latitude={Number(s.latitude)}
                          onClick={() => {
                              unselectMarker(s.atcoCode);
                          }}
                      >
                          <div
                              className="bg-markerActive h-4 w-4 rounded-full inline-block cursor-pointer"
                              onMouseEnter={() => {
                                  handleMouseEnter(s.atcoCode);
                              }}
                              onMouseLeave={() => {
                                  setPopupInfo({});
                              }}
                          />
                      </Marker>
                  ))
                : null}
            {[...dataFromPolygon, ...notInTable, ...(previouslySelectedStops || [])].map((s) => (
                <Marker
                    key={uniqueId(s.atcoCode)}
                    longitude={Number(s.longitude)}
                    latitude={Number(s.latitude)}
                    color="grey"
                    onClick={() => {
                        selectMarker(s.atcoCode);
                    }}
                >
                    <div
                        className="bg-markerDefault h-4 w-4 rounded-full inline-block cursor-pointer"
                        onMouseEnter={() => {
                            handleMouseEnter(s.atcoCode);
                        }}
                        onMouseLeave={() => {
                            setPopupInfo({});
                        }}
                    />
                </Marker>
            ))}
        </>
    );
};

export default memo(Markers);

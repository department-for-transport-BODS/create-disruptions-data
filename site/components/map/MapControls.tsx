import { ReactElement } from "react";
import { FullscreenControl, NavigationControl } from "react-map-gl";
import DrawControl, { PolygonFeature } from "./DrawControl";
import GeocoderControl from "./GeocoderControl";

interface MapControlsProps {
    onUpdate: (evt: { features: PolygonFeature[] }) => void;
    onDelete: () => void;
    trash?: boolean;
    polygon?: boolean;
    showDrawControl?: boolean;
}

const MapControls = ({
    onUpdate,
    onDelete,
    trash = true,
    polygon = true,
    showDrawControl = true,
}: MapControlsProps): ReactElement | null => {
    const mapboxAccessToken = process.env.MAP_BOX_ACCESS_TOKEN;

    return mapboxAccessToken ? (
        <>
            <GeocoderControl mapboxAccessToken={mapboxAccessToken} position="top-right" />
            <NavigationControl showCompass={false} />
            <FullscreenControl />
            {showDrawControl ? (
                <DrawControl
                    position="top-left"
                    displayControlsDefault={false}
                    controls={{
                        polygon: polygon,
                        trash: trash,
                    }}
                    defaultMode="draw_polygon"
                    onCreate={(evt) => {
                        onUpdate(evt);
                    }}
                    onUpdate={(evt) => {
                        onUpdate(evt);
                    }}
                    onDelete={() => {
                        onDelete();
                    }}
                />
            ) : null}
        </>
    ) : null;
};

export default MapControls;

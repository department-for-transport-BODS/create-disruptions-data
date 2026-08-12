import { Service } from "@create-disruptions-data/shared-ts/disruptionTypes";
import { Datasource } from "@create-disruptions-data/shared-ts/enums";
import { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";
import Select, { CSSObjectWithLabel, ControlProps, GroupBase, OptionProps } from "react-select";
import { getServiceLabel } from "../../utils";
import Dropdown from "../form/Select";

interface ServiceSearchProps {
    services: Service[];
    setSelectedServices: Dispatch<SetStateAction<Service[]>>;
    selectedServices: Service[];
    handleDataSourceUpdate: Dispatch<SetStateAction<string>>;
    dataSource: string;
    reset?: boolean;
    className?: string;
}

const ServiceSearch = ({
    services,
    setSelectedServices,
    selectedServices,
    reset = false,
    dataSource,
    handleDataSourceUpdate,
    className = "",
}: ServiceSearchProps): ReactElement => {
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        if (reset) {
            setSelectedServices([]);
        }
    }, [reset, setSelectedServices]);

    const controlStyles = (state: ControlProps<Service, false, GroupBase<Service>>): CSSObjectWithLabel => ({
        fontFamily: "GDS Transport, arial, sans-serif",
        border: "#0b0c0c solid 2px",
        outline: state.isFocused ? "#ffdd00 solid 3px" : "none",
        color: state.isFocused ? "white" : "#0b0c0c",
        marginBottom: "20px",
        "&:hover": { borderColor: "#0b0c0c" },
        width: "75%",
    });

    const optionStyles = (state: OptionProps<Service, false, GroupBase<Service>>): CSSObjectWithLabel => ({
        color: state.isFocused ? "white" : "#0b0c0c",
        backgroundColor: state.isFocused ? "#3399ff" : "white",
    });

    return (
        <div className="govuk-form-group flex">
            <div className="w-2/3">
                <label className="govuk-label govuk-label--s" htmlFor="service-filter-dropdown-value">
                    Services
                </label>
                <Select
                    isSearchable
                    styles={{
                        control: (baseStyles, state) => ({
                            ...baseStyles,
                            ...controlStyles(state),
                        }),
                        option: (provided, state) => ({
                            ...provided,
                            ...optionStyles(state),
                        }),
                        placeholder: (baseStyles) => ({
                            ...baseStyles,
                            color: "black",
                        }),
                    }}
                    placeholder="Select services"
                    getOptionLabel={getServiceLabel}
                    getOptionValue={(service: Service) => service.id.toString()}
                    options={services}
                    onInputChange={(text) => {
                        setSearchText(text);
                    }}
                    inputValue={searchText}
                    onChange={(service) => {
                        if (!selectedServices.find((selService) => selService.id === (service as Service).id)) {
                            setSelectedServices([...selectedServices, service as Service]);
                        }
                    }}
                    id="service-filter"
                    instanceId="service-filter-dropdown"
                    inputId="service-filter-dropdown-value"
                    menuPlacement="auto"
                    menuPosition="fixed"
                    value={null}
                    className={className || "text-lg text-black"}
                />
            </div>
            <div className="w-1/3">
                <Dropdown
                    inputName="servicesDataSource"
                    display="Services data source"
                    value={dataSource || "all"}
                    defaultDisplay="Select a services data source"
                    selectValues={[
                        { display: "All sources", value: "all" },
                        { display: "BODS", value: Datasource.bods },
                        { display: "TNDS", value: Datasource.tnds },
                    ]}
                    stateUpdater={handleDataSourceUpdate}
                    width="1/4"
                    useDefaultValue={false}
                />
            </div>
        </div>
    );
};

export default ServiceSearch;

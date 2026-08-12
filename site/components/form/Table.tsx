import { ReactElement, ReactNode } from "react";

export interface TableStyles {
    width?: string;
}

export interface CellProps {
    value: string | ReactNode;
    styles?: TableStyles;
}

interface TableProps {
    caption?: { text: string; size: "s" | "m" | "l" };
    columns?: string[];
    rows: { header?: string | ReactNode; cells: string[] | ReactNode[] | CellProps[] }[];
}

const isCellProps = (cell: string | ReactNode | CellProps): cell is CellProps => {
    if (cell && typeof cell === "object" && "value" in cell) {
        return true;
    }
    return false;
};

const Table = ({ caption, columns = [], rows }: TableProps): ReactElement => {
    return (
        <table className="govuk-table">
            {caption ? (
                <caption className={`govuk-table__caption govuk-table__caption--${caption.size}`}>
                    {caption.text}
                </caption>
            ) : (
                ""
            )}
            <thead className="govuk-table__head">
                <tr className="govuk-table__row">
                    {columns.map((column) => (
                        <th scope="col" className="govuk-table__header align-middle px-2" key={column}>
                            {column}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="govuk-table__body">
                {rows.map((row, index) => (
                    <tr className="govuk-table__row" key={`row-${index}`}>
                        {row.header && (
                            <th scope="row" className="govuk-table__header align-middle">
                                {row.header}
                            </th>
                        )}
                        {row.cells.map((cell, i) => (
                            <td
                                className={`govuk-table__cell align-middle overflow-hidden px-2 max-w-2xl ${
                                    isCellProps(cell) && cell.styles?.width ? cell.styles?.width : ""
                                }`}
                                key={i}
                            >
                                {isCellProps(cell) ? cell.value : cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default Table;

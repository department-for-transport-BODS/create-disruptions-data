import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ExpiredLink from "./expired-link.page";

afterEach(() => {
    cleanup();
});

describe("ExpiredLink", () => {
    it("should render correctly", () => {
        const { asFragment } = render(<ExpiredLink supportEmail="bodshelpdesk@kainos.com" />);
        expect(asFragment()).toMatchSnapshot();
    });
});

import { NextPageContext } from "next";
import { parseCookies } from "nookies";
import { ReactElement, useState } from "react";
import UserDetailPageTemplate from "../../components/page-templates/UserDetailPageTemplate";
import { COOKIES_ADD_USER_ERRORS } from "../../constants";
import { listOperatorsForOrg } from "../../data/dynamo";
import { PageState } from "../../interfaces";
import { AddUserSchema, addUserSchema } from "../../schemas/add-user.schema";
import { OperatorOrgSchema } from "../../schemas/organisation.schema";
import { destroyCookieOnResponseObject, getPageState } from "../../utils/apiUtils";
import { getSessionWithOrgDetail } from "../../utils/apiUtils/auth";

const title = "Add User - Create Transport Disruptions Service";
const description = "Add User page for the Create Transport Disruptions Service";

export interface AddUserPageProps extends PageState<Partial<AddUserSchema>> {
    operatorsForOrg?: OperatorOrgSchema[];
}

const AddUser = (props: AddUserPageProps): ReactElement => {
    const [pageState, setPageState] = useState(props);

    return (
        <UserDetailPageTemplate
            pageType={"addUser"}
            title={title}
            description={description}
            pageState={pageState}
            setPageState={setPageState}
        />
    );
};

export const getServerSideProps = async (ctx: NextPageContext): Promise<{ props: AddUserPageProps }> => {
    const cookies = parseCookies(ctx);
    const errorCookie = cookies[COOKIES_ADD_USER_ERRORS];

    if (!ctx.req) {
        throw new Error("No context request");
    }

    if (ctx.res) destroyCookieOnResponseObject(COOKIES_ADD_USER_ERRORS, ctx.res);

    const session = await getSessionWithOrgDetail(ctx.req);

    if (!session) {
        throw new Error("No session found");
    }

    const operatorsForOrg = await listOperatorsForOrg(session.orgId);

    return {
        props: {
            ...getPageState(errorCookie, addUserSchema),
            sessionWithOrg: session,
            operatorsForOrg: operatorsForOrg ?? [],
        },
    };
};

export default AddUser;

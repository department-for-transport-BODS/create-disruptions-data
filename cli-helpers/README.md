# CLI Helpers

We have created the following CLI helpers to make it easier to work with the Create Disruptions Data service:

- [create-org](#create-org)
- [create-user](#create-user)
- [create-operator-org](#create-operator-org)
- [change-user-group](#change-user-group)
- [delete-buckets](#delete-buckets)

## Usage

Before running these cli helpers scripts ensure you have authed against the AWS account you wish to perform the action
on.

Make commands are used to run these scripts, ensure you are in the root directory when running these commands.

### create-org

This script creates a new organisation in the Create Disruptions Data service.

```bash
make command-create-org
```

#### Properties:

- stage: The stage to create the organisation in (e.g., dev, prod).
- name: The name of the organisation to create.
- adminAreaCodes: A comma-separated list of admin area codes for the organisation.

### create-user

This script creates a new user in the Create Disruptions Data service.

```bash
make command-create-user
```

#### Properties:

- stage: The stage to create the user in (e.g., dev, prod).
- email: The email address of the user to create.
- firstName: The first name of the user to create.
- lastName: The last name of the user to create.
- poolId: The ID of the Cognito user pool to create the user in (there should only be one option to select:
  cdd-user-pool-ENV).
- orgId: The ID of the organisation to create the user in
- group: The group to add the user to (e.g., system-admin, org-admin, org-publisher, org-staff, operator).
- operatorOrgId: The ID of the operator organisation to create the user in (optional, only required if the user is an
  operator).

### create-operator-org

This script creates a new operator organisation in the Create Disruptions Data service.

```bash
make command-create-operator-org
```

#### Properties:

- stage: The stage to create the operator organisation in (e.g., dev, prod).
- orgId: The ID of the parent organisation to create the operator organisation in. (Org details can be found in the
  dynamodb table cdd-organisations-v2-table)
- name: The name of the operator organisation to create.
- nocCode: The NOC codes associated with this operator.

### change-user-group

This script changes the group (user type) of an existing user in the Create Disruptions Data service.

```bash
make command-change-user-group
```

#### Properties:

- stage: The stage to change the user group in (e.g., dev, prod).
- email: The email address of the user to change the group for.
- poolId: The ID of the Cognito user pool to change the user group in (there should only be one option to select:
  cdd-user-pool-ENV).
- group: The new group to add the user to (e.g., system-admin, org-admin, org-publisher, org-staff, operator).

### delete-buckets

This script finds every S3 bucket in the AWS account you are authed against whose name ends with `-<stage>`, empties
them (including all object versions and delete markers) and then deletes them. The buckets found are listed and
confirmation is required before anything is deleted.

The `prod`, `preprod`, `test` and `sandbox` stages are blocked to avoid accidental deletion of shared environments.

```bash
make command-delete-buckets
```

#### Properties:

- stage: The stage to delete buckets for (e.g., a personal dev stage)


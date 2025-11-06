#!/bin/bash

read -p "Enter stage name: " STAGE_NAME

if [ -z "$STAGE_NAME" ]; then
    echo "Error: Stage name cannot be empty"
    exit 1
fi

echo "Fetching state machines for stage: $STAGE_NAME..."

STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
    --query "stateMachines[?contains(name, '$STAGE_NAME')].stateMachineArn" \
    --output text)

if [ -z "$STATE_MACHINE_ARN" ]; then
    echo "Error: No state machine found containing '$STAGE_NAME'"
    exit 1
fi

STATE_MACHINE_COUNT=$(echo "$STATE_MACHINE_ARN" | tr '\t' '\n' | grep -c .)

if [ "$STATE_MACHINE_COUNT" -gt 1 ]; then
    echo "Multiple state machines found:"
    echo "$STATE_MACHINE_ARN" | tr '\t' '\n' | nl
    read -p "Enter the number of the state machine to execute: " SELECTION
    STATE_MACHINE_ARN=$(echo "$STATE_MACHINE_ARN" | tr '\t' '\n' | sed -n "${SELECTION}p")
fi

echo "Selected state machine: $STATE_MACHINE_ARN"

EXECUTION_ARN=$(aws stepfunctions start-execution \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --output text \
    --query 'executionArn')

echo "Execution started successfully!"
echo "Execution ARN: $EXECUTION_ARN"

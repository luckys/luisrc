const amount = (value) => Number(value.toFixed(8));
export function validateInputs(input) {
    const required = ['requests', 'hours', 'memoryMb', 'billedMs', 'payloadBytes', 'tasks',
        'taskVcpu', 'taskMemoryGb', 'interfaceServices', 'zones', 'interfaceGb', 'publicIpv4', 'assumedLcu'];
    for (const key of required)
        if (!Number.isFinite(input[key]))
            throw Error(`finite_input_required:${key}`);
    for (const key of ['requests', 'memoryMb', 'billedMs', 'tasks', 'zones', 'interfaceServices', 'publicIpv4', 'payloadBytes'])
        if (!Number.isSafeInteger(input[key]))
            throw Error(`integer_required:${key}`);
    if (input.requests < 0 || input.requests > 300000000 || input.hours < 1 || input.hours > 744
        || input.memoryMb < 128 || input.memoryMb > 10240 || input.billedMs < 1 || input.billedMs > 900000
        || input.payloadBytes < 0 || input.payloadBytes > 524288 || input.tasks < 2 || input.tasks > 100
        || input.zones !== 2 || input.interfaceServices !== 3 || input.interfaceGb < 0 || input.interfaceGb > 1048576
        || input.publicIpv4 < 2 || input.publicIpv4 > 100 || input.assumedLcu < 0 || input.assumedLcu > 10000)
        throw Error('outside_model_scope');
    const memoryChoices = { '0.25': [0.5, 1, 2], '0.5': [1, 2, 3, 4], '1': [2, 3, 4, 5, 6, 7, 8] };
    if (!memoryChoices[input.taskVcpu]?.includes(input.taskMemoryGb))
        throw Error('unsupported_task_shape');
    if (input.requests * (input.memoryMb / 1024) * (input.billedMs / 1000) > 6000000000)
        throw Error('outside_lambda_first_tier');
    return input;
}
export function estimate(input, rates) {
    validateInputs(input);
    const keys = ['lambdaRequest', 'lambdaGbSecond', 'httpApiRequest', 'fargateVcpuHour',
        'fargateGbHour', 'albHour', 'albLcuHour', 'endpointAzHour', 'endpointGb', 'publicIpv4Hour'];
    for (const key of keys)
        if (!Number.isFinite(rates[key]) || rates[key] < 0)
            throw Error(`invalid_rate:${key}`);
    const gbSeconds = input.requests * (input.memoryMb / 1024) * (input.billedMs / 1000);
    const lambdaLines = {
        requests: amount(input.requests * rates.lambdaRequest),
        compute: amount(gbSeconds * rates.lambdaGbSecond),
        httpApi: amount(input.requests * rates.httpApiRequest),
    };
    const taskHours = input.tasks * input.hours;
    const ecsLines = {
        compute: amount(taskHours * (input.taskVcpu * rates.fargateVcpuHour + input.taskMemoryGb * rates.fargateGbHour)),
        albHours: amount(input.hours * rates.albHour),
        albLcu: amount(input.hours * input.assumedLcu * rates.albLcuHour),
        endpointHours: amount(input.hours * input.interfaceServices * input.zones * rates.endpointAzHour),
        endpointData: amount(input.interfaceGb * rates.endpointGb),
        publicIpv4: amount(input.hours * input.publicIpv4 * rates.publicIpv4Hour),
    };
    const sum = (lines) => amount(Object.values(lines).reduce((a, b) => a + b, 0));
    return {
        lambda: { lines: lambdaLines, subtotal: sum(lambdaLines), units: { gbSeconds, billedInvocations: input.requests } },
        ecs: { lines: ecsLines, subtotal: sum(ecsLines), units: { taskHours, endpointAzHours: input.hours * input.interfaceServices * input.zones } },
        currency: 'USD', scope: 'modeled_infrastructure_subtotal', capacityValidated: false,
        precisionUsd: 0.00000001,
    };
}

module.exports = {
    extension: ['ts'],
    spec: [
        'tests/**/*.node.test.ts',
        'src/**/*.node.test.ts',
    ],
    loader: 'ts-node/esm'
}
